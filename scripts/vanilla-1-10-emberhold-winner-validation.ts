import fs from "node:fs";
import { VANILLA_EXPERIMENTAL_DECKS } from "../src/game/vanilla-experimental-decks";
import {
  VANILLA_BALANCE_STRATUM_BASES,
  validateVanillaBalancePool,
  vanillaBalanceMatchups,
  vanillaBalanceSeed,
  vanillaExperimentalOverrides,
} from "../src/game/vanilla-balance-lab";
import {
  mergeBalanceSimulationTelemetry,
  runBalanceSimulationWithTelemetry,
  type SimulationSummary,
} from "../src/lib/balance-simulator";

const TARGET_ID = "vanilla_ember_2";
const GAMES_PER_STRATUM = 40;
const STRATA = 5;
const PRE_PROMOTION_BASE_SHA = "40675729a78e5f16c11becdb7871f752002e012c";
const PRE_PROMOTION_GLOBAL_WIN_RATE = 39.9;
const WINNER_EXTRA_SUFFIXES = [
  "u03", "u03",
  "u05", "u05",
  "u08", "u08",
  "u11", "u11",
  "u13", "u13",
] as const;

const BASELINE_MATCHUP_WIN_RATES: Record<string, number> = {
  vanilla_storm_1: 29.5,
  vanilla_tide_1: 30.5,
  vanilla_void_1: 32.5,
  vanilla_wood_1: 34.5,
  vanilla_ember_1: 40.5,
  vanilla_void_2: 41.0,
  vanilla_storm_2: 44.5,
  vanilla_forest_1: 45.0,
  vanilla_wood_2: 45.5,
  vanilla_tide_2: 46.5,
  vanilla_forest_2: 49.0,
};

const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pct(numerator: number, denominator: number): number {
  return round1((numerator / Math.max(1, denominator)) * 100);
}

function perGame(value: number, games: number): number {
  return round1(value / Math.max(1, games));
}

function status(winRate: number): "healthy" | "watch" | "critical" {
  if (winRate >= 45 && winRate <= 55) return "healthy";
  if (winRate >= 40 && winRate <= 60) return "watch";
  return "critical";
}

const baselineDeck = VANILLA_EXPERIMENTAL_DECKS.find((deck) => deck.id === TARGET_ID);
if (!baselineDeck) throw new Error(`Missing ${TARGET_ID}`);

const regionalFloor: string[] = [];
const regionalFloorSet = new Set<string>();
for (const defId of baselineDeck.cards) {
  if (!regionalFloorSet.has(defId)) {
    regionalFloorSet.add(defId);
    regionalFloor.push(defId);
  }
}
if (regionalFloor.length !== 30) {
  throw new Error(`Expected Emberhold 30-card regional floor, found ${regionalFloor.length}`);
}

const winnerExtras = WINNER_EXTRA_SUFFIXES.map((suffix) => `van_ember_${suffix}`);
const winnerCards = [...regionalFloor, ...winnerExtras];
if (winnerCards.length !== 40) throw new Error(`Winner recipe expected 40 cards, found ${winnerCards.length}`);

const copyCounts = new Map<string, number>();
for (const defId of winnerCards) {
  if (!regionalFloorSet.has(defId)) throw new Error(`Winner contains non-Emberhold-floor card ${defId}`);
  const count = (copyCounts.get(defId) ?? 0) + 1;
  if (count > 3) throw new Error(`Winner exceeds three-copy ceiling for ${defId}`);
  copyCounts.set(defId, count);
}

const poolErrors = validateVanillaBalancePool();
const overrides = vanillaExperimentalOverrides();
overrides[TARGET_ID] = { id: TARGET_ID, name: baselineDeck.name, cards: winnerCards };
const matchups = vanillaBalanceMatchups().filter(
  (matchup) => matchup.leftId === TARGET_ID || matchup.rightId === TARGET_ID,
);

const telemetryParts = [];
const matchupRows = [];
let incompleteStrata = 0;

for (const matchup of matchups) {
  const parts: SimulationSummary[] = [];
  for (let stratum = 0; stratum < STRATA; stratum += 1) {
    const result = runBalanceSimulationWithTelemetry(
      matchup.leftId,
      matchup.rightId,
      GAMES_PER_STRATUM,
      vanillaBalanceSeed(matchup, stratum),
      overrides,
    );
    parts.push(result.summary);
    telemetryParts.push(result.telemetry);
    if (result.summary.completedGames !== GAMES_PER_STRATUM) incompleteStrata += 1;
  }

  const completedGames = parts.reduce((sum, row) => sum + row.completedGames, 0);
  const targetIsLeft = matchup.leftId === TARGET_ID;
  const targetWins = parts.reduce((sum, row) => sum + (targetIsLeft ? row.winsA : row.winsB), 0);
  const opponentWins = parts.reduce((sum, row) => sum + (targetIsLeft ? row.winsB : row.winsA), 0);
  const winRate = pct(targetWins, targetWins + opponentWins);
  const opponentId = targetIsLeft ? matchup.rightId : matchup.leftId;
  const baselineWinRate = BASELINE_MATCHUP_WIN_RATES[opponentId];
  if (baselineWinRate === undefined) throw new Error(`Missing baseline matchup reference for ${opponentId}`);

  matchupRows.push({
    opponentId,
    completedGames,
    targetWins,
    opponentWins,
    winRate,
    baselineWinRate,
    deltaVsBaseline: round1(winRate - baselineWinRate),
    baselineStatus: status(baselineWinRate),
    status: status(winRate),
  });
}

const telemetry = mergeBalanceSimulationTelemetry(telemetryParts);
const target = telemetry.decks[TARGET_ID];
if (!target) throw new Error(`Missing utilization telemetry for ${TARGET_ID}`);

const expectedGames = matchups.length * GAMES_PER_STRATUM * STRATA;
const telemetryErrors: string[] = [];
if (matchups.length !== 11) telemetryErrors.push(`expected 11 target matchups, found ${matchups.length}`);
if (target.games !== expectedGames) telemetryErrors.push(`expected ${expectedGames} target games, found ${target.games}`);

const decisiveGames = target.wins + target.losses;
const healthy = matchupRows.filter((row) => row.status === "healthy").length;
const watch = matchupRows.filter((row) => row.status === "watch").length;
const critical = matchupRows.filter((row) => row.status === "critical").length;
const newCritical = matchupRows.filter(
  (row) => row.baselineStatus !== "critical" && row.status === "critical",
);
const recoveredCritical = matchupRows.filter(
  (row) => row.baselineStatus === "critical" && row.status !== "critical",
);
const regressions = matchupRows
  .filter((row) => row.deltaVsBaseline < 0)
  .sort((a, b) => a.deltaVsBaseline - b.deltaVsBaseline);
const qualityGate =
  poolErrors.length === 0 && incompleteStrata === 0 && telemetryErrors.length === 0 ? "pass" : "blocked";

const report = {
  version: "1.10-winner-validation-1",
  methodology:
    "Read-only full-matrix validation of the candidate-screen winner against the frozen pre-promotion product baseline. Emberhold Ascendant is overridden in memory with the Resilient Pressure recipe only; CardDefs, rules, AI and product recipes remain untouched. Uses the same five deterministic certified strata and 40 games per stratum as the baseline diagnostic.",
  candidate: {
    id: "resilient-pressure",
    targetId: TARGET_ID,
    name: baselineDeck.name,
    extraSuffixes: WINNER_EXTRA_SUFFIXES,
    cards: winnerCards,
  },
  baselineReference: {
    label: "Pre-promotion Emberhold Ascendant product baseline",
    sourceCommit: PRE_PROMOTION_BASE_SHA,
    games: 2200,
    winRate: PRE_PROMOTION_GLOBAL_WIN_RATE,
    matchupHealth: { healthy: 4, watch: 3, critical: 4 },
  },
  target: {
    games: target.games,
    wins: target.wins,
    losses: target.losses,
    draws: target.draws,
    winRate: pct(target.wins, decisiveGames),
    deltaVsBaseline: round1(pct(target.wins, decisiveGames) - PRE_PROMOTION_GLOBAL_WIN_RATE),
    matchupHealth: { healthy, watch, critical },
    recoveredCritical: recoveredCritical.length,
    newCritical: newCritical.length,
    worstMatchupWinRate: Math.min(...matchupRows.map((row) => row.winRate)),
    cardsPlayedPerGame: perGame(target.cardsPlayed, target.games),
    endHandPerGame: perGame(target.endHandCards, target.games),
    finalBenchPerGame: perGame(target.finalBenchSize, target.games),
    finalAlliesSummonedPerGame: perGame(target.finalAlliesSummoned, target.games),
    nexusDamageDealtPerGame: perGame(target.finalNexusDamageDealt, target.games),
  },
  simulation: {
    gamesPerStratum: GAMES_PER_STRATUM,
    strata: STRATA,
    certifiedSeedBases: VANILLA_BALANCE_STRATUM_BASES.slice(0, STRATA),
    matchups: matchups.length,
    totalGames: matchupRows.reduce((sum, row) => sum + row.completedGames, 0),
  },
  quality: { gate: qualityGate, poolErrors, telemetryErrors, incompleteStrata },
  safety: {
    noProductMutation: true,
    newCriticalMatchups: newCritical,
    recoveredCriticalMatchups: recoveredCritical,
    regressedMatchups: regressions,
  },
  matchupRows: matchupRows.sort((a, b) => a.winRate - b.winRate || a.opponentId.localeCompare(b.opponentId)),
};

if (writePath) fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (qualityGate !== "pass") {
  console.error(
    `VANILLA 1.10 EMBERHOLD WINNER VALIDATION: BLOCKED — ${poolErrors.length} pool errors · ${telemetryErrors.length} telemetry errors · ${incompleteStrata} incomplete strata`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `VANILLA 1.10 EMBERHOLD WINNER VALIDATION: PASS — ${report.simulation.totalGames} games · WR=${report.target.winRate}% (${report.target.deltaVsBaseline >= 0 ? "+" : ""}${report.target.deltaVsBaseline}) · ${healthy}H/${watch}W/${critical}C · recovered=${report.target.recoveredCritical} · newCritical=${report.target.newCritical}`,
  );
}
