import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { cardAssetLocks, cardAssets, marketListings, marketplaceSettings, playerCards, tradeOffers } from "@/db/schema";

export async function getMarketplaceSettings(tx: any = db) {
  const [settings] = await tx.select().from(marketplaceSettings).where(eq(marketplaceSettings.id, 1)).limit(1);
  return settings ?? null;
}

/**
 * Expiry is finalized opportunistically inside market mutations. Locks also
 * carry an expiry timestamp, so stale rows are never considered valid escrow.
 */
export async function cleanupExpiredMarketplace(tx: any, now = new Date()) {
  await tx.update(marketListings).set({ status: "expired", completedAt: now }).where(and(
    eq(marketListings.status, "active"),
    lte(marketListings.expiresAt, now),
  ));
  await tx.update(tradeOffers).set({ status: "expired", completedAt: now }).where(and(
    eq(tradeOffers.status, "active"),
    lte(tradeOffers.expiresAt, now),
  ));
  await tx.delete(cardAssetLocks).where(lte(cardAssetLocks.expiresAt, now));
}

export async function lockPlayers(tx: any, playerIds: number[]) {
  const ids = [...new Set(playerIds)].filter(Number.isInteger).sort((a, b) => a - b);
  if (!ids.length) return;
  await tx.execute(sql`SELECT id FROM players WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`,`)}) ORDER BY id FOR UPDATE`);
}

export async function adjustPlayerCardCount(tx: any, playerId: number, defId: string, delta: number) {
  if (!delta) return;
  const [current] = await tx.select().from(playerCards).where(and(
    eq(playerCards.playerId, playerId),
    eq(playerCards.defId, defId),
  )).limit(1).for("update");
  const next = (current?.count ?? 0) + delta;
  if (next < 0) throw new Error("MARKET_OWNERSHIP_UNDERFLOW");
  if (next === 0) {
    if (current) await tx.delete(playerCards).where(eq(playerCards.id, current.id));
    return;
  }
  if (current) {
    await tx.update(playerCards).set({ count: next }).where(eq(playerCards.id, current.id));
  } else {
    await tx.insert(playerCards).values({ playerId, defId, count: next });
  }
}

export async function playerCardCount(tx: any, playerId: number, defId: string) {
  const [row] = await tx.select({ count: playerCards.count }).from(playerCards).where(and(
    eq(playerCards.playerId, playerId),
    eq(playerCards.defId, defId),
  )).limit(1).for("update");
  return row?.count ?? 0;
}

export async function transferAsset(tx: any, assetId: number, fromPlayerId: number, toPlayerId: number) {
  const [asset] = await tx.select().from(cardAssets).where(and(
    eq(cardAssets.id, assetId),
    eq(cardAssets.ownerPlayerId, fromPlayerId),
  )).limit(1).for("update");
  if (!asset) throw new Error("MARKET_ASSET_NOT_OWNED");
  await tx.update(cardAssets).set({ ownerPlayerId: toPlayerId }).where(eq(cardAssets.id, assetId));
  await adjustPlayerCardCount(tx, fromPlayerId, asset.defId, -1);
  await adjustPlayerCardCount(tx, toPlayerId, asset.defId, 1);
  return asset;
}

export async function deleteUnlockedAssets(tx: any, playerId: number, defId: string, amount: number) {
  const candidates = await tx.select({ id: cardAssets.id }).from(cardAssets)
    .leftJoin(cardAssetLocks, eq(cardAssetLocks.assetId, cardAssets.id))
    .where(and(
      eq(cardAssets.ownerPlayerId, playerId),
      eq(cardAssets.defId, defId),
      sql`${cardAssetLocks.assetId} IS NULL OR ${cardAssetLocks.expiresAt} <= now()`,
    ))
    .orderBy(cardAssets.id)
    .limit(amount)
    .for("update", { of: cardAssets });
  if (candidates.length !== amount) return false;
  const ids = candidates.map((row: { id: number }) => row.id);
  await tx.execute(sql`DELETE FROM card_assets WHERE id IN (${sql.join(ids.map((id: number) => sql`${id}`), sql`,`)})`);
  return true;
}

export async function createStandardAssets(tx: any, playerId: number, defId: string, amount: number, source: string) {
  if (amount < 1) return;
  await tx.insert(cardAssets).values(Array.from({ length: amount }, () => ({
    ownerPlayerId: playerId,
    defId,
    variantId: "standard",
    frameId: "default",
    finish: "normal",
    tradable: true,
    source,
  })));
}
