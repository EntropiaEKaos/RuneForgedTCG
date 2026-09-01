import type { DeckInput, Region } from "./types";
import { VANILLA_EXPERIMENTAL_DECKS } from "./vanilla-experimental-decks";
import { buildVanillaContentAudit } from "./vanilla-content-audit";

export const VANILLA_BALANCE_LAB_VERSION = "1.1";
export const VANILLA_BALANCE_LAB_DECKS = 12;
export const VANILLA_BALANCE_LAB_MATCHUPS = 66;
export const VANILLA_BALANCE_STRATUM_BASES = [
  401_003,
  809_017,
  1_307_033,
  2_003_047,
  3_001_061,
  4_009_081,
  5_003_099,
  7_001_117,
] as const;

export interface VanillaBalanceMatchup {
  leftId: string;
  rightId: string;
  leftIndex: number;
  rightIndex: number;
  leftRegion: Region;
  rightRegion: Region;
  sameRegion: boolean;
}

export function vanillaExperimentalOverrides(): Record<string, DeckInput> {
  return Object.fromEntries(
    VANILLA_EXPERIMENTAL_DECKS.map((deck) => [
      deck.id,
      { id: deck.id, name: deck.name, cards: [...deck.cards] },
    ]),
  );
}

export function vanillaBalanceMatchups(): VanillaBalanceMatchup[] {
  const rows: VanillaBalanceMatchup[] = [];
  for (let leftIndex = 0; leftIndex < VANILLA_EXPERIMENTAL_DECKS.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < VANILLA_EXPERIMENTAL_DECKS.length; rightIndex += 1) {
      const left = VANILLA_EXPERIMENTAL_DECKS[leftIndex];
      const right = VANILLA_EXPERIMENTAL_DECKS[rightIndex];
      rows.push({
        leftId: left.id,
        rightId: right.id,
        leftIndex,
        rightIndex,
        leftRegion: left.regions[0],
        rightRegion: right.regions[0],
        sameRegion: left.regions[0] === right.regions[0],
      });
    }
  }
  return rows;
}

export function vanillaBalanceSeed(matchup: VanillaBalanceMatchup, stratum: number): number {
  const base = VANILLA_BALANCE_STRATUM_BASES[stratum];
  if (base === undefined) throw new Error(`Vanilla Balance Lab stratum ${stratum} is outside the certified seed table`);
  return base + matchup.leftIndex * 1_009 + matchup.rightIndex * 97;
}

export function validateVanillaBalancePool(): string[] {
  const errors: string[] = [];
  const content = buildVanillaContentAudit();
  if (content.gate !== "pass") errors.push(...content.errors.map((error) => `content baseline: ${error}`));
  if (VANILLA_EXPERIMENTAL_DECKS.length !== VANILLA_BALANCE_LAB_DECKS) {
    errors.push(`expected ${VANILLA_BALANCE_LAB_DECKS} experimental decks, found ${VANILLA_EXPERIMENTAL_DECKS.length}`);
  }
  const ids = VANILLA_EXPERIMENTAL_DECKS.map((deck) => deck.id);
  if (new Set(ids).size !== ids.length) errors.push("experimental Balance Lab deck IDs must be unique");
  const matchups = vanillaBalanceMatchups();
  if (matchups.length !== VANILLA_BALANCE_LAB_MATCHUPS) {
    errors.push(`expected ${VANILLA_BALANCE_LAB_MATCHUPS} pairwise matchups, found ${matchups.length}`);
  }
  const sameRegion = matchups.filter((row) => row.sameRegion).length;
  if (sameRegion !== 6) errors.push(`expected 6 same-region matchups, found ${sameRegion}`);
  return errors;
}
