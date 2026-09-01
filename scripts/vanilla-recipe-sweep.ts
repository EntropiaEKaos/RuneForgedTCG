import fs from "node:fs";
import { estimateCardPower, evaluateMatchup } from "../src/game/balance-health";
import { getCard } from "../src/game/cards";
import {
  VANILLA_BALANCE_STRATUM_BASES,
  vanillaBalanceMatchups,
  vanillaBalanceSeed,
  vanillaExperimentalOverrides,
} from "../src/game/vanilla-balance-lab";
import { VANILLA_EXPERIMENTAL_DECKS } from "../src/game/vanilla-experimental-decks";
import { runBalanceSimulation } from "../src/lib/balance-simulator";
import type { DeckInput } from "../src/game/types";

const gamesPerStratum = Math.max(10, Math.min(50, Number(process.argv[2]) || 10));
const strata = Math.max(3, Math.min(VANILLA_BALANCE_STRATUM_BASES.length, Number(process.argv[3]) || 3));
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";

const ascendants = VANILLA_EXPERIMENTAL_DECKS.filter((deck) => deck.id.endsWith("_2"));
const baseOverrides = vanillaExperimentalOverrides();

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function uniqueRegionalCards(deckId: string): string[] {
  const deck = VANILLA_EXPERIMENTAL_DECKS.find((candidate) => candidate.id === deckId);
  if (!deck) throw new Error(`Missing deck ${deckId}`);
  const prefix = deck.cards[0].replace(/_(?:u|s|e|a|q)\d+$/, "");
  const units = Array.from({ length: 18 }, (_, index) => `${prefix}_u${String(index + 1).padStart(2, "0")}`);
  const spells = Array.from({ length: 8 }, (_, index) => `${prefix}_s${String(index + 1).padStart(2, "0")}`);
  return [...units, ...spells, `${prefix}_e01`, `${prefix}_e02`, `${prefix}_a01`, `${prefix}_q01`];
}

function ids(deckId: string, suffixes: string[]): string[] {
  const deck = VANILLA_EXPERIMENTAL_DECKS.find((candidate) => candidate.id === deckId)!;
  const prefix = deck.cards[0].replace(/_(?:u|s|e|a|q)\d+$/, "");
  return suffixes.map((suffix) => `${prefix}_${suffix}`);
}

function powerAwareDuplicates(deckId: string): string[] {
  const all = uniqueRegionalCards(deckId);
  const units = all.filter((defId) => defId.includes("_u"));
  const cheap = units
    .filter((defId) => getCard(defId).cost <= 3)
    .sort((a, b) => {
      const left = estimateCardPower(getCard(a));
      const right = estimateCardPower(getCard(b));
      return right.delta - left.delta || getCard(a).cost - getCard(b).cost || a.localeCompare(b);
    })
    .slice(0, 6);
  const value = all
    .filter((defId) => !cheap.includes(defId))
    .filter((defId) => getCard(defId).cost <= 5)
    .filter((defId) => !defId.endsWith("_s01") && !defId.endsWith("_s02"))
    .sort((a, b) => {
      const left = estimateCardPower(getCard(a));
      const right = estimateCardPower(getCard(b));
      const leftScore = left.delta - getCard(a).cost * 0.2;
      const rightScore = right.delta - getCard(b).cost * 0.2;
      return rightScore - leftScore || a.localeCompare(b);
    });
  return [...cheap, ...value].slice(0, 10);
}

const policies: Record<string, (deckId: string) => string[]> = {
  curve: (deckId) => ids(deckId, ["u01", "u02", "u03", "u04", "u05", "u06", "u07", "u08", "s01", "s02"]),
  engines: (deckId) => ids(deckId, ["u01", "u02", "u03", "u04", "u05", "u06", "u07", "u08", "e01", "e02"]),
  midrange: (deckId) => ids(deckId, ["u01", "u02", "u03", "u04", "u05", "u06", "u09", "u10", "e01", "e02"]),
  powerAware: powerAwareDuplicates,
};

function recipe(deckId: string, duplicateIds: string[]): DeckInput {
  const source = VANILLA_EXPERIMENTAL_DECKS.find((candidate) => candidate.id === deckId)!;
  const unique = uniqueRegionalCards(deckId);
  if (unique.length !== 30 || duplicateIds.length !== 10 || new Set(duplicateIds).size !== 10) {
    throw new Error(`${deckId}: invalid sweep recipe cardinality`);
  }
  const cards = [...unique, ...duplicateIds];
  return { id: source.id, name: source.name, cards };
}

function aggregateCandidate(deckId: string, duplicateIds: string[]) {
  const overrides: Record<string, DeckInput> = { ...baseOverrides, [deckId]: recipe(deckId, duplicateIds) };
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let completedGames = 0;
  let sameRegionWins = 0;
  let sameRegionLosses = 0;
  let healthy = 0;
  let watch = 0;
  let critical = 0;
  const matchupRates: Array<{ opponent: string; winRate: number; sameRegion: boolean; health: string }> = [];

  for (const matchup of vanillaBalanceMatchups().filter((row) => row.leftId === deckId || row.rightId === deckId)) {
    let matchupWins = 0;
    let matchupLosses = 0;
    let matchupDraws = 0;
    for (let stratum = 0; stratum < strata; stratum += 1) {
      const summary = runBalanceSimulation(
        matchup.leftId,
        matchup.rightId,
        gamesPerStratum,
        vanillaBalanceSeed(matchup, stratum),
        overrides,
      );
      const asLeft = matchup.leftId === deckId;
      matchupWins += asLeft ? summary.winsA : summary.winsB;
      matchupLosses += asLeft ? summary.winsB : summary.winsA;
      matchupDraws += summary.draws;
    }
    const decisive = Math.max(1, matchupWins + matchupLosses);
    const rate = round1((matchupWins / decisive) * 100);
    const health = evaluateMatchup(rate).status;
    if (health === "healthy") healthy += 1;
    else if (health === "watch") watch += 1;
    else critical += 1;
    matchupRates.push({
      opponent: matchup.leftId === deckId ? matchup.rightId : matchup.leftId,
      winRate: rate,
      sameRegion: matchup.sameRegion,
      health,
    });
    wins += matchupWins;
    losses += matchupLosses;
    draws += matchupDraws;
    completedGames += matchupWins + matchupLosses + matchupDraws;
    if (matchup.sameRegion) {
      sameRegionWins += matchupWins;
      sameRegionLosses += matchupLosses;
    }
  }

  const decisive = Math.max(1, wins + losses);
  const sameDecisive = Math.max(1, sameRegionWins + sameRegionLosses);
  const avgDuplicateCost = round1(duplicateIds.reduce((sum, defId) => sum + getCard(defId).cost, 0) / duplicateIds.length);
  const avgRecipeCost = round1(recipe(deckId, duplicateIds).cards.reduce((sum, defId) => sum + getCard(defId).cost, 0) / 40);
  const winRate = round1((wins / decisive) * 100);
  const distanceFromParity = Math.abs(winRate - 50);
  const sameRegionWinRate = round1((sameRegionWins / sameDecisive) * 100);
  const lowCurveDuplicates = duplicateIds.filter((defId) => getCard(defId).cost <= 3).length;
  const score = round1(
    100
    - distanceFromParity * 2
    - critical * 4
    - watch * 1.5
    - Math.max(0, 35 - sameRegionWinRate) * 1.5
    - Math.max(0, avgRecipeCost - 3.8) * 10
    - Math.max(0, 5 - lowCurveDuplicates) * 3,
  );
  return {
    deckId,
    duplicateIds,
    avgDuplicateCost,
    avgRecipeCost,
    lowCurveDuplicates,
    completedGames,
    wins,
    losses,
    draws,
    winRate,
    sameRegionWinRate,
    matchupHealth: { healthy, watch, critical },
    score,
    matchupRates,
  };
}

const results = ascendants.flatMap((deck) =>
  Object.entries(policies).map(([policy, buildDuplicates]) => ({
    policy,
    ...aggregateCandidate(deck.id, buildDuplicates(deck.id)),
  })),
);

const winners = ascendants.map((deck) => {
  const candidates = results.filter((row) => row.deckId === deck.id).sort((a, b) => b.score - a.score || a.policy.localeCompare(b.policy));
  return { deckId: deck.id, selected: candidates[0], candidates };
});

const report = {
  methodology: "Recipe-only deterministic sweep. Each Ascendant keeps one copy of all 30 regional cards plus 10 policy-selected duplicates; candidate faces all 11 other current experimental decks using certified Balance Lab seeds.",
  gamesPerStratum,
  strata,
  gamesPerCandidateMatchup: gamesPerStratum * strata,
  candidatesPerDeck: Object.keys(policies).length,
  totalSimulatedGames: results.reduce((sum, row) => sum + row.completedGames, 0),
  winners,
};

const json = JSON.stringify(report, null, 2);
if (writePath) fs.writeFileSync(writePath, `${json}\n`);
console.log(json);
