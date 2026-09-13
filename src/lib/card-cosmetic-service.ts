import { and, asc, eq, sql } from "drizzle-orm";
import { cardAssets, cardCosmeticVariants } from "@/db/schema";

/**
 * dropWeight is parts-per-million. The unallocated remainder is the implicit
 * Standard appearance, so adding cosmetics never changes the card defId roll.
 */
export async function choosePackCosmetic(tx: any, defId: string, randomValue: number) {
  const rows = await tx.select().from(cardCosmeticVariants).where(and(
    eq(cardCosmeticVariants.defId, defId),
    eq(cardCosmeticVariants.status, "published"),
    eq(cardCosmeticVariants.enabled, true),
    eq(cardCosmeticVariants.packEligible, true),
    eq(cardCosmeticVariants.acquisition, "pack"),
  )).orderBy(asc(cardCosmeticVariants.id));
  const roll = Math.max(0, Math.min(999_999, Math.floor(randomValue * 1_000_000)));
  let cursor = 0;
  for (const row of rows) {
    const weight = Math.max(0, Math.min(1_000_000 - cursor, row.dropWeight));
    cursor += weight;
    if (roll < cursor) return row;
    if (cursor >= 1_000_000) break;
  }
  return null;
}

async function nextSerialNumber(tx: any, defId: string, variantId: string, limit: number) {
  // Stable advisory lock serializes minting for this exact serialized printing.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${defId}:${variantId}`}))`);
  const [row] = await tx.select({ value: sql<number>`coalesce(max(${cardAssets.serialNumber}), 0)` })
    .from(cardAssets)
    .where(and(eq(cardAssets.defId, defId), eq(cardAssets.variantId, variantId)));
  const next = Number(row?.value || 0) + 1;
  return next <= limit ? next : null;
}

export async function createPackCollectibleAsset(
  tx: any,
  playerId: number,
  defId: string,
  source: string,
  randomValue: number,
) {
  const cosmetic = await choosePackCosmetic(tx, defId, randomValue);
  if (!cosmetic) {
    const [asset] = await tx.insert(cardAssets).values({
      ownerPlayerId: playerId,
      defId,
      variantId: "standard",
      frameId: "default",
      finish: "normal",
      tradable: true,
      source,
    }).returning();
    return asset;
  }

  let serialNumber: number | null = null;
  if (cosmetic.kind === "serialized") {
    const limit = cosmetic.serialLimit ?? 0;
    serialNumber = limit > 0 ? await nextSerialNumber(tx, defId, cosmetic.variantId, limit) : null;
    // Exhausted serialized runs fall back to a normal gameplay copy rather
    // than altering pack card count or replacing the rolled card definition.
    if (!serialNumber) {
      const [asset] = await tx.insert(cardAssets).values({
        ownerPlayerId: playerId,
        defId,
        variantId: "standard",
        frameId: "default",
        finish: "normal",
        tradable: true,
        source,
      }).returning();
      return asset;
    }
  }

  const [asset] = await tx.insert(cardAssets).values({
    ownerPlayerId: playerId,
    defId,
    variantId: cosmetic.variantId,
    frameId: cosmetic.frameId,
    finish: cosmetic.finish,
    serialNumber,
    tradable: true,
    source,
  }).returning();
  return asset;
}
