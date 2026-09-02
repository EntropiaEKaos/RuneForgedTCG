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

const overrides = vanillaExperimentalOverrides();
const targetBase = overrides[TARGET_ID];
if (!targetBase) throw new Error(`${TARGET_ID} missing`);
const matchups = vanillaBalanceMatchups();
if (matchups.length !== 66) throw new Error(`expected 66 matchups, found ${matchups.length}`);

function copies(ids: string[]): string[] { return ids.flatMap((id) => [id, id]); }
function range(prefix: string, from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${String(from + i).padStart(2, "0")}`);
}
function round1(value: number): number { return Math.round(value * 10) / 10; }
function pct(n: number, d: number): number { return round1((n / Math.max(1, d)) * 100); }

const u01u14 = range("van_tide_u", 1, 14);
const u15u18 = range("van_tide_u", 15, 18);
export const TIDECALL_VANGUARD_1_5_RECIPE = [
  ...copies(u01u14),
  ...u15u18,
  "van_tide_s01", "van_tide_s01",
  "van_tide_s02", "van_tide_s02",
  "van_tide_s05", "van_tide_s05",
  "van_tide_s06", "van_tide_s06",
];
if (TIDECALL_VANGUARD_1_5_RECIPE.length !== 40) throw new Error("Tidecall Vanguard 1.5 recipe must contain 40 cards");
for (const defId of TIDECALL_VANGUARD_1_5_RECIPE) getCard(defId);
overrides[TARGET_ID] = { ...targetBase, cards: [...TIDECALL_VANGUARD_1_5_RECIPE] };

type DeckAggregate = { wins: number; losses: number; draws: number; games: number };
const decks: Record<string, DeckAggregate> = {};
const matchupRows: Array<{ leftId: string; rightId: string; games: number; winRateA: number; status: string; maxSeedDeviation: number }> = [];
let firstWins = 0;
let decisive = 0;
let draws = 0;
let totalGames = 0;
let maxSeedDeviation = 0;
const health = { healthy: 0, watch: 0, critical: 0 };

for (const matchup of matchups) {
  const parts: SimulationSummary[] = [];
  for (let stratum = 0; stratum < STRATA; stratum += 1) {
    parts.push(runBalanceSimulation(matchup.leftId, matchup.rightId, GAMES, vanillaBalanceSeed(matchup, stratum), overrides));
  }
  const completed = parts.reduce((sum, row) => sum + row.completedGames, 0);
  const winsA = parts.reduce((sum, row) => sum + row.winsA, 0);
  const winsB = parts.reduce((sum, row) => sum + row.winsB, 0);
  const matchupDraws = parts.reduce((sum, row) => sum + row.draws, 0);
  const rateA = pct(winsA, winsA + winsB);
  const status = evaluateMatchup(rateA).status;
  health[status] += 1;
  const seedRates = parts.map((row) => pct(row.winsA, row.winsA + row.winsB));
  const seedDeviation = Math.max(...seedRates.map((rate) => Math.abs(rate - rateA)));
  maxSeedDeviation = Math.max(maxSeedDeviation, seedDeviation);
  matchupRows.push({ leftId: matchup.leftId, rightId: matchup.rightId, games: completed, winRateA: rateA, status, maxSeedDeviation: round1(seedDeviation) });

  decks[matchup.leftId] ??= { wins: 0, losses: 0, draws: 0, games: 0 };
  decks[matchup.rightId] ??= { wins: 0, losses: 0, draws: 0, games: 0 };
  decks[matchup.leftId].wins += winsA;
  decks[matchup.leftId].losses += winsB;
  decks[matchup.leftId].draws += matchupDraws;
  decks[matchup.leftId].games += completed;
  decks[matchup.rightId].wins += winsB;
  decks[matchup.rightId].losses += winsA;
  decks[matchup.rightId].draws += matchupDraws;
  decks[matchup.rightId].games += completed;

  firstWins += parts.reduce((sum, row) => sum + row.firstPlayerWins, 0);
  decisive += parts.reduce((sum, row) => sum + row.firstPlayerWins + row.secondPlayerWins, 0);
  draws += matchupDraws;
  totalGames += completed;
}

const deckWinRates = Object.entries(decks).map(([deckId, row]) => ({
  deckId,
  games: row.games,
  wins: row.wins,
  losses: row.losses,
  draws: row.draws,
  winRate: pct(row.wins, row.wins + row.losses),
})).sort((a, b) => b.winRate - a.winRate || a.deckId.localeCompare(b.deckId));

const targetCards = TIDECALL_VANGUARD_1_5_RECIPE.map(getCard);
const targetStats = {
  units: targetCards.filter((card) => card.type === "Unit").length,
  spells: targetCards.filter((card) => card.type === "Spell").length,
  uniqueCards: new Set(TIDECALL_VANGUARD_1_5_RECIPE).size,
  averageCost: round1(targetCards.reduce((sum, card) => sum + card.cost, 0) / targetCards.length),
  topEnd7Plus: targetCards.filter((card) => card.cost >= 7).length,
};

const report = {
  version: "Vanilla 1.5 Regional Power Outliers — full-meta finalist",
  methodology: "Only Tidecall Vanguard's deck recipe changes. No CardDef, engine, AI policy, Ascendant recipe or Ranked content is mutated. All 66 experimental matchups run through the real Balance Lab simulator at five certified seed strata.",
  candidate: { deckId: TARGET_ID, stats: targetStats, cards: TIDECALL_VANGUARD_1_5_RECIPE },
  certifiedBaseline14: { healthy: 14, watch: 11, critical: 41, tidecallVanguardWinRate: 82.4, tidecallAscendantWinRate: 46.5 },
  matrix: {
    matchups: matchupRows.length,
    gamesPerMatchup: GAMES * STRATA,
    totalGames,
    firstPlayerWinRate: pct(firstWins, decisive),
    drawRate: pct(draws, totalGames),
    maxSeedDeviation: round1(maxSeedDeviation),
    health,
    deltaCriticalVs14: health.critical - 41,
    releaseGate: health.critical === 0 ? (health.watch === 0 ? "pass" : "review") : "blocked",
  },
  deckWinRates,
  matchups: matchupRows,
};

if (writePath) {
  fs.mkdirSync(writePath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
