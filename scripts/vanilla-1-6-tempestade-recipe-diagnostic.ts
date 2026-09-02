import fs from "node:fs";
import { evaluateMatchup } from "../src/game/balance-health";
import { getCard } from "../src/game/cards";
import {
  VANILLA_BALANCE_STRATUM_BASES,
  vanillaBalanceMatchups,
  vanillaBalanceSeed,
  vanillaExperimentalOverrides,
} from "../src/game/vanilla-balance-lab";
import { VANILLA_EXPERIMENTAL_DECKS } from "../src/game/vanilla-experimental-decks";
import { runBalanceSimulation, type SimulationSummary } from "../src/lib/balance-simulator";

const TARGET_ID = "vanilla_storm_1";
const GAMES = Math.max(10, Math.min(80, Number(process.argv[2]) || 16));
const STRATA = Math.max(3, Math.min(5, Number(process.argv[3]) || 3));
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";
if (STRATA > VANILLA_BALANCE_STRATUM_BASES.length) throw new Error("strata outside seed table");

const baseOverrides = vanillaExperimentalOverrides();
const targetBase = baseOverrides[TARGET_ID];
if (!targetBase) throw new Error(`${TARGET_ID} missing from Balance Lab overrides`);
const matchups = vanillaBalanceMatchups().filter((row) => row.leftId === TARGET_ID || row.rightId === TARGET_ID);
if (matchups.length !== 11) throw new Error(`expected 11 Tempestade Vanguard matchups, found ${matchups.length}`);

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
function pct(n: number, d: number): number {
  return round1((n / Math.max(1, d)) * 100);
}
function copies(ids: string[], count = 2): string[] {
  return ids.flatMap((id) => Array(count).fill(id));
}
function range(prefix: string, from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, index) => `${prefix}${String(from + index).padStart(2, "0")}`);
}
function singletonize(base: string[], singletonIds: readonly string[]): string[] {
  const singletonSet = new Set(singletonIds);
  return base.flatMap((id) => (singletonSet.has(id) ? [id] : [id, id]));
}
function assertRecipe(name: string, cards: string[]): void {
  if (cards.length !== 40) throw new Error(`${name}: expected 40 cards, found ${cards.length}`);
  const counts = new Map<string, number>();
  for (const defId of cards) {
    getCard(defId);
    counts.set(defId, (counts.get(defId) ?? 0) + 1);
  }
  for (const [defId, count] of counts) {
    if (count > 2) throw new Error(`${name}: ${defId} has ${count} copies`);
  }
}

const units = range("van_storm_u", 1, 18);
const u01u16 = units.slice(0, 16);
const u01u14 = units.slice(0, 14);
const u15u18 = units.slice(14);
const s01 = "van_storm_s01";
const s02 = "van_storm_s02";
const s03 = "van_storm_s03";
const s04 = "van_storm_s04";
const s05 = "van_storm_s05";
const s06 = "van_storm_s06";
const s07 = "van_storm_s07";
const s08 = "van_storm_s08";

const recipes = [
  {
    name: "baseline_36u4s",
    rationale: "Historical Vanguard contract: every Unit duplicated, plus two copies each of s01/s02.",
    cards: [...copies(units), s01, s01, s02, s02],
  },
  {
    name: "topend34_bounce",
    rationale: "Only u17/u18 become singletons; add two s05 bounce tools.",
    cards: [...copies(u01u16), "van_storm_u17", "van_storm_u18", s01, s01, s02, s02, s05, s05],
  },
  {
    name: "topend32_control",
    rationale: "u15-u18 become singletons; add bounce and Barrier instead of duplicated top-end.",
    cards: [...copies(u01u14), ...u15u18, s01, s01, s02, s02, s05, s05, s06, s06],
  },
  {
    name: "topend32_removal",
    rationale: "u15-u18 become singletons; add bounce and expensive single-target removal.",
    cards: [...copies(u01u14), ...u15u18, s01, s01, s02, s02, s05, s05, s08, s08],
  },
  {
    name: "pressure32_core",
    rationale: "Keep all 18 Units but singletonize u03/u05/u08/u13, reducing the densest early/mid pressure package.",
    cards: [
      ...singletonize(units, ["van_storm_u03", "van_storm_u05", "van_storm_u08", "van_storm_u13"]),
      s01, s01, s02, s02, s05, s05, s06, s06,
    ],
  },
  {
    name: "evasion32",
    rationale: "Singletonize u03/u05/u08/u11 to reduce repeated Elusive/Flying pressure and draw density.",
    cards: [
      ...singletonize(units, ["van_storm_u03", "van_storm_u05", "van_storm_u08", "van_storm_u11"]),
      s01, s01, s02, s02, s05, s05, s06, s06,
    ],
  },
  {
    name: "air32",
    rationale: "Singletonize u02/u08/u14/u18 to lower repeated Flying pressure across the curve.",
    cards: [
      ...singletonize(units, ["van_storm_u02", "van_storm_u08", "van_storm_u14", "van_storm_u18"]),
      s01, s01, s02, s02, s05, s05, s06, s06,
    ],
  },
  {
    name: "pressure30_toolbox",
    rationale: "Singletonize six high-leverage threats and replace concentration with broad interaction.",
    cards: [
      ...singletonize(units, [
        "van_storm_u03",
        "van_storm_u05",
        "van_storm_u08",
        "van_storm_u11",
        "van_storm_u13",
        "van_storm_u17",
      ]),
      s01, s01, s02, s02, s05, s05, s06, s06, s08, s08,
    ],
  },
  {
    name: "pressure30_sweeper",
    rationale: "Same six singleton pressure threats, but use s07 AoE instead of s08 hard removal.",
    cards: [
      ...singletonize(units, [
        "van_storm_u03",
        "van_storm_u05",
        "van_storm_u08",
        "van_storm_u11",
        "van_storm_u13",
        "van_storm_u17",
      ]),
      s01, s01, s02, s02, s05, s05, s06, s06, s07, s07,
    ],
  },
  {
    name: "pressure32_no_extra_burn",
    rationale: "Singletonize u03/u05/u08/u13 and compare a utility-heavy spell package without extra Nexus burn.",
    cards: [
      ...singletonize(units, ["van_storm_u03", "van_storm_u05", "van_storm_u08", "van_storm_u13"]),
      s01, s01, s02, s02, s03, s03, s05, s05,
    ],
  },
];
for (const recipe of recipes) assertRecipe(recipe.name, recipe.cards);

const PRESSURE_IDS = new Set([
  "van_storm_u02",
  "van_storm_u03",
  "van_storm_u04",
  "van_storm_u05",
  "van_storm_u08",
  "van_storm_u11",
  "van_storm_u13",
  "van_storm_u14",
  "van_storm_u17",
  "van_storm_u18",
]);

function recipeStats(cards: string[]) {
  const defs = cards.map(getCard);
  const pressureCopies = cards.filter((id) => PRESSURE_IDS.has(id)).length;
  const keywordCopies = defs.filter((card) =>
    (card.keywords ?? []).some((keyword) => ["Flying", "Elusive", "Haste", "QuickAttack"].includes(keyword)),
  ).length;
  return {
    units: defs.filter((card) => card.type === "Unit").length,
    spells: defs.filter((card) => card.type === "Spell").length,
    uniqueCards: new Set(cards).size,
    averageCost: round1(defs.reduce((sum, card) => sum + card.cost, 0) / cards.length),
    early1To2: defs.filter((card) => card.cost <= 2).length,
    topEnd7Plus: defs.filter((card) => card.cost >= 7).length,
    pressureCopies,
    keywordThreatCopies: keywordCopies,
    duplicatedPressureIds: [...PRESSURE_IDS].filter((id) => cards.filter((cardId) => cardId === id).length === 2),
  };
}

type Result = {
  name: string;
  rationale: string;
  stats: ReturnType<typeof recipeStats>;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgRounds: number;
  maxWinRate: number;
  minWinRate: number;
  health: { healthy: number; watch: number; critical: number };
  matchups: Array<{ opponent: string; games: number; winRate: number; status: string }>;
};

function runRecipe(name: string, rationale: string, cards: string[]): Result {
  const overrides = {
    ...baseOverrides,
    [TARGET_ID]: { ...targetBase, cards: [...cards] },
  };
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let games = 0;
  let weightedRounds = 0;
  const health = { healthy: 0, watch: 0, critical: 0 };
  const matchupRows: Result["matchups"] = [];

  for (const matchup of matchups) {
    const parts: SimulationSummary[] = [];
    for (let stratum = 0; stratum < STRATA; stratum += 1) {
      parts.push(
        runBalanceSimulation(
          matchup.leftId,
          matchup.rightId,
          GAMES,
          vanillaBalanceSeed(matchup, stratum),
          overrides,
        ),
      );
    }
    const targetIsA = matchup.leftId === TARGET_ID;
    const matchupWins = parts.reduce((sum, row) => sum + (targetIsA ? row.winsA : row.winsB), 0);
    const matchupLosses = parts.reduce((sum, row) => sum + (targetIsA ? row.winsB : row.winsA), 0);
    const matchupDraws = parts.reduce((sum, row) => sum + row.draws, 0);
    const matchupGames = parts.reduce((sum, row) => sum + row.completedGames, 0);
    const rate = pct(matchupWins, matchupWins + matchupLosses);
    const status = evaluateMatchup(rate).status;
    health[status] += 1;
    wins += matchupWins;
    losses += matchupLosses;
    draws += matchupDraws;
    games += matchupGames;
    weightedRounds += parts.reduce((sum, row) => sum + row.avgRounds * row.completedGames, 0);
    matchupRows.push({
      opponent: targetIsA ? matchup.rightId : matchup.leftId,
      games: matchupGames,
      winRate: rate,
      status,
    });
  }

  const rates = matchupRows.map((row) => row.winRate);
  return {
    name,
    rationale,
    stats: recipeStats(cards),
    games,
    wins,
    losses,
    draws,
    winRate: pct(wins, wins + losses),
    avgRounds: round1(weightedRounds / Math.max(1, games)),
    maxWinRate: Math.max(...rates),
    minWinRate: Math.min(...rates),
    health,
    matchups: matchupRows,
  };
}

const results = recipes.map((recipe) => runRecipe(recipe.name, recipe.rationale, recipe.cards));
const baseline = results[0];
const candidates = results
  .slice(1)
  .map((row) => ({
    ...row,
    deltaVsBaseline: round1(row.winRate - baseline.winRate),
    parityDistance: round1(Math.abs(row.winRate - 55)),
    score: round1(
      Math.abs(row.winRate - 55) +
      row.health.critical * 1.5 +
      row.health.watch * 0.35 +
      Math.max(0, row.maxWinRate - 70) * 0.5 +
      Math.max(0, 35 - row.minWinRate) * 0.5,
    ),
  }))
  .sort((a, b) => a.score - b.score || b.health.healthy - a.health.healthy || a.name.localeCompare(b.name));

const report = {
  version: "Vanilla 1.6 Tempestade Vanguard recipe screen",
  methodology:
    "No CardDef mutation. Only vanilla_storm_1 deck overrides change in-memory; Tempestade Ascendant and every other deck/card remain baseline. Each recipe runs against all 11 opponents using identical certified deterministic seed strata. Candidate ranking favors lower critical-matchup count and a controlled 55% aggregate target rather than maximizing power.",
  target: {
    id: TARGET_ID,
    name: VANILLA_EXPERIMENTAL_DECKS.find((deck) => deck.id === TARGET_ID)?.name ?? TARGET_ID,
    objective: "Reduce the post-Vanilla-1.5 meta ceiling while preserving Tempestade's evasive/rush identity without CardDef changes.",
  },
  run: {
    gamesPerStratum: GAMES,
    strata: STRATA,
    gamesPerRecipe: baseline.games,
    recipes: results.length,
    totalGames: results.reduce((sum, row) => sum + row.games, 0),
  },
  baseline,
  candidates,
  untouchedTempestadeAscendant:
    VANILLA_EXPERIMENTAL_DECKS.find((deck) => deck.id === "vanilla_storm_2")?.cards.length === 40,
};

if (writePath) {
  fs.mkdirSync(writePath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
