import fs from "node:fs";
import { summarizeBalance } from "../src/game/balance-health";
import {
  ALPHA_STARTER_BALANCE_MATCHUPS,
  alphaStarterBalanceMatchups,
  alphaStarterBalanceSeed,
} from "../src/game/alpha-starter-balance";
import {
  WOOD_1_2_CANDIDATES,
  woodCandidateOverride,
  validateWoodCandidateSet,
  type WoodRecipeCandidate,
} from "../src/game/alpha-starter-balance-1-2";
import {
  runStackAwareBalanceSimulation,
  type SimulationSummary,
} from "../src/lib/balance-simulator";

const SCREEN_GAMES_PER_STRATUM = Math.max(6, Math.min(30, Number(process.env.ALPHA_1_2_SCREEN_GAMES) || 10));
const FINAL_GAMES_PER_STRATUM = Math.max(20, Math.min(60, Number(process.env.ALPHA_1_2_FINAL_GAMES) || 40));
const STRATA = 5;
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";
const enforceQuality = process.argv.includes("--enforce") || process.argv.includes("--enforce-quality");

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function wilson95(wins: number, total: number): { low: number; high: number } {
  if (!total) return { low: 0, high: 0 };
  const z = 1.96;
  const p = wins / total;
  const z2 = z * z;
  const center = (p + z2 / (2 * total)) / (1 + z2 / total);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total) / (1 + z2 / total);
  return {
    low: round1(Math.max(0, center - margin) * 100),
    high: round1(Math.min(1, center + margin) * 100),
  };
}

function aggregate(parts: SimulationSummary[], deckA: string, deckB: string): SimulationSummary & {
  seedStrata: number[];
  seedWinRates: number[];
  maxSeedDeviation: number;
} {
  const winsA = parts.reduce((sum, row) => sum + row.winsA, 0);
  const winsB = parts.reduce((sum, row) => sum + row.winsB, 0);
  const draws = parts.reduce((sum, row) => sum + row.draws, 0);
  const completedGames = parts.reduce((sum, row) => sum + row.completedGames, 0);
  const firstPlayerWins = parts.reduce((sum, row) => sum + row.firstPlayerWins, 0);
  const secondPlayerWins = parts.reduce((sum, row) => sum + row.secondPlayerWins, 0);
  const decisive = Math.max(1, winsA + winsB);
  const firstDecisive = Math.max(1, firstPlayerWins + secondPlayerWins);
  const seedWinRates = parts.map((row) => row.winRateA);
  const pooled = round1((winsA / decisive) * 100);
  const medians = parts.map((row) => row.roundDistribution.median).sort((a, b) => a - b);

  return {
    deckA,
    deckB,
    requestedGames: parts.reduce((sum, row) => sum + row.requestedGames, 0),
    completedGames,
    winsA,
    winsB,
    draws,
    avgRounds: Math.round(
      parts.reduce((sum, row) => sum + row.avgRounds * row.completedGames, 0) / Math.max(1, completedGames),
    ),
    winRateA: pooled,
    winRateB: round1((winsB / decisive) * 100),
    firstPlayerWins,
    secondPlayerWins,
    firstPlayerWinRate: round1((firstPlayerWins / firstDecisive) * 100),
    winRateA95: wilson95(winsA, decisive),
    seed: parts[0]?.seed ?? 0,
    engineVersion: parts[0]?.engineVersion ?? "unknown",
    rulesetVersion: parts[0]?.rulesetVersion ?? "unknown",
    roundDistribution: {
      min: Math.min(...parts.map((row) => row.roundDistribution.min)),
      max: Math.max(...parts.map((row) => row.roundDistribution.max)),
      median: medians[Math.floor(medians.length / 2)] ?? 0,
    },
    seedStrata: parts.map((row) => row.seed),
    seedWinRates,
    maxSeedDeviation: round1(Math.max(...seedWinRates.map((rate) => Math.abs(rate - pooled)))),
  };
}

type MatrixRow = ReturnType<typeof aggregate>;
type BalanceHealth = ReturnType<typeof summarizeBalance>;

interface MatrixResult {
  id: string;
  label: string;
  candidateId: string | null;
  gamesPerStratum: number;
  totalGames: number;
  complete: boolean;
  health: BalanceHealth;
  criticalPairs: string[];
  newCriticalPairs: string[];
  targetMatchups: Record<string, { woodWinRate: number; opponentWinRate: number }>;
  score: number;
  rows: MatrixRow[];
}

function criticalPairs(health: BalanceHealth): string[] {
  return health.outliers
    .filter((row) => row.status === "critical")
    .map((row) => `${row.deckA}::${row.deckB}`)
    .sort();
}

function targetMatchup(rows: MatrixRow[], opponent: string): { woodWinRate: number; opponentWinRate: number } {
  const row = rows.find(
    (candidate) =>
      (candidate.deckA === "wood_midrange" && candidate.deckB === opponent) ||
      (candidate.deckB === "wood_midrange" && candidate.deckA === opponent),
  );
  if (!row) return { woodWinRate: 0, opponentWinRate: 0 };
  return row.deckA === "wood_midrange"
    ? { woodWinRate: row.winRateA, opponentWinRate: row.winRateB }
    : { woodWinRate: row.winRateB, opponentWinRate: row.winRateA };
}

function runMatrix(
  id: string,
  label: string,
  candidate: WoodRecipeCandidate | null,
  gamesPerStratum: number,
  baselineCriticalPairs: readonly string[] = [],
): MatrixResult {
  const overrides = candidate ? woodCandidateOverride(candidate) : undefined;
  const rows: MatrixRow[] = [];

  for (const matchup of alphaStarterBalanceMatchups()) {
    const parts: SimulationSummary[] = [];
    for (let stratum = 0; stratum < STRATA; stratum += 1) {
      parts.push(
        runStackAwareBalanceSimulation(
          matchup.leftId,
          matchup.rightId,
          gamesPerStratum,
          alphaStarterBalanceSeed(matchup, stratum),
          overrides,
        ),
      );
    }
    rows.push(aggregate(parts, matchup.leftId, matchup.rightId));
  }

  const health = summarizeBalance(rows);
  const totalGames = rows.reduce((sum, row) => sum + row.completedGames, 0);
  const expected = ALPHA_STARTER_BALANCE_MATCHUPS * STRATA * gamesPerStratum;
  const critical = criticalPairs(health);
  const baselineSet = new Set(baselineCriticalPairs);
  const newCriticalPairs = critical.filter((pair) => !baselineSet.has(pair));
  const tide = targetMatchup(rows, "tide_control");

  const score =
    health.criticalMatchups * 1_000_000 +
    newCriticalPairs.length * 500_000 +
    (tide.woodWinRate > 60 ? 250_000 + Math.round((tide.woodWinRate - 60) * 10_000) : 0) +
    health.watchMatchups * 10_000 +
    (100 - health.healthScore) * 100 +
    Math.round(Math.abs(health.firstPlayerWinRate - 50) * 10);

  return {
    id,
    label,
    candidateId: candidate?.id ?? null,
    gamesPerStratum,
    totalGames,
    complete: totalGames === expected && rows.every((row) => row.completedGames === row.requestedGames),
    health,
    criticalPairs: critical,
    newCriticalPairs,
    targetMatchups: {
      ember: targetMatchup(rows, "ember_aggro"),
      florestia: targetMatchup(rows, "florestia_tribal"),
      tide: targetMatchup(rows, "tide_control"),
      void: targetMatchup(rows, "void_shadow"),
      tempestade: targetMatchup(rows, "tempestade_rush"),
    },
    score,
    rows,
  };
}

function ranked(results: MatrixResult[]): MatrixResult[] {
  return [...results].sort(
    (a, b) =>
      a.score - b.score ||
      a.health.criticalMatchups - b.health.criticalMatchups ||
      a.newCriticalPairs.length - b.newCriticalPairs.length ||
      b.health.healthScore - a.health.healthScore ||
      a.id.localeCompare(b.id),
  );
}

const candidateErrors = validateWoodCandidateSet();
if (candidateErrors.length) {
  throw new Error(`Alpha starter 1.2 candidate set is invalid: ${candidateErrors.join(" | ")}`);
}

const screenBaseline = runMatrix("baseline_screen", "1.1 baseline screen", null, SCREEN_GAMES_PER_STRATUM);
const screenBaselineCritical = screenBaseline.criticalPairs;

const screening = WOOD_1_2_CANDIDATES.map((candidate) =>
  runMatrix(candidate.id, candidate.label, candidate, SCREEN_GAMES_PER_STRATUM, screenBaselineCritical),
);
const topIds = new Set(ranked(screening).slice(0, 4).map((result) => result.id));
const finalists = WOOD_1_2_CANDIDATES.filter((candidate) => topIds.has(candidate.id));

const fullBaseline = runMatrix("baseline_full", "Certified 1.1 baseline control", null, FINAL_GAMES_PER_STRATUM);
const fullBaselineCritical = fullBaseline.criticalPairs;
const fullFinalists = finalists.map((candidate) =>
  runMatrix(candidate.id, candidate.label, candidate, FINAL_GAMES_PER_STRATUM, fullBaselineCritical),
);
const finalistRanking = ranked(fullFinalists);
const best = finalistRanking[0];

const allRuns = [screenBaseline, ...screening, fullBaseline, ...fullFinalists];
const qualityErrors = allRuns
  .filter((result) => !result.complete)
  .map((result) => `${result.id}: incomplete matrix ${result.totalGames} games`);

const eligible = finalistRanking.filter((result) =>
  result.complete &&
  result.health.criticalMatchups < fullBaseline.health.criticalMatchups &&
  result.newCriticalPairs.length === 0 &&
  result.targetMatchups.tide.woodWinRate <= 60 &&
  Math.abs(result.health.firstPlayerWinRate - 50) <= 2,
);

const report = {
  version: "1.2",
  methodology:
    "Wood-only one-slot recipe screening on certified 1.1; stack-aware simulator; full six-starter matrix; same five deterministic strata; four finalists rerun at 200 games/matchup; no-new-critical and Wood-vs-Tide <=60% guardrails",
  screeningGamesPerStratum: SCREEN_GAMES_PER_STRATUM,
  finalistGamesPerStratum: FINAL_GAMES_PER_STRATUM,
  strata: STRATA,
  screeningBaseline: screenBaseline,
  screeningRanking: ranked(screening).map((result) => ({
    id: result.id,
    label: result.label,
    score: result.score,
    health: result.health,
    criticalPairs: result.criticalPairs,
    newCriticalPairs: result.newCriticalPairs,
    targetMatchups: result.targetMatchups,
  })),
  selectedFinalists: finalists.map((candidate) => ({
    id: candidate.id,
    label: candidate.label,
    rationale: candidate.rationale,
  })),
  fullBaseline,
  finalistRanking: finalistRanking.map((result) => ({
    id: result.id,
    label: result.label,
    score: result.score,
    health: result.health,
    criticalPairs: result.criticalPairs,
    newCriticalPairs: result.newCriticalPairs,
    targetMatchups: result.targetMatchups,
  })),
  eligible: eligible.map((result) => result.id),
  best,
  improvement: best
    ? {
        criticalMatchups: fullBaseline.health.criticalMatchups - best.health.criticalMatchups,
        watchMatchups: fullBaseline.health.watchMatchups - best.health.watchMatchups,
        healthScore: best.health.healthScore - fullBaseline.health.healthScore,
        firstPlayerSkew:
          round1(Math.abs(fullBaseline.health.firstPlayerWinRate - 50) - Math.abs(best.health.firstPlayerWinRate - 50)),
      }
    : null,
  quality: {
    complete: qualityErrors.length === 0,
    errors: qualityErrors,
    totalSimulatedGames: allRuns.reduce((sum, result) => sum + result.totalGames, 0),
  },
};

if (writePath) fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  version: report.version,
  quality: report.quality,
  baseline: {
    health: fullBaseline.health,
    criticalPairs: fullBaseline.criticalPairs,
    targetMatchups: fullBaseline.targetMatchups,
  },
  selectedFinalists: report.selectedFinalists,
  finalistRanking: report.finalistRanking,
  eligible: report.eligible,
  improvement: report.improvement,
  best: best
    ? {
        id: best.id,
        label: best.label,
        health: best.health,
        criticalPairs: best.criticalPairs,
        newCriticalPairs: best.newCriticalPairs,
        targetMatchups: best.targetMatchups,
      }
    : null,
}, null, 2));

if (enforceQuality && qualityErrors.length) {
  console.error(`ALPHA STARTER BALANCE 1.2 GRID: BLOCKED QUALITY — ${qualityErrors.join(" | ")}`);
  process.exitCode = 1;
} else {
  console.log(
    `ALPHA STARTER BALANCE 1.2 GRID: COMPLETE — ${report.quality.totalSimulatedGames} games · eligible=${eligible.length} · best=${best?.id ?? "none"} · critical=${best?.health.criticalMatchups ?? "n/a"} · health=${best?.health.healthScore ?? "n/a"}`,
  );
}
