import { NextRequest } from "next/server";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { cardAssetLocks, cardAssets, marketListings, players } from "@/db/schema";
import { allCards } from "@/game/cards";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import { loadGameConfig } from "@/game/settings";
import { runtimeGate } from "@/lib/runtime-gates";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { consumeRequestRateLimit } from "@/lib/rate-limit";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/request-security";
import { economyOperationId, runIdempotentEconomyAction } from "@/lib/economy-idempotency";
import { recordEconomyTransaction } from "@/lib/economy-ledger";
import { marketplaceFee, playerCanUseMarketplace, validateMarketPrice } from "@/lib/marketplace-policy";
import { cleanupExpiredMarketplace, getMarketplaceSettings, lockPlayers, playerCardCount, transferAsset } from "@/lib/marketplace-service";

export const dynamic = "force-dynamic";
const MAX_BODY = 24 * 1024;

function cardSummary(defId: string) {
  const card = allCards().find((entry) => entry.defId === defId);
  return card ? {
    defId: card.defId,
    name: card.name,
    rarity: card.rarity,
    region: card.region,
    cost: card.cost,
    emoji: card.emoji,
  } : { defId, name: defId };
}

export async function GET(req: NextRequest) {
  await ensureCustomCardsLoaded();
  const identity = await requireStablePlayerIdentity(req);
  if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
  const rate = await consumeRequestRateLimit(req, "marketplace-read", 120, 60_000);
  if (!rate.allowed) return Response.json({ ok: false, error: "Too many requests" }, { status: 429 });

  try {
    const url = new URL(req.url);
    const view = url.searchParams.get("view") || "listings";
    const q = (url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 80);
    const now = new Date();
    const [settings, player] = await Promise.all([
      getMarketplaceSettings(),
      db.select().from(players).where(eq(players.id, identity.playerId)).limit(1).then((rows) => rows[0]),
    ]);
    if (!settings) return Response.json({ ok: false, error: "Marketplace is not provisioned" }, { status: 503 });
    if (!player) return Response.json({ ok: false, error: "Player not found" }, { status: 404 });
    const access = playerCanUseMarketplace(player, settings, now);
    if (!access.ok) return Response.json({ ok: false, error: access.error }, { status: 403 });

    if (view === "inventory") {
      const rows = await db.select({
        id: cardAssets.id,
        defId: cardAssets.defId,
        variantId: cardAssets.variantId,
        frameId: cardAssets.frameId,
        finish: cardAssets.finish,
        tradable: cardAssets.tradable,
        acquiredAt: cardAssets.acquiredAt,
        lockKind: cardAssetLocks.kind,
        lockExpiresAt: cardAssetLocks.expiresAt,
      }).from(cardAssets)
        .leftJoin(cardAssetLocks, eq(cardAssetLocks.assetId, cardAssets.id))
        .where(eq(cardAssets.ownerPlayerId, player.id))
        .orderBy(desc(cardAssets.acquiredAt))
        .limit(500);
      return Response.json({
        ok: true,
        settings,
        player: { id: player.id, name: player.name, gold: player.gold },
        assets: rows.map((row) => ({
          ...row,
          locked: Boolean(row.lockKind && row.lockExpiresAt && new Date(row.lockExpiresAt) > now),
          card: cardSummary(row.defId),
        })),
      });
    }

    if (view === "mine") {
      const rows = await db.select({
        id: marketListings.id,
        priceGold: marketListings.priceGold,
        feeGold: marketListings.feeGold,
        status: marketListings.status,
        listedAt: marketListings.listedAt,
        expiresAt: marketListings.expiresAt,
        completedAt: marketListings.completedAt,
        buyerPlayerId: marketListings.buyerPlayerId,
        assetId: cardAssets.id,
        defId: cardAssets.defId,
        variantId: cardAssets.variantId,
        frameId: cardAssets.frameId,
        finish: cardAssets.finish,
      }).from(marketListings)
        .innerJoin(cardAssets, eq(cardAssets.id, marketListings.assetId))
        .where(eq(marketListings.sellerPlayerId, player.id))
        .orderBy(desc(marketListings.listedAt))
        .limit(200);
      return Response.json({ ok: true, settings, player: { id: player.id, name: player.name, gold: player.gold }, listings: rows.map((row) => ({ ...row, card: cardSummary(row.defId) })) });
    }

    if (view === "history") {
      const rows = await db.select({
        id: marketListings.id,
        priceGold: marketListings.priceGold,
        feeGold: marketListings.feeGold,
        completedAt: marketListings.completedAt,
        defId: cardAssets.defId,
        variantId: cardAssets.variantId,
        frameId: cardAssets.frameId,
        finish: cardAssets.finish,
        sellerName: players.name,
      }).from(marketListings)
        .innerJoin(cardAssets, eq(cardAssets.id, marketListings.assetId))
        .innerJoin(players, eq(players.id, marketListings.sellerPlayerId))
        .where(eq(marketListings.status, "sold"))
        .orderBy(desc(marketListings.completedAt))
        .limit(100);
      return Response.json({ ok: true, settings, history: rows.map((row) => ({ ...row, card: cardSummary(row.defId) })) });
    }

    const rows = await db.select({
      id: marketListings.id,
      priceGold: marketListings.priceGold,
      feeGold: marketListings.feeGold,
      listedAt: marketListings.listedAt,
      expiresAt: marketListings.expiresAt,
      sellerPlayerId: marketListings.sellerPlayerId,
      sellerName: players.name,
      assetId: cardAssets.id,
      defId: cardAssets.defId,
      variantId: cardAssets.variantId,
      frameId: cardAssets.frameId,
      finish: cardAssets.finish,
    }).from(marketListings)
      .innerJoin(cardAssets, eq(cardAssets.id, marketListings.assetId))
      .innerJoin(players, eq(players.id, marketListings.sellerPlayerId))
      .where(and(eq(marketListings.status, "active"), gt(marketListings.expiresAt, now)))
      .orderBy(asc(marketListings.priceGold), asc(marketListings.id))
      .limit(300);

    const enriched = rows.map((row) => ({ ...row, card: cardSummary(row.defId) }));
    const listings = q
      ? enriched.filter((row) => `${row.card.name} ${row.defId} ${row.sellerName} ${row.variantId} ${row.frameId} ${row.finish}`.toLowerCase().includes(q))
      : enriched;
    return Response.json({ ok: true, settings, player: { id: player.id, name: player.name, gold: player.gold }, listings: listings.slice(0, 100) });
  } catch (error) {
    console.error("[market] GET failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  const rate = await consumeRequestRateLimit(req, "marketplace-write", 40, 60_000);
  if (!rate.allowed) return Response.json({ ok: false, error: "Too many requests" }, { status: 429 });

  try {
    const body = await readBoundedJson<Record<string, unknown>>(req, MAX_BODY);
    const identity = await requireStablePlayerIdentity(req);
    if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const operationId = economyOperationId(req, body);
    if (!operationId) return Response.json({ ok: false, error: "A valid X-Operation-Id is required", code: "OPERATION_ID_REQUIRED" }, { status: 400 });
    const action = String(body.action || "");
    if (!new Set(["list", "buy", "cancel"]).has(action)) return Response.json({ ok: false, error: "Invalid action" }, { status: 400 });
    const config = await loadGameConfig();
    const duplicateCap = config.advanced.economy.duplicateCap;

    const result = await db.transaction(async (tx) => {
      const now = new Date();
      await cleanupExpiredMarketplace(tx, now);
      const settings = await getMarketplaceSettings(tx);
      if (!settings) return { error: "Marketplace is not provisioned", status: 503 };
      const [actor] = await tx.select().from(players).where(eq(players.id, identity.playerId)).limit(1);
      if (!actor) return { error: "Player not found", status: 404 };
      const access = playerCanUseMarketplace(actor, settings, now);
      if (!access.ok) return { error: access.error, status: 403 };

      const rawId = Number(action === "list" ? body.assetId : body.listingId);
      const rawPrice = Number(body.priceGold);
      if (!Number.isSafeInteger(rawId) || rawId < 1) return { error: action === "list" ? "Invalid asset or price" : "Invalid listing", status: 400 };
      if (action === "list" && !validateMarketPrice(rawPrice, settings)) return { error: "Invalid asset or price", status: 400 };
      const fingerprint = action === "list"
        ? `market:list:${rawId}:${rawPrice}`
        : `market:${action}:${rawId}`;

      const operation = await runIdempotentEconomyAction(tx, { playerId: actor.id, operationId, action: fingerprint }, async () => {
        if (action === "list") {
          const assetId = rawId;
          const priceGold = rawPrice;
          const active = await tx.select({ n: sql<number>`count(*)::int` }).from(marketListings).where(and(
            eq(marketListings.sellerPlayerId, actor.id),
            eq(marketListings.status, "active"),
            gt(marketListings.expiresAt, now),
          ));
          if ((active[0]?.n ?? 0) >= settings.maxActiveListings) return { error: "Active listing limit reached", status: 409 };
          const [asset] = await tx.select().from(cardAssets).where(and(eq(cardAssets.id, assetId), eq(cardAssets.ownerPlayerId, actor.id))).limit(1).for("update");
          if (!asset || !asset.tradable) return { error: "Card copy is not tradable", status: 400 };
          const [locked] = await tx.select().from(cardAssetLocks).where(eq(cardAssetLocks.assetId, asset.id)).limit(1);
          if (locked) return { error: "Card copy is already in escrow", status: 409 };
          const expiresAt = new Date(now.getTime() + settings.listingDurationHours * 60 * 60 * 1000);
          const feeGold = marketplaceFee(priceGold, settings.feeBps);
          const [listing] = await tx.insert(marketListings).values({ assetId, sellerPlayerId: actor.id, priceGold, feeGold, expiresAt }).returning();
          await tx.insert(cardAssetLocks).values({ assetId, ownerPlayerId: actor.id, kind: "listing", referenceId: listing.id, expiresAt });
          return { listingId: listing.id, priceGold, feeGold, sellerReceives: priceGold - feeGold, expiresAt };
        }

        const listingId = rawId;
        const [listing] = await tx.select().from(marketListings).where(eq(marketListings.id, listingId)).limit(1).for("update");
        if (!listing || listing.status !== "active" || listing.expiresAt <= now) return { error: "Listing is no longer active", status: 409 };

        if (action === "cancel") {
          if (listing.sellerPlayerId !== actor.id) return { error: "Only the seller can cancel this listing", status: 403 };
          await tx.update(marketListings).set({ status: "cancelled", completedAt: now }).where(eq(marketListings.id, listing.id));
          await tx.delete(cardAssetLocks).where(and(eq(cardAssetLocks.kind, "listing"), eq(cardAssetLocks.referenceId, listing.id)));
          return { listingId: listing.id, cancelled: true };
        }

        if (listing.sellerPlayerId === actor.id) return { error: "You cannot buy your own listing", status: 400 };
        await lockPlayers(tx, [actor.id, listing.sellerPlayerId]);
        const [buyer] = await tx.select().from(players).where(eq(players.id, actor.id)).limit(1);
        const [seller] = await tx.select().from(players).where(eq(players.id, listing.sellerPlayerId)).limit(1);
        if (!buyer || !seller) return { error: "Buyer or seller no longer exists", status: 409 };
        const [asset] = await tx.select().from(cardAssets).where(and(eq(cardAssets.id, listing.assetId), eq(cardAssets.ownerPlayerId, seller.id))).limit(1).for("update");
        if (!asset) return { error: "Listed asset ownership changed", status: 409 };
        const buyerCopies = await playerCardCount(tx, buyer.id, asset.defId);
        if (buyerCopies + 1 > duplicateCap) return { error: `Collection cap is ${duplicateCap} copies per card`, status: 409 };
        const spent = await tx.update(players).set({ gold: sql`${players.gold} - ${listing.priceGold}` }).where(and(
          eq(players.id, buyer.id),
          sql`${players.gold} >= ${listing.priceGold}`,
        )).returning({ gold: players.gold });
        if (!spent.length) return { error: "Not enough Gold", status: 400 };
        const net = listing.priceGold - listing.feeGold;
        const credited = await tx.update(players).set({ gold: sql`${players.gold} + ${net}` }).where(eq(players.id, seller.id)).returning({ gold: players.gold });
        if (!credited.length) throw new Error("MARKET_SELLER_CREDIT_FAILED");
        await transferAsset(tx, asset.id, seller.id, buyer.id);
        await tx.update(marketListings).set({ status: "sold", buyerPlayerId: buyer.id, completedAt: now }).where(eq(marketListings.id, listing.id));
        await tx.delete(cardAssetLocks).where(and(eq(cardAssetLocks.kind, "listing"), eq(cardAssetLocks.referenceId, listing.id)));
        await recordEconomyTransaction(tx, { playerId: buyer.id, currency: "gold", amount: -listing.priceGold, balanceAfter: spent[0].gold, reason: "market_purchase", referenceType: "market_listing", referenceId: String(listing.id) });
        if (net) await recordEconomyTransaction(tx, { playerId: seller.id, currency: "gold", amount: net, balanceAfter: credited[0].gold, reason: "market_sale", referenceType: "market_listing", referenceId: String(listing.id) });
        return { listingId: listing.id, bought: true, assetId: asset.id, defId: asset.defId, priceGold: listing.priceGold, feeGold: listing.feeGold, buyerGold: spent[0].gold };
      });
      return { ...operation.response, duplicate: operation.duplicate };
    });

    if ("error" in result) return Response.json({ ok: false, error: result.error }, { status: Number(result.status) || 400 });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ ok: false, error: "Payload too large" }, { status: 413 });
    if (error instanceof Error && error.message === "OPERATION_ID_REUSED_FOR_DIFFERENT_ACTION") return Response.json({ ok: false, error: "Operation id was already used for a different market action" }, { status: 409 });
    console.error("[market] POST failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
