import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { cardAssets, cardCosmeticVariants } from "@/db/schema";

export type DeckAppearanceAssets = Record<string, number>;

export function normalizeDeckAppearanceAssets(raw: unknown, cards: string[]): DeckAppearanceAssets {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const allowed = new Set(cards);
  const normalized: DeckAppearanceAssets = {};
  for (const [defId, value] of Object.entries(raw as Record<string, unknown>)) {
    const assetId = Number(value);
    if (!allowed.has(defId) || !Number.isInteger(assetId) || assetId <= 0) continue;
    normalized[defId] = assetId;
  }
  return normalized;
}

export async function validateOwnedDeckAppearanceAssets(
  playerId: number,
  cards: string[],
  raw: unknown,
): Promise<{ ok: true; value: DeckAppearanceAssets } | { ok: false; error: string }> {
  const value = normalizeDeckAppearanceAssets(raw, cards);
  const ids = [...new Set(Object.values(value))];
  if (!ids.length) return { ok: true, value };

  const assets = await db.select({
    id: cardAssets.id,
    defId: cardAssets.defId,
    variantId: cardAssets.variantId,
  }).from(cardAssets).where(and(
    eq(cardAssets.ownerPlayerId, playerId),
    inArray(cardAssets.id, ids),
  ));
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  if (byId.size !== ids.length) return { ok: false, error: "Deck appearance references a collectible copy you do not own." };

  for (const [defId, assetId] of Object.entries(value)) {
    if (byId.get(assetId)?.defId !== defId) {
      return { ok: false, error: "Deck appearance asset does not match its gameplay card." };
    }
  }

  const special = assets.filter((asset) => asset.variantId !== "standard");
  if (special.length) {
    const published = await db.select({
      defId: cardCosmeticVariants.defId,
      variantId: cardCosmeticVariants.variantId,
    }).from(cardCosmeticVariants).where(and(
      eq(cardCosmeticVariants.status, "published"),
      eq(cardCosmeticVariants.enabled, true),
    ));
    const available = new Set(published.map((variant) => `${variant.defId}:${variant.variantId}`));
    if (special.some((asset) => !available.has(`${asset.defId}:${asset.variantId}`))) {
      return { ok: false, error: "Deck appearance references an unavailable cosmetic printing." };
    }
  }

  return { ok: true, value };
}
