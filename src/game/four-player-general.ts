import { getCard } from "./cards";
import { validateDeck, type DeckRules } from "./decks";
import { cardRegions } from "./region-identity";
import type { Race, Region } from "./types";

/** Isolated mode id. Existing 1v1 callers never opt into these rules implicitly. */
export const FOUR_PLAYER_GENERAL_MODE = "four_player_general" as const;
export type FourPlayerGeneralModeId = typeof FOUR_PLAYER_GENERAL_MODE;

export const FOUR_PLAYER_SEATS = ["p1", "p2", "p3", "p4"] as const;
export type FourPlayerSeat = (typeof FOUR_PLAYER_SEATS)[number];

export const FOUR_PLAYER_MAIN_DECK_SIZE = 80;
export const FOUR_PLAYER_MAX_COPIES = 2;
export const GENERAL_RECAST_TAX = 2;

/**
 * Region limit remains explicit for the first engineering slice. General identity
 * may tighten it later; this must not mutate the runtime rules used by 1v1.
 */
export const FOUR_PLAYER_DECK_RULES: DeckRules = {
  deckMin: FOUR_PLAYER_MAIN_DECK_SIZE,
  deckMax: FOUR_PLAYER_MAIN_DECK_SIZE,
  maxCopies: FOUR_PLAYER_MAX_COPIES,
  maxRegions: 3,
};

export interface GeneralIdentity {
  regions: readonly Region[];
  races?: readonly Race[];
  classKeys?: readonly string[];
}

export interface GeneralDefinition {
  defId: string;
  identity: GeneralIdentity;
}

export interface FourPlayerGeneralDeck {
  cards: string[];
  general: GeneralDefinition;
}

export interface FourPlayerDeckValidation {
  ok: boolean;
  errors: string[];
  regions: Region[];
}

function isSubset<T>(values: readonly T[], allowed: readonly T[]): boolean {
  const set = new Set(allowed);
  return values.every((value) => set.has(value));
}

/**
 * V0 contract: exactly 80 main-deck cards + one public General.
 * This intentionally composes the existing validator with explicit rules rather
 * than changing validateDeck() defaults, preserving current 1v1 behavior.
 */
export function validateFourPlayerGeneralDeck(deck: FourPlayerGeneralDeck): FourPlayerDeckValidation {
  const base = validateDeck(deck.cards, FOUR_PLAYER_DECK_RULES);
  const errors = [...base.errors];

  if (!deck.general?.defId) {
    errors.push("A General is required.");
    return { ok: false, errors, regions: base.regions };
  }

  let generalCard;
  try {
    generalCard = getCard(deck.general.defId);
  } catch {
    errors.push(`Unknown General: ${deck.general.defId}`);
    return { ok: false, errors, regions: base.regions };
  }

  if (generalCard.collectible === false) {
    errors.push(`${generalCard.name} cannot be used as a General.`);
  }

  const identityRegions = [...deck.general.identity.regions];
  if (identityRegions.length === 0) errors.push("General identity must contain at least one region.");
  if (identityRegions.length > 3) errors.push("General identity supports at most 3 regions in v0.");

  const actualGeneralRegions = cardRegions(generalCard);
  if (!isSubset(actualGeneralRegions, identityRegions)) {
    errors.push("General card regions must be contained in its declared identity.");
  }

  if (!isSubset(base.regions, identityRegions)) {
    errors.push("Every main-deck region must be allowed by the General identity.");
  }

  return { ok: errors.length === 0, errors, regions: base.regions };
}

export interface FourPlayerSeatState {
  seat: FourPlayerSeat;
  eliminated: boolean;
  generalCastsFromZone: number;
}

export function generalRecastTax(state: Pick<FourPlayerSeatState, "generalCastsFromZone">): number {
  return Math.max(0, state.generalCastsFromZone) * GENERAL_RECAST_TAX;
}
