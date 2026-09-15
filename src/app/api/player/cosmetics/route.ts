import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { cardAssets, cardCosmeticVariants, playerCardCosmeticPreferences } from "@/db/schema";
import { allCards } from "@/game/cards";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import { getPlayerSession } from "@/lib/player-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const identity = await getPlayerSession(req);
  if (!identity) {
    return Response.json({ ok: true, authenticated: false, wardrobe: [], preferences: [] });
  }
  await ensureCustomCardsLoaded();
  const [assets, variants, preferences] = await Promise.all([
    db.select().from(cardAssets).where(eq(cardAssets.ownerPlayerId, identity.playerId)).orderBy(cardAssets.defId, cardAssets.id),
    db.select().from(cardCosmeticVariants).where(and(eq(cardCosmeticVariants.status, "published"), eq(cardCosmeticVariants.enabled, true))),
    db.select().from(playerCardCosmeticPreferences).where(eq(playerCardCosmeticPreferences.playerId, identity.playerId)),
  ]);
  const cardById = new Map(allCards().map((card) => [card.defId, card]));
  const variantByKey = new Map(variants.map((variant) => [`${variant.defId}:${variant.variantId}`, variant]));
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const wardrobe = assets.map((asset) => {
    const card = cardById.get(asset.defId);
    const cosmetic = asset.variantId === "standard" ? null : variantByKey.get(`${asset.defId}:${asset.variantId}`) || null;
    return {
      assetId: asset.id,
      defId: asset.defId,
      cardName: card?.name || asset.defId,
      cardRarity: card?.rarity || "Common",
      cardRegion: card?.region || null,
      emoji: card?.emoji || "◇",
      variantId: asset.variantId,
      frameId: asset.frameId,
      finish: asset.finish,
      serialNumber: asset.serialNumber,
      source: asset.source,
      acquiredAt: asset.acquiredAt,
      cosmetic,
    };
  });
  const equipped = preferences.flatMap((preference) => {
    const asset = assetById.get(preference.assetId);
    if (!asset || asset.defId !== preference.defId) return [];
    return [{ defId: preference.defId, assetId: asset.id, variantId: asset.variantId, frameId: asset.frameId, finish: asset.finish, serialNumber: asset.serialNumber }];
  });
  return Response.json({ ok: true, authenticated: true, wardrobe, preferences: equipped });
}

export async function PUT(req: NextRequest) {
  const identity = await getPlayerSession(req);
  if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
  const body = await req.json() as Record<string, unknown>;
  const assetId = Number(body.assetId);
  if (!Number.isInteger(assetId) || assetId < 1) return Response.json({ ok: false, error: "Valid assetId is required" }, { status: 400 });
  const [asset] = await db.select().from(cardAssets).where(and(eq(cardAssets.id, assetId), eq(cardAssets.ownerPlayerId, identity.playerId))).limit(1);
  if (!asset) return Response.json({ ok: false, error: "Collectible copy not owned" }, { status: 404 });
  if (asset.variantId === "standard") {
    await db.delete(playerCardCosmeticPreferences).where(and(eq(playerCardCosmeticPreferences.playerId, identity.playerId), eq(playerCardCosmeticPreferences.defId, asset.defId)));
    return Response.json({ ok: true, preference: { defId: asset.defId, variantId: "standard" } });
  }
  const [variant] = await db.select().from(cardCosmeticVariants).where(and(
    eq(cardCosmeticVariants.defId, asset.defId),
    eq(cardCosmeticVariants.variantId, asset.variantId),
    eq(cardCosmeticVariants.status, "published"),
    eq(cardCosmeticVariants.enabled, true),
  )).limit(1);
  if (!variant) return Response.json({ ok: false, error: "This cosmetic is not currently available for equipping" }, { status: 409 });
  if (variant.frameId !== asset.frameId || variant.finish !== asset.finish) return Response.json({ ok: false, error: "Collectible identity does not match published cosmetic definition" }, { status: 409 });
  const [preference] = await db.insert(playerCardCosmeticPreferences).values({
    playerId: identity.playerId,
    defId: asset.defId,
    assetId: asset.id,
  }).onConflictDoUpdate({
    target: [playerCardCosmeticPreferences.playerId, playerCardCosmeticPreferences.defId],
    set: { assetId: asset.id, updatedAt: new Date() },
  }).returning();
  return Response.json({ ok: true, preference: { ...preference, variantId: asset.variantId, frameId: asset.frameId, finish: asset.finish, serialNumber: asset.serialNumber } });
}

export async function DELETE(req: NextRequest) {
  const identity = await getPlayerSession(req);
  if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
  const defId = String(req.nextUrl.searchParams.get("defId") || "").trim();
  if (!defId) return Response.json({ ok: false, error: "defId is required" }, { status: 400 });
  await db.delete(playerCardCosmeticPreferences).where(and(eq(playerCardCosmeticPreferences.playerId, identity.playerId), eq(playerCardCosmeticPreferences.defId, defId)));
  return Response.json({ ok: true, defId, variantId: "standard" });
}
