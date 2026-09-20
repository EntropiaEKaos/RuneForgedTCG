import { COMMANDER_ALPHA_RULES, validateCommanderDeck } from "@/lib/commander-rules";
import type { Race, Region } from "./types";

/** Isolated combat-engine mode id. Existing 1v1 callers never opt into these rules implicitly. */
export const FOUR_PLAYER_GENERAL_MODE = "four_player_general" as const;
export type FourPlayerGeneralModeId = typeof FOUR_PLAYER_GENERAL_MODE;

export const FOUR_PLAYER_SEATS = ["p1", "p2", "p3", "p4"] as const;
export type FourPlayerSeat = (typeof FOUR_PLAYER_SEATS)[number];

export const FOUR_PLAYER_MAIN_DECK_SIZE = COMMANDER_ALPHA_RULES.deckSize;
export const FOUR_PLAYER_MAX_COPIES = COMMANDER_ALPHA_RULES.maxCopiesPerCard;
export const GENERAL_RECAST_TAX = 2;

/**
 * Compatibility descriptor for recovered #209 tests/tools.
 * Authoritative loadout validation delegates to the certified Commander rule contract.
 */
export const FOUR_PLAYER_DECK_RULES = {
  deckMin: FOUR_PLAYER_MAIN_DECK_SIZE,
  deckMax: FOUR_PLAYER_MAIN_DECK_SIZE,
  maxCopies: FOUR_PLAYER_MAX_COPIES,
  maxRegions: 6,
} as const;

export interface GeneralIdentity {
  regions: readonly Region[];
  races?: readonly Race[];
  classKeys?: readonly string[];
}

export interface GeneralDefinition {
  defId: string;
  identity?: GeneralIdentity;
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

/**
 * Current Commander contract: exactly 60 cards + one separate Champion/Legend General,
 * max 3 copies per main-deck card. This delegates to the already-certified server rule
 * validator instead of restoring the historical 80+1 / two-copy prototype.
 */
export function validateFourPlayerGeneralDeck(deck: FourPlayerGeneralDeck): FourPlayerDeckValidation {
  if (!deck.general?.defId) {
    return { ok: false, errors: ["A General is required."], regions: [] };
  }

  const current = validateCommanderDeck(deck.cards, deck.general.defId);
  const errors = [...current.errors];
  const regions = [...current.regions] as Region[];

  // Historical identity metadata can further restrict a recovered fixture, but it can
  // never loosen the current certified Commander validator.
  const allowed = deck.general.identity?.regions;
  if (allowed?.length) {
    const set = new Set<Region>(allowed);
    if (!regions.every((region) => set.has(region))) {
      errors.push("Every main-deck region must be allowed by the declared General identity.");
    }
  }

  return { ok: errors.length === 0, errors, regions };
}

export interface FourPlayerSeatState {
  seat: FourPlayerSeat;
  eliminated: boolean;
  generalCastsFromZone: number;
}

export function generalRecastTax(state: Pick<FourPlayerSeatState, "generalCastsFromZone">): number {
  return Math.max(0, state.generalCastsFromZone) * GENERAL_RECAST_TAX;
}
