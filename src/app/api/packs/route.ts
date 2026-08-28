import { runtimeGate } from "@/lib/runtime-gates";
import { NextRequest } from "next/server";
import { randomInt } from "node:crypto";
import { db } from "@/db";
import { players, playerCards, playerPacks, packOpenings } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { createPackRandom, rollRarity } from "@/lib/packs";
import { allCards } from "@/game/cards";
import { getCardCollection } from "@/game/card-collections";
import type { Rarity } from "@/game/types";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { recordEconomyTransaction } from "@/lib/economy-ledger";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import { CONTENT_VERSION } from "@/game/content-version";
import { getRuntimePacks } from "@/lib/control-plane";
import { loadGameConfig } from "@/game/settings";
import { economyOperationId, runIdempotentEconomyAction } from "@/lib/economy-idempotency";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const identity = await requireStablePlayerIdentity(req);
    if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const [player] = await db.select().from(players).where(eq(players.id, identity.playerId)).limit(1);
    if (!player) return Response.json({ ok: false, error: "Player not found" }, { status: 404 });
    const owned = await db.select().from(playerPacks).where(eq(playerPacks.playerId, player.id));
    const recentOpenings = await db.select().from(packOpenings).where(eq(packOpenings.playerId, player.id)).limit(10);
    const ownedMap = new Map(owned.map((p) => [p.packType, p.count]));
    const packDefs = await getRuntimePacks();
    return Response.json({ ok: true, player: { gold: player.gold, dust: player.dust }, packs: packDefs.map((p) => ({ ...p, owned: ownedMap.get(p.id) ?? 0 })), recentOpenings });
  } catch { return Response.json({ ok: false, error: "Internal server error" }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  try {
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 256_000) return Response.json({ ok: false, error: "Payload too large" }, { status: 413 });
    await ensureCustomCardsLoaded();
    const body = await req.json() as Record<string, unknown>;
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const operationId = economyOperationId(req, body);
    if (!operationId) return Response.json({ ok: false, error: "A valid X-Operation-Id is required for economy mutations", code: "OPERATION_ID_REQUIRED" }, { status: 400 });
    const action = String(body.action || "") as "buy" | "open";
    if (!new Set(["buy", "open"]).has(action)) return Response.json({ ok: false, error: "Invalid action" }, { status: 400 });
    const packId = String(body.packId || "");
    const packDefs = await getRuntimePacks();
    const packDef = packDefs.find((pack) => pack.id === packId);
    if (!packDef) return Response.json({ ok: false, error: "Invalid pack" }, { status: 400 });
    const config = await loadGameConfig();
    const DUST_VALUES: Record<Rarity, number> = config.advanced.economy.dustValues;
    const duplicateCap = config.advanced.economy.duplicateCap;
    const actionFingerprint = `pack:${action}:${packId}`;

    const result = await db.transaction(async (tx) => {
      const [player] = await tx.select().from(players).where(eq(players.id, identity.playerId!)).limit(1);
      if (!player) return null;
      await tx.execute(sql`SELECT id FROM players WHERE id = ${player.id} FOR UPDATE`);
      const [fresh] = await tx.select().from(players).where(eq(players.id, player.id)).limit(1);
      if (!fresh) return null;

      const operation = await runIdempotentEconomyAction(tx, { playerId: fresh.id, operationId, action: actionFingerprint }, async () => {
        if (action === "buy") {
          const spent = await tx.update(players).set({ gold: sql`${players.gold} - ${packDef.price}` }).where(and(eq(players.id, fresh.id), sql`${players.gold} >= ${packDef.price}`)).returning({ gold: players.gold });
          if (!spent.length) return { error: "Not enough gold" };
          await recordEconomyTransaction(tx, { playerId: fresh.id, currency: "gold", amount: -packDef.price, balanceAfter: spent[0].gold, reason: "pack_purchase", referenceType: "pack", referenceId: `${packId}:${operationId}` });
          await tx.insert(playerPacks).values({ playerId: fresh.id, packType: packId, count: 1 }).onConflictDoUpdate({ target: [playerPacks.playerId, playerPacks.packType], set: { count: sql`${playerPacks.count} + 1` } });
          return { newGold: spent[0].gold };
        }

        const [pack] = await tx.select().from(playerPacks).where(and(eq(playerPacks.playerId, fresh.id), eq(playerPacks.packType, packId))).limit(1);
        if (!pack || pack.count < 1) return { error: "No packs to open" };
        if (pack.count === 1) {
          // The schema requires positive pack counts. Deleting the final row
          // directly avoids ever persisting the forbidden intermediate value 0.
          const removed = await tx.delete(playerPacks).where(and(eq(playerPacks.id, pack.id), sql`${playerPacks.count} = 1`)).returning({ id: playerPacks.id });
          if (!removed.length) return { error: "No packs to open" };
        } else {
          const consumed = await tx.update(playerPacks).set({ count: sql`${playerPacks.count} - 1` }).where(and(eq(playerPacks.id, pack.id), sql`${playerPacks.count} > 1`)).returning({ count: playerPacks.count });
          if (!consumed.length) return { error: "No packs to open" };
        }

        const collectibleCards = allCards().filter((c) => c.collectible !== false).filter((c) => !packDef.collectionKey || getCardCollection(c.defId)?.key === packDef.collectionKey);
        const byRarity: Record<Rarity, typeof collectibleCards> = {
          Common: collectibleCards.filter((c) => c.rarity === "Common"),
          Rare: collectibleCards.filter((c) => c.rarity === "Rare"),
          Epic: collectibleCards.filter((c) => c.rarity === "Epic"),
          Legend: collectibleCards.filter((c) => c.rarity === "Legend"),
        };
        const received: string[] = [];
        let dustBonus = 0;
        const packSeed = randomInt(1, 0x7fffffff);
        const randomValue = createPackRandom(packSeed);
        for (let i = 0; i < packDef.cardsCount; i++) {
          let rarity: Rarity;
          if (i === packDef.cardsCount - 1 && packDef.guaranteedRarity) {
            const order = ["Common", "Rare", "Epic", "Legend"];
            const guaranteed = packDef.guaranteedRarity;
            const hasGuaranteed = received.some((id) => order.indexOf(allCards().find((c) => c.defId === id)?.rarity || "Common") >= order.indexOf(guaranteed));
            rarity = hasGuaranteed ? rollRarity(packDef.dropRates, randomValue()) : guaranteed;
          } else rarity = rollRarity(packDef.dropRates, randomValue());
          const pool = byRarity[rarity];
          if (pool.length) received.push(pool[Math.floor(randomValue() * pool.length)].defId);
        }

        for (const defId of received) {
          const [card] = await tx.select().from(playerCards).where(and(eq(playerCards.playerId, fresh.id), eq(playerCards.defId, defId))).limit(1);
          if (card) {
            if (card.count >= duplicateCap) {
              const definition = allCards().find((c) => c.defId === defId);
              if (definition) dustBonus += DUST_VALUES[definition.rarity];
            } else await tx.update(playerCards).set({ count: sql`${playerCards.count} + 1` }).where(eq(playerCards.id, card.id));
          } else await tx.insert(playerCards).values({ playerId: fresh.id, defId, count: 1 });
        }
        let newDust = fresh.dust;
        if (dustBonus) {
          const [wallet] = await tx.update(players).set({ dust: sql`${players.dust} + ${dustBonus}` }).where(eq(players.id, fresh.id)).returning({ dust: players.dust });
          newDust = wallet.dust;
          await recordEconomyTransaction(tx, { playerId: fresh.id, currency: "dust", amount: dustBonus, balanceAfter: newDust, reason: "pack_opening", referenceType: "pack", referenceId: `${packId}:${operationId}` });
        }
        await tx.insert(packOpenings).values({ playerId: fresh.id, packType: packId, cardsReceived: JSON.stringify(received), dustBonus, packSeed, contentVersion: CONTENT_VERSION });
        return { received, dustBonus, newDust, packSeed };
      });
      return { ...operation.response, duplicate: operation.duplicate };
    });

    if (!result) return Response.json({ ok: false, error: "Player not found" }, { status: 404 });
    if ("error" in result) return Response.json({ ok: false, error: result.error }, { status: 400 });
    if ("received" in result) {
      return Response.json({ ok: true, cards: (result.received ?? []).map((defId) => { const c = allCards().find((x) => x.defId === defId); return { defId, rarity: c?.rarity, name: c?.name, region: c?.region, emoji: c?.emoji, cost: c?.cost }; }), dustBonus: result.dustBonus, newDust: result.newDust, packSeed: result.packSeed, duplicate: result.duplicate });
    }
    return Response.json({ ok: true, newGold: result.newGold, duplicate: result.duplicate });
  } catch (error) {
    if (error instanceof Error && error.message === "OPERATION_ID_REUSED_FOR_DIFFERENT_ACTION") return Response.json({ ok: false, error: "Operation id was already used for a different economy action" }, { status: 409 });
    console.error("[packs] mutation failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
