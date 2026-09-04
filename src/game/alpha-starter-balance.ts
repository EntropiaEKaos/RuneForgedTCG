import { getDeck, validateDeck } from "./decks";
import { SEMANTIC_ALPHA_CARDS } from "./cards/semantic-alpha";

export const ALPHA_STARTER_BALANCE_VERSION = "1.0";

export const ALPHA_STARTER_IDS = [
  "ember_aggro",
  "tide_control",
  "wood_midrange",
  "void_shadow",
  "florestia_tribal",
  "tempestade_rush",
] as const;

export type AlphaStarterId = (typeof ALPHA_STARTER_IDS)[number];

export const ALPHA_STARTER_BALANCE_MATCHUPS = 15;

/**
 * Independent deterministic seed strata for the Alpha starter matrix.
 * These are intentionally separate from the historical Vanilla Balance Lab
 * seed table so both experiments remain reproducible without hidden coupling.
 */
export const ALPHA_STARTER_BALANCE_STRATUM_BASES = [
  11_000_003,
  13_000_019,
  17_000_039,
  19_000_051,
  23_000_069,
  29_000_083,
  31_000_103,
  37_000_117,
] as const;

export interface AlphaStarterBalanceMatchup {
  leftId: AlphaStarterId;
  rightId: AlphaStarterId;
  leftIndex: number;
  rightIndex: number;
}

export function alphaStarterBalanceMatchups(): AlphaStarterBalanceMatchup[] {
  const rows: AlphaStarterBalanceMatchup[] = [];
  for (let leftIndex = 0; leftIndex < ALPHA_STARTER_IDS.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < ALPHA_STARTER_IDS.length; rightIndex += 1) {
      rows.push({
        leftId: ALPHA_STARTER_IDS[leftIndex],
        rightId: ALPHA_STARTER_IDS[rightIndex],
        leftIndex,
        rightIndex,
      });
    }
  }
  return rows;
}

export function alphaStarterBalanceSeed(matchup: AlphaStarterBalanceMatchup, stratum: number): number {
  const base = ALPHA_STARTER_BALANCE_STRATUM_BASES[stratum];
  if (base === undefined) {
    throw new Error(`Alpha starter balance stratum ${stratum} is outside the certified seed table`);
  }
  return base + matchup.leftIndex * 1_009 + matchup.rightIndex * 97;
}

export function validateAlphaStarterBalancePool(): string[] {
  const errors: string[] = [];
  if (ALPHA_STARTER_IDS.length !== 6) errors.push(`expected 6 Alpha starters, found ${ALPHA_STARTER_IDS.length}`);
  if (new Set(ALPHA_STARTER_IDS).size !== ALPHA_STARTER_IDS.length) errors.push("Alpha starter IDs must be unique");

  for (const id of ALPHA_STARTER_IDS) {
    const deck = getDeck(id);
    if (deck.cards.length !== 40) errors.push(`${id}: expected 40 cards, found ${deck.cards.length}`);
    const legality = validateDeck(deck.cards);
    if (!legality.ok) errors.push(`${id}: illegal deck — ${legality.errors.join(" | ")}`);

    const semanticCards = deck.cards.filter((defId) => defId in SEMANTIC_ALPHA_CARDS);
    if (semanticCards.length !== 3) {
      errors.push(`${id}: expected exactly 3 semantic teaching cards, found ${semanticCards.length}`);
    }
  }

  const matchups = alphaStarterBalanceMatchups();
  if (matchups.length !== ALPHA_STARTER_BALANCE_MATCHUPS) {
    errors.push(`expected ${ALPHA_STARTER_BALANCE_MATCHUPS} pairwise matchups, found ${matchups.length}`);
  }

  const pairs = matchups.map((row) => `${row.leftId}::${row.rightId}`);
  if (new Set(pairs).size !== pairs.length) errors.push("Alpha starter matchup pairs must be unique");
  if (pairs.some((pair) => pair.includes("convergence_"))) {
    errors.push("advanced Convergence presets must remain outside the Alpha starter balance matrix");
  }

  return errors;
}
