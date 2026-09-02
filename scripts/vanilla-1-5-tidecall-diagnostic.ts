import fs from "node:fs";
import { evaluateMatchup } from "../src/game/balance-health";
import { getCard } from "../src/game/cards";
import {
  VANILLA_BALANCE_STRATUM_BASES,
  vanillaBalanceMatchups,
  vanillaBalanceSeed,
  vanillaExperimentalOverrides,
} from "../src/game/vanilla-balance-lab";
import { runBalanceSimulation, type SimulationSummary } from "../src/lib/balance-simulator";

const TARGET_ID = "vanilla_tide_1";
const GAMES = Math.max(20, Math.min(80, Number(process.argv[2]) || 40));
const STRATA = Math.max(3, Math.min(5, Number(process.argv[3]) || 5));
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";
if (STRATA > VANILLA_BALANCE_STRATUM_BASES.length) throw new Error("strata outside seed table");

const baseOverrides = vanillaExperimentalOverrides();
const targetBase = baseOverrides[TARGET_ID];
if (!targetBase) throw new Error(`${TARGET_ID} missing`);
const matchups = vanillaBalanceMatchups().filter((row) => row.leftId === TARGET_ID || row.rightId === TARGET_ID);
if (matchups.length !== 11) throw new Error(`expected 11 Tidecall Vanguard matchups, found ${matchups.length}`);

function round1(value: number): number { return Math.round(value * 10) / 10; }
function pct(n: number, d: number): number { return round1((n / Math.max(1, d)) * 100); }
function copies(ids: string[]): string[] { return ids.flatMap((id) => [id, id]); }
function range(prefix: string, from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${String(from + i).padStart(2, "0")}`);
}

const u01u18 = range("van_tide_u", 1, 18);
const u01u14 = range("van_tide_u", 1, 14);
const u15u18 = range("van_tide_u", 15, 18);
const s01 = "van_tide_s01";
const s02 = "van_tide_s02";
const s03 = "van_tide_s03";
const s05 = "van_tide_s05";
const s06 = "van_tide_s06";

const recipes = [
  { name: "baseline_36u4s", cards: [...copies(u01u18), s01, s01, s02, s02] },
  { name: "recipe32_control", cards: [...copies(u01u14), ...u15u18, s01, s01, s02, s02, s05, s05, s06, s06] },
  { name: "recipe32_toolbox", cards: [...copies(u01u14), ...u15u18, s01, s01, s02, s02, s03, s03, s05, s05] },
];
for (const recipe of recipes) {
  if (recipe.cards.length !== 40) throw new Error(`${recipe.name}: ${recipe.cards.length} cards`);
  for (const defId of recipe.cards) getCard(defId);
}

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
  winRate: number;
  avgRounds: number;
  maxWinRate: number;
  minWinRate: number;
  health: { healthy: number; watch: number; critical: number };
  matchups: Array<{ opponent: string; games: number; winRate: number; status: string }>;
};

function runRecipe(name: string, cards: string[]): Result {
  const overrides = { ...baseOverrides, [TARGET_ID]: { ...targetBase, cards: [...cards] } };
  let wins = 0;
  let losses = 0;
  let games = 0;
  let weightedRounds = 0;
  const health = { healthy: 0, watch: 0, critical: 0 };
  const rows: Result["matchups"] = [];

  for (const matchup of matchups) {
    const parts: SimulationSummary[] = [];
    for (let stratum = 0; stratum < STRATA; stratum += 1) {
      parts.push(runBalanceSimulation(matchup.leftId, matchup.rightId, GAMES, vanillaBalanceSeed(matchup, stratum), overrides));
    }
    const targetIsA = matchup.leftId === TARGET_ID;
    const mw = parts.reduce((sum, row) => sum + (targetIsA ? row.winsA : row.winsB), 0);
    const ml = parts.reduce((sum, row) => sum + (targetIsA ? row.winsB : row.winsA), 0);
    const mg = parts.reduce((sum, row) => sum + row.completedGames, 0);
    const rate = pct(mw, mw + ml);
    const status = evaluateMatchup(rate).status;
    health[status] += 1;
    wins += mw;
    losses += ml;
    games += mg;
    weightedRounds += parts.reduce((sum, row) => sum + row.avgRounds * row.completedGames, 0);
    rows.push({ opponent: targetIsA ? matchup.rightId : matchup.leftId, games: mg, winRate: rate, status });
  }

  const rates = rows.map((row) => row.winRate);
  return {
    name,
    stats: recipeStats(cards),
    games,
    winRate: pct(wins, wins + losses),
    avgRounds: round1(weightedRounds / Math.max(1, games)),
    maxWinRate: Math.max(...rates),
    minWinRate: Math.min(...rates),
    health,
    matchups: rows,
  };
}

const results = recipes.map((recipe) => runRecipe(recipe.name, recipe.cards));
const baseline = results[0];
const candidates = results.slice(1).map((row) => ({ ...row, deltaVsBaseline: round1(row.winRate - baseline.winRate) }));
const report = {
  version: "Vanilla 1.5 Vanguard recipe finalist validation",
  methodology: "No card changes. Baseline and two 32-Unit finalists run Tidecall Vanguard versus all 11 opponents at the full five certified seed strata; Tidecall Ascendant remains untouched.",
  run: { gamesPerStratum: GAMES, strata: STRATA, gamesPerRecipe: baseline.games, totalGames: results.reduce((sum, row) => sum + row.games, 0) },
  baseline,
  candidates,
};
if (writePath) {
  fs.mkdirSync(writePath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
