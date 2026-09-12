import { NextRequest } from "next/server";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { cardAssetLocks, cardAssets, players, tradeOffers } from "@/db/schema";
import { allCards } from "@/game/cards";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import { loadGameConfig } from "@/game/settings";
import { runtimeGate } from "@/lib/runtime-gates";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { consumeRequestRateLimit } from "@/lib/rate-limit";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/request-security";
import { economyOperationId, runIdempotentEconomyAction } from "@/lib/economy-idempotency";
import { collectibleMatches, normalizeRequestedCollectibles, playerCanUseMarketplace } from "@/lib/marketplace-policy";
import { cleanupExpiredMarketplace, getMarketplaceSettings, lockPlayers, playerCardCount, transferAsset } from "@/lib/marketplace-service";

export const dynamic = "force-dynamic";
const MAX_BODY = 32 * 1024;

function summary(defId: string) {
  const card = allCards().find((entry) => entry.defId === defId);
  return card ? { defId, name: card.name, rarity: card.rarity, region: card.region, emoji: card.emoji } : { defId, name: defId };
}

function groupDeltas(entries: Array<{ playerId: number; defId: string; delta: number }>) {
  const grouped = new Map<string, { playerId: number; defId: string; delta: number }>();
  for (const entry of entries) {
    const key = `${entry.playerId}:${entry.defId}`;
    const current = grouped.get(key);
    if (current) current.delta += entry.delta;
    else grouped.set(key, { ...entry });
  }
  return [...grouped.values()].filter((entry) => entry.delta !== 0);
}

export async function GET(req: NextRequest) {
  await ensureCustomCardsLoaded();
  const identity = await requireStablePlayerIdentity(req);
  if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
  const rate = await consumeRequestRateLimit(req, "trade-read", 120, 60_000);
  if (!rate.allowed) return Response.json({ ok: false, error: "Too many requests" }, { status: 429 });

  try {
    const now = new Date();
    const [settings, player] = await Promise.all([
      getMarketplaceSettings(),
      db.select().from(players).where(eq(players.id, identity.playerId)).limit(1).then((rows) => rows[0]),
    ]);
    if (!settings) return Response.json({ ok: false, error: "Marketplace is not provisioned" }, { status: 503 });
    if (!player) return Response.json({ ok: false, error: "Player not found" }, { status: 404 });
    const access = playerCanUseMarketplace(player, settings, now);
    if (!access.ok) return Response.json({ ok: false, error: access.error }, { status: 403 });

    const rows = await db.select().from(tradeOffers).where(or(
      eq(tradeOffers.proposerPlayerId, identity.playerId),
      eq(tradeOffers.recipientPlayerId, identity.playerId),
    )).orderBy(desc(tradeOffers.createdAt)).limit(200);
    const ids = [...new Set(rows.flatMap((row) => [row.proposerPlayerId, row.recipientPlayerId]))];
    const names = ids.length ? await db.select({ id: players.id, name: players.name }).from(players).where(inArray(players.id, ids)) : [];
    const nameMap = new Map(names.map((row) => [row.id, row.name]));
    return Response.json({
      ok: true,
      trades: rows.map((row) => ({
        ...row,
        effectiveStatus: row.status === "active" && row.expiresAt <= now ? "expired" : row.status,
        proposerName: nameMap.get(row.proposerPlayerId) ?? "Unknown",
        recipientName: nameMap.get(row.recipientPlayerId) ?? "Unknown",
        direction: row.proposerPlayerId === identity.playerId ? "outgoing" : "incoming",
        offeredAssets: row.offeredAssets.map((asset) => ({ ...asset, card: summary(asset.defId) })),
        requestedAssets: row.requestedAssets.map((asset) => ({ ...asset, card: summary(asset.defId) })),
      })),
    });
  } catch (error) {
    console.error("[trades] GET failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  const rate = await consumeRequestRateLimit(req, "trade-write", 30, 60_000);
  if (!rate.allowed) return Response.json({ ok: false, error: "Too many requests" }, { status: 429 });

  try {
    await ensureCustomCardsLoaded();
    const body = await readBoundedJson<Record<string, unknown>>(req, MAX_BODY);
    const identity = await requireStablePlayerIdentity(req);
    if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const operationId = economyOperationId(req, body);
    if (!operationId) return Response.json({ ok: false, error: "A valid X-Operation-Id is required", code: "OPERATION_ID_REQUIRED" }, { status: 400 });
    const action = String(body.action || "");
    if (!new Set(["create", "accept", "cancel", "decline"]).has(action)) return Response.json({ ok: false, error: "Invalid action" }, { status: 400 });
    const gameConfig = await loadGameConfig();
    const duplicateCap = gameConfig.advanced.economy.duplicateCap;

    const result = await db.transaction(async (tx) => {
      const now = new Date();
      await cleanupExpiredMarketplace(tx, now);
      const settings = await getMarketplaceSettings(tx);
      if (!settings) return { error: "Marketplace is not provisioned", status: 503 };
      const [actor] = await tx.select().from(players).where(eq(players.id, identity.playerId)).limit(1);
      if (!actor) return { error: "Player not found", status: 404 };
      const access = playerCanUseMarketplace(actor, settings, now);
      if (!access.ok) return { error: access.error, status: 403 };

      if (action === "create") {
        const recipientName = String(body.recipientName || "").trim().slice(0, 40);
        const offeredAssetIds = Array.isArray(body.offeredAssetIds)
          ? [...new Set(body.offeredAssetIds.map((value) => Number(value)).filter((value) => Number.isSafeInteger(value) && value > 0))]
          : [];
        const requestedAssets = normalizeRequestedCollectibles(body.requestedAssets, settings.maxTradeCardsPerSide);
        const note = String(body.note || "").trim().slice(0, 240);
        if (!recipientName || offeredAssetIds.length < 1 || offeredAssetIds.length > settings.maxTradeCardsPerSide || !requestedAssets) {
          return { error: "Invalid trade offer", status: 400 };
        }
        if (requestedAssets.some((request) => !allCards().some((card) => card.defId === request.defId && card.collectible !== false))) {
          return { error: "Requested trade contains an invalid card", status: 400 };
        }
        const [recipient] = await tx.select().from(players).where(eq(players.name, recipientName)).limit(1);
        if (!recipient || recipient.id === actor.id) return { error: "Trade recipient not found", status: 404 };
        const recipientAccess = playerCanUseMarketplace(recipient, settings, now);
        if (!recipientAccess.ok) return { error: "Trade recipient is not eligible for marketplace trading", status: 409 };

        const fingerprint = `trade:create:${recipient.id}:${offeredAssetIds.join(",")}:${JSON.stringify(requestedAssets)}:${note}`;
        const operation = await runIdempotentEconomyAction(tx, { playerId: actor.id, operationId, action: fingerprint }, async () => {
          await lockPlayers(tx, [actor.id, recipient.id]);
          const offered = await tx.select().from(cardAssets).where(and(
            inArray(cardAssets.id, offeredAssetIds),
            eq(cardAssets.ownerPlayerId, actor.id),
            eq(cardAssets.tradable, true),
          )).orderBy(cardAssets.id).for("update");
          if (offered.length !== offeredAssetIds.length) return { error: "One or more offered card copies are unavailable", status: 409 };
          const existingLocks = await tx.select().from(cardAssetLocks).where(inArray(cardAssetLocks.assetId, offeredAssetIds));
          if (existingLocks.length) return { error: "One or more offered card copies are already in escrow", status: 409 };
          const offeredSnapshot = offered.map((asset) => ({ assetId: asset.id, defId: asset.defId, variantId: asset.variantId, frameId: asset.frameId, finish: asset.finish }));
          const expiresAt = new Date(now.getTime() + settings.tradeDurationHours * 60 * 60 * 1000);
          const [offer] = await tx.insert(tradeOffers).values({ proposerPlayerId: actor.id, recipientPlayerId: recipient.id, offeredAssets: offeredSnapshot, requestedAssets, note, expiresAt }).returning();
          await tx.insert(cardAssetLocks).values(offered.map((asset) => ({ assetId: asset.id, ownerPlayerId: actor.id, kind: "trade", referenceId: offer.id, expiresAt })));
          return { tradeId: offer.id, expiresAt };
        });
        return { ...operation.response, duplicate: operation.duplicate };
      }

      const tradeId = Number(body.tradeId);
      if (!Number.isSafeInteger(tradeId) || tradeId < 1) return { error: "Invalid trade", status: 400 };
      const fingerprint = `trade:${action}:${tradeId}`;
      const operation = await runIdempotentEconomyAction(tx, { playerId: actor.id, operationId, action: fingerprint }, async () => {
        const [offer] = await tx.select().from(tradeOffers).where(eq(tradeOffers.id, tradeId)).limit(1).for("update");
        if (!offer || offer.status !== "active" || offer.expiresAt <= now) return { error: "Trade is no longer active", status: 409 };

        if (action === "cancel" || action === "decline") {
          const allowed = action === "cancel" ? offer.proposerPlayerId === actor.id : offer.recipientPlayerId === actor.id;
          if (!allowed) return { error: action === "cancel" ? "Only the proposer can cancel" : "Only the recipient can decline", status: 403 };
          await tx.update(tradeOffers).set({ status: action === "cancel" ? "cancelled" : "declined", completedAt: now }).where(eq(tradeOffers.id, offer.id));
          await tx.delete(cardAssetLocks).where(and(eq(cardAssetLocks.kind, "trade"), eq(cardAssetLocks.referenceId, offer.id)));
          return { tradeId: offer.id, status: action === "cancel" ? "cancelled" : "declined" };
        }

        if (offer.recipientPlayerId !== actor.id) return { error: "Only the recipient can accept this trade", status: 403 };
        await lockPlayers(tx, [offer.proposerPlayerId, offer.recipientPlayerId]);
        const offeredIds = offer.offeredAssets.map((asset) => asset.assetId);
        const offeredRows = await tx.select().from(cardAssets).where(and(
          inArray(cardAssets.id, offeredIds),
          eq(cardAssets.ownerPlayerId, offer.proposerPlayerId),
        )).orderBy(cardAssets.id).for("update");
        if (offeredRows.length !== offeredIds.length) return { error: "Offered cards changed ownership", status: 409 };
        const escrowRows = await tx.select().from(cardAssetLocks).where(and(
          eq(cardAssetLocks.kind, "trade"),
          eq(cardAssetLocks.referenceId, offer.id),
        ));
        if (escrowRows.length !== offeredIds.length) return { error: "Trade escrow is incomplete", status: 409 };

        const recipientAssets = await tx.select().from(cardAssets).where(and(
          eq(cardAssets.ownerPlayerId, offer.recipientPlayerId),
          eq(cardAssets.tradable, true),
        )).orderBy(cardAssets.id).limit(1000).for("update");
        const recipientLocks = recipientAssets.length
          ? await tx.select().from(cardAssetLocks).where(inArray(cardAssetLocks.assetId, recipientAssets.map((asset) => asset.id)))
          : [];
        const lockedIds = new Set(recipientLocks.map((lock) => lock.assetId));
        const used = new Set<number>();
        const requestedRows = [] as typeof recipientAssets;
        for (const request of offer.requestedAssets) {
          const match = recipientAssets.find((asset) => !used.has(asset.id) && !lockedIds.has(asset.id) && collectibleMatches(asset, request));
          if (!match) return { error: `Recipient no longer owns an available copy of ${request.defId}`, status: 409 };
          used.add(match.id);
          requestedRows.push(match);
        }

        const deltas = groupDeltas([
          ...offeredRows.flatMap((asset) => [
            { playerId: offer.proposerPlayerId, defId: asset.defId, delta: -1 },
            { playerId: offer.recipientPlayerId, defId: asset.defId, delta: 1 },
          ]),
          ...requestedRows.flatMap((asset) => [
            { playerId: offer.recipientPlayerId, defId: asset.defId, delta: -1 },
            { playerId: offer.proposerPlayerId, defId: asset.defId, delta: 1 },
          ]),
        ]);
        for (const delta of deltas.sort((a, b) => a.playerId - b.playerId || a.defId.localeCompare(b.defId))) {
          const current = await playerCardCount(tx, delta.playerId, delta.defId);
          const next = current + delta.delta;
          if (next < 0 || next > duplicateCap) return { error: `Trade would violate the ${duplicateCap}-copy collection cap for ${delta.defId}`, status: 409 };
        }

        for (const asset of offeredRows) await transferAsset(tx, asset.id, offer.proposerPlayerId, offer.recipientPlayerId);
        for (const asset of requestedRows) await transferAsset(tx, asset.id, offer.recipientPlayerId, offer.proposerPlayerId);
        await tx.update(tradeOffers).set({ status: "accepted", completedAt: now }).where(eq(tradeOffers.id, offer.id));
        await tx.delete(cardAssetLocks).where(and(eq(cardAssetLocks.kind, "trade"), eq(cardAssetLocks.referenceId, offer.id)));
        return {
          tradeId: offer.id,
          status: "accepted",
          receivedAssetIds: offeredRows.map((asset) => asset.id),
          sentAssetIds: requestedRows.map((asset) => asset.id),
        };
      });
      return { ...operation.response, duplicate: operation.duplicate };
    });

    if ("error" in result) return Response.json({ ok: false, error: result.error }, { status: Number(result.status) || 400 });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ ok: false, error: "Payload too large" }, { status: 413 });
    if (error instanceof Error && error.message === "OPERATION_ID_REUSED_FOR_DIFFERENT_ACTION") return Response.json({ ok: false, error: "Operation id was already used for a different trade action" }, { status: 409 });
    console.error("[trades] POST failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
