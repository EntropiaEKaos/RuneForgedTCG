import { and, eq, inArray } from "drizzle-orm";
import { cardAssets, cardCosmeticVariants, deckCardPrintingPreferences } from "@/db/schema";

export interface DeckPrintingSelection {
  defId: string;
  assetId: number;
}

export interface DeckPrintingPreferenceDto extends DeckPrintingSelection {
  variantId: string;
  frameId: string;
  finish: string;
  serialNumber: number | null;
}

export class DeckPrintingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeckPrintingValidationError";
  }
}

export function normalizeDeckPrintingSelections(raw: unknown): DeckPrintingSelection[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw new DeckPrintingValidationError("printings must be an array");
  const seen = new Set<string>();
  return raw.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new DeckPrintingValidationError("Invalid deck printing selection");
    const source = entry as Record<string, unknown>;
    const defId = String(source.defId || "").trim();
    const assetId = Number(source.assetId);
    if (!defId || defId.length > 120) throw new DeckPrintingValidationError("A valid printing defId is required");
    if (!Number.isInteger(assetId) || assetId < 1) throw new DeckPrintingValidationError(`A valid assetId is required for ${defId}`);
    if (seen.has(defId)) throw new DeckPrintingValidationError(`Only one printing may be selected for ${defId}`);
    seen.add(defId);
    return { defId, assetId };
  });
}

export async function replaceDeckPrintingPreferences(
  tx: any,
  input: { deckId: number; playerId: number; cards: string[]; printings: unknown },
): Promise<DeckPrintingPreferenceDto[]> {
  const requested = normalizeDeckPrintingSelections(input.printings);
  const allowedDefs = new Set(input.cards);

  for (const selection of requested) {
    if (!allowedDefs.has(selection.defId)) throw new DeckPrintingValidationError(`${selection.defId} is not present in this deck`);
  }

  const resolved: DeckPrintingPreferenceDto[] = [];
  for (const selection of requested) {
    const [asset] = await tx.select().from(cardAssets).where(and(
      eq(cardAssets.id, selection.assetId),
      eq(cardAssets.ownerPlayerId, input.playerId),
    )).limit(1);
    if (!asset || asset.defId !== selection.defId) throw new DeckPrintingValidationError(`Collectible copy for ${selection.defId} is not owned by this player`);

    // Standard is represented by absence of an override. Keeping a physical
    // standard asset out of the preference table also prevents needless ties
    // between deck presentation and a tradable base copy.
    if (asset.variantId === "standard") continue;

    const [variant] = await tx.select().from(cardCosmeticVariants).where(and(
      eq(cardCosmeticVariants.defId, asset.defId),
      eq(cardCosmeticVariants.variantId, asset.variantId),
      eq(cardCosmeticVariants.status, "published"),
      eq(cardCosmeticVariants.enabled, true),
    )).limit(1);
    if (!variant) throw new DeckPrintingValidationError(`${asset.variantId} is not an enabled published printing`);
    if (variant.frameId !== asset.frameId || variant.finish !== asset.finish) {
      throw new DeckPrintingValidationError(`Collectible identity mismatch for ${asset.defId} / ${asset.variantId}`);
    }
    resolved.push({
      defId: asset.defId,
      assetId: asset.id,
      variantId: asset.variantId,
      frameId: asset.frameId,
      finish: asset.finish,
      serialNumber: asset.serialNumber,
    });
  }

  await tx.delete(deckCardPrintingPreferences).where(and(
    eq(deckCardPrintingPreferences.deckId, input.deckId),
    eq(deckCardPrintingPreferences.playerId, input.playerId),
  ));
  if (resolved.length) {
    await tx.insert(deckCardPrintingPreferences).values(resolved.map((row) => ({
      deckId: input.deckId,
      playerId: input.playerId,
      defId: row.defId,
      assetId: row.assetId,
    })));
  }
  return resolved;
}

export async function loadDeckPrintingPreferences(
  query: any,
  playerId: number,
  deckIds: number[],
): Promise<Map<number, DeckPrintingPreferenceDto[]>> {
  const byDeck = new Map<number, DeckPrintingPreferenceDto[]>();
  if (!deckIds.length) return byDeck;
  const rows = await query.select({
    deckId: deckCardPrintingPreferences.deckId,
    defId: deckCardPrintingPreferences.defId,
    assetId: cardAssets.id,
    variantId: cardAssets.variantId,
    frameId: cardAssets.frameId,
    finish: cardAssets.finish,
    serialNumber: cardAssets.serialNumber,
  }).from(deckCardPrintingPreferences)
    .innerJoin(cardAssets, eq(cardAssets.id, deckCardPrintingPreferences.assetId))
    .where(and(
      eq(deckCardPrintingPreferences.playerId, playerId),
      eq(cardAssets.ownerPlayerId, playerId),
      inArray(deckCardPrintingPreferences.deckId, deckIds),
    ));

  for (const row of rows as Array<DeckPrintingPreferenceDto & { deckId: number }>) {
    const list = byDeck.get(row.deckId) ?? [];
    list.push({
      defId: row.defId,
      assetId: row.assetId,
      variantId: row.variantId,
      frameId: row.frameId,
      finish: row.finish,
      serialNumber: row.serialNumber,
    });
    byDeck.set(row.deckId, list);
  }
  return byDeck;
}
