import { runtimeGate } from "@/lib/runtime-gates";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { players, playerCards } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { allCards } from "@/game/cards";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import type { Rarity } from "@/game/types";
import { loadGameConfig } from "@/game/settings";
import { getRuntimeCraftCosts } from "@/lib/control-plane";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { recordEconomyTransaction } from "@/lib/economy-ledger";
import { economyOperationId, runIdempotentEconomyAction } from "@/lib/economy-idempotency";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureCustomCardsLoaded();
  try {
    const url = new URL(req.url);
    const identity = await requireStablePlayerIdentity(req);
    if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const [player] = await db.select().from(players).where(eq(players.id, identity.playerId)).limit(1);
    if (!player) return Response.json({ ok: false, error: "Player not found" }, { status: 404 });
    const [collection, config, craftCosts] = await Promise.all([
      db.select().from(playerCards).where(eq(playerCards.playerId, player.id)),
      loadGameConfig(),
      getRuntimeCraftCosts(),
    ]);
    const collectionMap = new Map(collection.map((c) => [c.defId, { count: c.count, shiny: c.shiny }]));
    const detailed = allCards().map((card) => ({ ...card, owned: collectionMap.get(card.defId)?.count ?? 0, shiny: collectionMap.get(card.defId)?.shiny ?? false, dustValue: config.advanced.economy.dustValues[card.rarity], craftCost: craftCosts[card.rarity] }));
    const collectibleDetailed = detailed.filter((card) => card.collectible !== false);
    return Response.json({ ok: true, player: { name: player.name, gold: player.gold, dust: player.dust, level: player.level, xp: player.xp }, collection: detailed, totalCards: collectibleDetailed.length, ownedCards: collectibleDetailed.filter((card) => card.owned > 0).length, totalDefinitions: detailed.length, duplicateCap: config.advanced.economy.duplicateCap });
  } catch { return Response.json({ ok: false, error: "Internal server error" }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  await ensureCustomCardsLoaded();
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  try {
    const body = await req.json() as Record<string, unknown>;
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const operationId = economyOperationId(req, body);
    if (!operationId) return Response.json({ ok: false, error: "A valid X-Operation-Id is required for economy mutations", code: "OPERATION_ID_REQUIRED" }, { status: 400 });
    const action = String(body.action || "") as "disenchant" | "craft";
    if (!new Set(["disenchant", "craft"]).has(action)) return Response.json({ ok: false, error: "Invalid action" }, { status: 400 });
    const defId = String(body.defId || "");
    const [config, craftCosts] = await Promise.all([loadGameConfig(), getRuntimeCraftCosts()]);
    const duplicateCap = config.advanced.economy.duplicateCap;
    const dustValues: Record<Rarity, number> = config.advanced.economy.dustValues;
    const amount = Math.max(1, Math.min(duplicateCap, Math.trunc(Number(body.amount) || 1)));
    const card = allCards().find((c) => c.defId === defId);
    if (!card || card.collectible === false) return Response.json({ ok: false, error: "Invalid card" }, { status: 400 });
    const actionFingerprint = `collection:${action}:${defId}:${amount}`;

    const result = await db.transaction(async (tx) => {
      const [player] = await tx.select().from(players).where(eq(players.id, identity.playerId!)).limit(1);
      if (!player) return null;
      await tx.execute(sql`SELECT id FROM players WHERE id = ${player.id} FOR UPDATE`);
      const [fresh] = await tx.select().from(players).where(eq(players.id, player.id)).limit(1);
      if (!fresh) return null;

      const operation = await runIdempotentEconomyAction(tx, { playerId: fresh.id, operationId, action: actionFingerprint }, async () => {
        if (action === "disenchant") {
          const [ownedCard] = await tx.select({ id: playerCards.id, count: playerCards.count }).from(playerCards).where(and(eq(playerCards.playerId, fresh.id), eq(playerCards.defId, defId))).limit(1);
          if (!ownedCard || ownedCard.count < amount) return { error: "Not enough copies" };

          let newCount: number;
          if (ownedCard.count === amount) {
            const removed = await tx.delete(playerCards).where(and(eq(playerCards.id, ownedCard.id), eq(playerCards.count, ownedCard.count))).returning({ id: playerCards.id });
            if (!removed.length) return { error: "Not enough copies" };
            newCount = 0;
          } else {
            const [updated] = await tx.update(playerCards).set({ count: sql`${playerCards.count} - ${amount}` }).where(and(eq(playerCards.id, ownedCard.id), sql`${playerCards.count} > ${amount}`)).returning({ count: playerCards.count });
            if (!updated) return { error: "Not enough copies" };
            newCount = updated.count;
          }

          const dustValue = dustValues[card.rarity] * amount;
          const [wallet] = await tx.update(players).set({ dust: sql`${players.dust} + ${dustValue}` }).where(eq(players.id, fresh.id)).returning({ dust: players.dust });
          await recordEconomyTransaction(tx, { playerId: fresh.id, currency: "dust", amount: dustValue, balanceAfter: wallet.dust, reason: "disenchant", referenceType: "card", referenceId: `${defId}:${operationId}` });
          return { dustGained: dustValue, newCount };
        }

        const existing = await tx.select().from(playerCards).where(and(eq(playerCards.playerId, fresh.id), eq(playerCards.defId, defId))).limit(1);
        const currentCount = existing[0]?.count ?? 0;
        if (currentCount + amount > duplicateCap) return { error: `Collection cap is ${duplicateCap} copies per card` };
        const cost = craftCosts[card.rarity] * amount;
        const spent = await tx.update(players).set({ dust: sql`${players.dust} - ${cost}` }).where(and(eq(players.id, fresh.id), sql`${players.dust} >= ${cost}`)).returning({ dust: players.dust });
        if (!spent.length) return { error: "Not enough dust" };
        await recordEconomyTransaction(tx, { playerId: fresh.id, currency: "dust", amount: -cost, balanceAfter: spent[0].dust, reason: "craft", referenceType: "card", referenceId: `${defId}:${operationId}` });
        if (existing.length) {
          await tx.update(playerCards).set({ count: sql`${playerCards.count} + ${amount}` }).where(eq(playerCards.id, existing[0].id));
          return { dustSpent: cost, newCount: currentCount + amount };
        }
        await tx.insert(playerCards).values({ playerId: fresh.id, defId, count: amount });
        return { dustSpent: cost, newCount: amount };
      });
      return { ...operation.response, duplicate: operation.duplicate };
    });
    if (!result) return Response.json({ ok: false, error: "Player not found" }, { status: 404 });
    if ("error" in result) {
      const status = result.error === "OPERATION_ID_REUSED_FOR_DIFFERENT_ACTION" ? 409 : 400;
      return Response.json({ ok: false, error: result.error }, { status });
    }
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "OPERATION_ID_REUSED_FOR_DIFFERENT_ACTION") return Response.json({ ok: false, error: "Operation id was already used for a different economy action" }, { status: 409 });
    console.error("[collection] mutation failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
