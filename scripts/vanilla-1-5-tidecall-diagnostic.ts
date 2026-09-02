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

const TARGET_ID = "vanilla_tide_1";
const GAMES = Math.max(10, Math.min(60, Number(process.argv[2]) || 16));
const STRATA = Math.max(3, Math.min(5, Number(process.argv[3]) || 3));
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";
if (STRATA > VANILLA_BALANCE_STRATUM_BASES.length) throw new Error("strata outside seed table");

const baseOverrides = vanillaExperimentalOverrides();
const targetBase = baseOverrides[TARGET_ID];
if (!targetBase) throw new Error(`${TARGET_ID} missing from Balance Lab overrides`);
const matchups = vanillaBalanceMatchups().filter((row) => row.leftId === TARGET_ID || row.rightId === TARGET_ID);
if (matchups.length !== 11) throw new Error(`expected 11 Tidecall Vanguard matchups, found ${matchups.length}`);

function round1(value: number): number { return Math.round(value * 10) / 10; }
function pct(n: number, d: number): number { return round1((n / Math.max(1, d)) * 100); }
function copies(ids: string[], count = 2): string[] { return ids.flatMap((id) => Array(count).fill(id)); }
function range(prefix: string, from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, index) => `${prefix}${String(from + index).padStart(2, "0")}`);
}
function assertRecipe(name: string, cards: string[]): void {
  if (cards.length !== 40) throw new Error(`${name}: expected 40 cards, found ${cards.length}`);
  for (const defId of cards) getCard(defId);
}

const u01u18 = range("van_tide_u", 1, 18);
const u01u16 = range("van_tide_u", 1, 16);
const u01u15 = range("van_tide_u", 1, 15);
const u01u14 = range("van_tide_u", 1, 14);
const u01u12 = range("van_tide_u", 1, 12);
const u15u18 = range("van_tide_u", 15, 18);
const s01 = "van_tide_s01";
const s02 = "van_tide_s02";
const s03 = "van_tide_s03";
const s04 = "van_tide_s04";
const s05 = "van_tide_s05";
const s06 = "van_tide_s06";

const recipes = [
  { name: "baseline_36u4s", cards: [...copies(u01u18), s01, s01, s02, s02] },
  { name: "recipe34_frost", cards: [...copies(u01u16), "van_tide_u17", "van_tide_u18", s01, s01, s02, s02, s05, s05] },
  { name: "recipe34_barrier", cards: [...copies(u01u16), "van_tide_u17", "van_tide_u18", s01, s01, s02, s02, s03, s03] },
  { name: "recipe34_mixed", cards: [...copies(u01u16), "van_tide_u17", "van_tide_u18", s01, s01, s02, s02, s05, s06] },
  { name: "recipe33_control", cards: [...copies(u01u15), "van_tide_u16", "van_tide_u17", "van_tide_u18", s01, s01, s02, s02, s03, s05, s06] },
  { name: "recipe32_control", cards: [...copies(u01u14), ...u15u18, s01, s01, s02, s02, s05, s05, s06, s06] },
  { name: "recipe32_toolbox", cards: [...copies(u01u14), ...u15u18, s01, s01, s02, s02, s03, s03, s05, s05] },
  { name: "recipe32_draw", cards: [...copies(u01u14), ...u15u18, s01, s01, s02, s02, s03, s03, s04, s04] },
  { name: "recipe30_spread", cards: [...u01u18, ...u01u12, s01, s01, s02, s02, s03, s03, s04, s04, s05, s05] },
];
for (const recipe of recipes) assertRecipe(recipe.name, recipe.cards);

function recipeStats(cards: string[]) {
  const defs = cards.map(getCard);
  return {
    units: defs.filter((card) => card.type === "Unit").length,
    spells: defs.filter((card) => card.type === "Spell").length,
    uniqueCards: new Set(cards).size,
    averageCost: round1(defs.reduce((sum, card) => sum + card.cost, 0) / cards.length),
    topEnd7Plus: defs.filter((card) => card.cost >= 7).length,
    early1To2: defs.filter((card) => card.cost <= 2).length,
  };
}

type Result = {
  name: string;
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

function runRecipe(name: string, cards: string[]): Result {
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
      parts.push(runBalanceSimulation(matchup.leftId, matchup.rightId, GAMES, vanillaBalanceSeed(matchup, stratum), overrides));
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
    matchupRows.push({ opponent: targetIsA ? matchup.rightId : matchup.leftId, games: matchupGames, winRate: rate, status });
  }

  const rates = matchupRows.map((row) => row.winRate);
  return {
    name,
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

const results = recipes.map((recipe) => runRecipe(recipe.name, recipe.cards));
const baseline = results[0];
const candidates = results.slice(1).map((row) => ({
  ...row,
  deltaVsBaseline: round1(row.winRate - baseline.winRate),
  score: round1(Math.abs(row.winRate - 64) + Math.max(0, row.maxWinRate - 80) * 1.5 + Math.max(0, 40 - row.minWinRate) * 2 + row.health.critical * 0.25),
})).sort((a, b) => a.score - b.score || b.health.healthy - a.health.healthy || a.name.localeCompare(b.name));

const report = {
  version: "Vanilla 1.5 Tidecall Vanguard recipe sweep",
  methodology: "No CardDef mutation. Only vanilla_tide_1 deck override changes in-memory; Tidecall Ascendant and all other decks/cards remain byte-for-byte baseline. Each candidate runs against all 11 opponents with paired certified Balance Lab seeds.",
  run: { gamesPerStratum: GAMES, strata: STRATA, gamesPerRecipe: baseline.games, recipes: results.length, totalGames: results.reduce((sum, row) => sum + row.games, 0) },
  baseline,
  candidates,
  untouchedTideAscendant: VANILLA_EXPERIMENTAL_DECKS.find((deck) => deck.id === "vanilla_tide_2")?.cards.length === 40,
};

if (writePath) {
  fs.mkdirSync(writePath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
