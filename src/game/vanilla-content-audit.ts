import { baseCardsOnly } from "./cards";
import { REGION_ORDER, cardRegions } from "./region-identity";
import type { CardDef, Region } from "./types";
import { VANILLA_EXPERIMENTAL_DECKS } from "./vanilla-experimental-decks";

export const VANILLA_CONTENT_BASELINE_VERSION = "1.0";
export const VANILLA_CODE_AUTHORED_CARD_BASELINE = 456;
export const VANILLA_EXPERIMENTAL_WAVE_BASELINE = 180;
export const VANILLA_EXPERIMENTAL_DECK_BASELINE = 12;
export const VANILLA_EXPERIMENTAL_DECK_SIZE = 40;

export interface VanillaDeckAudit {
  id: string;
  name: string;
  regions: readonly Region[];
  cards: number;
  uniqueCards: number;
  averageCost: number;
  manaCurve: Record<string, number>;
  types: Record<string, number>;
  duplicateCopies: Record<string, number>;
  errors: string[];
}

export interface VanillaContentAuditReport {
  version: string;
  totalCards: number;
  collectibleCards: number;
  experimentalWaveCards: number;
  experimentalDecks: number;
  experimentalUniqueCards: number;
  uncoveredExperimentalCardIds: string[];
  regions: Record<string, number>;
  types: Record<string, number>;
  rarities: Record<string, number>;
  identityTiers: Record<string, number>;
  semanticArchetypes: Record<string, number>;
  regionDeckCounts: Record<string, number>;
  decks: VanillaDeckAudit[];
  errors: string[];
  gate: "pass" | "blocked";
}

function increment(target: Record<string, number>, key: string, amount = 1): void {
  target[key] = (target[key] ?? 0) + amount;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function costBucket(cost: number): string {
  if (cost <= 1) return "0-1";
  if (cost >= 7) return "7+";
  return String(cost);
}

function identityTier(card: CardDef): "mono" | "dual" | "triple" {
  const count = cardRegions(card).length;
  if (count >= 3) return "triple";
  if (count === 2) return "dual";
  return "mono";
}

export function buildVanillaContentAudit(): VanillaContentAuditReport {
  const allCards = baseCardsOnly();
  const cardById = new Map(allCards.map((card) => [card.defId, card] as const));
  const experimentalWave = allCards.filter((card) => card.defId.startsWith("van_"));

  const regions: Record<string, number> = {};
  const types: Record<string, number> = {};
  const rarities: Record<string, number> = {};
  const identityTiers: Record<string, number> = {};
  const semanticArchetypes: Record<string, number> = {};

  for (const card of allCards) {
    increment(regions, card.region);
    increment(types, card.type);
    increment(rarities, card.rarity);
    increment(identityTiers, identityTier(card));
    if (card.archetypeKey) increment(semanticArchetypes, card.archetypeKey);
  }

  const deckAudits: VanillaDeckAudit[] = [];
  const regionDeckCounts: Record<string, number> = Object.fromEntries(REGION_ORDER.map((region) => [region, 0]));
  const experimentalUsed = new Set<string>();
  const errors: string[] = [];

  for (const deck of VANILLA_EXPERIMENTAL_DECKS) {
    const deckErrors: string[] = [];
    const copies = new Map<string, number>();
    const deckTypes: Record<string, number> = {};
    const manaCurve: Record<string, number> = {};
    let totalCost = 0;

    if (deck.cards.length !== VANILLA_EXPERIMENTAL_DECK_SIZE) {
      deckErrors.push(`${deck.id}: expected ${VANILLA_EXPERIMENTAL_DECK_SIZE} cards, found ${deck.cards.length}`);
    }
    if (deck.regions.length < 1 || deck.regions.length > 3) {
      deckErrors.push(`${deck.id}: invalid region identity width ${deck.regions.length}`);
    }
    for (const region of deck.regions) increment(regionDeckCounts, region);

    for (const defId of deck.cards) {
      copies.set(defId, (copies.get(defId) ?? 0) + 1);
      const card = cardById.get(defId);
      if (!card) {
        deckErrors.push(`${deck.id}: unknown card ${defId}`);
        continue;
      }
      experimentalUsed.add(defId);
      totalCost += card.cost;
      increment(deckTypes, card.type);
      increment(manaCurve, costBucket(card.cost));

      const incompatible = cardRegions(card).filter((region) => !deck.regions.includes(region));
      if (incompatible.length) {
        deckErrors.push(`${deck.id}: ${defId} requires ${incompatible.join(", ")} outside deck identity`);
      }
    }

    const duplicateCopies: Record<string, number> = {};
    for (const [defId, count] of copies) {
      if (count > 1) duplicateCopies[defId] = count;
      if (count > 3) deckErrors.push(`${deck.id}: ${defId} has ${count} copies (max 3)`);
    }

    const audit: VanillaDeckAudit = {
      id: deck.id,
      name: deck.name,
      regions: deck.regions,
      cards: deck.cards.length,
      uniqueCards: copies.size,
      averageCost: round2(totalCost / Math.max(1, deck.cards.length)),
      manaCurve,
      types: deckTypes,
      duplicateCopies,
      errors: deckErrors,
    };
    deckAudits.push(audit);
    errors.push(...deckErrors);
  }

  const uncoveredExperimentalCardIds = experimentalWave
    .map((card) => card.defId)
    .filter((defId) => !experimentalUsed.has(defId))
    .sort();

  if (allCards.length !== VANILLA_CODE_AUTHORED_CARD_BASELINE) {
    errors.push(`Vanilla code-authored baseline changed: expected ${VANILLA_CODE_AUTHORED_CARD_BASELINE}, found ${allCards.length}`);
  }
  if (experimentalWave.length !== VANILLA_EXPERIMENTAL_WAVE_BASELINE) {
    errors.push(`Vanilla experimental wave changed: expected ${VANILLA_EXPERIMENTAL_WAVE_BASELINE}, found ${experimentalWave.length}`);
  }
  if (VANILLA_EXPERIMENTAL_DECKS.length !== VANILLA_EXPERIMENTAL_DECK_BASELINE) {
    errors.push(`Vanilla experimental deck pool changed: expected ${VANILLA_EXPERIMENTAL_DECK_BASELINE}, found ${VANILLA_EXPERIMENTAL_DECKS.length}`);
  }
  if (uncoveredExperimentalCardIds.length) {
    errors.push(`Experimental wave has ${uncoveredExperimentalCardIds.length} cards outside the 12-deck intake pool`);
  }
  for (const region of REGION_ORDER) {
    if ((regionDeckCounts[region] ?? 0) !== 2) {
      errors.push(`${region}: expected exactly 2 experimental archetypes, found ${regionDeckCounts[region] ?? 0}`);
    }
  }

  return {
    version: VANILLA_CONTENT_BASELINE_VERSION,
    totalCards: allCards.length,
    collectibleCards: allCards.filter((card) => card.collectible !== false).length,
    experimentalWaveCards: experimentalWave.length,
    experimentalDecks: VANILLA_EXPERIMENTAL_DECKS.length,
    experimentalUniqueCards: experimentalUsed.size,
    uncoveredExperimentalCardIds,
    regions,
    types,
    rarities,
    identityTiers,
    semanticArchetypes,
    regionDeckCounts,
    decks: deckAudits,
    errors,
    gate: errors.length ? "blocked" : "pass",
  };
}
