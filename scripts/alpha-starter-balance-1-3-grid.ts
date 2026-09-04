import fs from "node:fs";
import { summarizeBalance } from "../src/game/balance-health";
import {
  ALPHA_STARTER_BALANCE_MATCHUPS,
  alphaStarterBalanceMatchups,
  alphaStarterBalanceSeed,
} from "../src/game/alpha-starter-balance";
import {
  BALANCE_1_3_CANDIDATES,
  overridesForBalance13Candidate,
  validateBalance13CandidateSet,
  type Balance13Candidate,
} from "../src/game/alpha-starter-balance-1-3";
import {
  runStackAwareBalanceSimulation,
  type SimulationSummary,
} from "../src/lib/balance-simulator";

const SCREEN_GAMES_PER_STRATUM = Math.max(6, Math.min(30, Number(process.env.ALPHA_1_3_SCREEN_GAMES) || 10));
const FINAL_GAMES_PER_STRATUM = Math.max(20, Math.min(60, Number(process.env.ALPHA_1_3_FINAL_GAMES) || 40));
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
    avgRounds: Math.round(parts.reduce((sum, row) => sum + row.avgRounds * row.completedGames, 0) / Math.max(1, completedGames)),
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
  tracked: Record<string, { left: number; right: number }>;
  score: number;
  rows: MatrixRow[];
}

function criticalPairs(health: BalanceHealth): string[] {
  return health.outliers
    .filter((row) => row.status === "critical")
    .map((row) => `${row.deckA}::${row.deckB}`)
    .sort();
}

function matchup(rows: MatrixRow[], deckA: string, deckB: string): { left: number; right: number } {
  const row = rows.find(
    (candidate) =>
      (candidate.deckA === deckA && candidate.deckB === deckB) ||
      (candidate.deckA === deckB && candidate.deckB === deckA),
  );
  if (!row) return { left: 0, right: 0 };
  return row.deckA === deckA
    ? { left: row.winRateA, right: row.winRateB }
    : { left: row.winRateB, right: row.winRateA };
}

function runMatrix(
  id: string,
  label: string,
  candidate: Balance13Candidate | null,
  gamesPerStratum: number,
  baselineCriticalPairs: readonly string[] = [],
): MatrixResult {
  const overrides = candidate ? overridesForBalance13Candidate(candidate) : undefined;
  const rows: MatrixRow[] = [];

  for (const pair of alphaStarterBalanceMatchups()) {
    const parts: SimulationSummary[] = [];
    for (let stratum = 0; stratum < STRATA; stratum += 1) {
      parts.push(
        runStackAwareBalanceSimulation(
          pair.leftId,
          pair.rightId,
          gamesPerStratum,
          alphaStarterBalanceSeed(pair, stratum),
          overrides,
        ),
      );
    }
    rows.push(aggregate(parts, pair.leftId, pair.rightId));
  }

  const health = summarizeBalance(rows);
  const totalGames = rows.reduce((sum, row) => sum + row.completedGames, 0);
  const expected = ALPHA_STARTER_BALANCE_MATCHUPS * STRATA * gamesPerStratum;
  const critical = criticalPairs(health);
  const baselineSet = new Set(baselineCriticalPairs);
  const newCriticalPairs = critical.filter((pair) => !baselineSet.has(pair));
  const woodFlorestia = matchup(rows, "wood_midrange", "florestia_tribal");
  const targetFloorGap = Math.max(0, 40 - woodFlorestia.left);

  const score =
    health.criticalMatchups * 1_000_000 +
    newCriticalPairs.length * 500_000 +
    Math.round(targetFloorGap * 20_000) +
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
    tracked: {
      emberWood: matchup(rows, "ember_aggro", "wood_midrange"),
      woodFlorestia,
      tideFlorestia: matchup(rows, "tide_control", "florestia_tribal"),
      voidFlorestia: matchup(rows, "void_shadow", "florestia_tribal"),
      emberFlorestia: matchup(rows, "ember_aggro", "florestia_tribal"),
      florestiaTempestade: matchup(rows, "florestia_tribal", "tempestade_rush"),
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
      b.tracked.woodFlorestia.left - a.tracked.woodFlorestia.left ||
      b.health.healthScore - a.health.healthScore ||
      a.id.localeCompare(b.id),
  );
}

const candidateErrors = validateBalance13CandidateSet();
if (candidateErrors.length) {
  throw new Error(`Alpha starter 1.3 candidate set is invalid: ${candidateErrors.join(" | ")}`);
}

const screenBaseline = runMatrix("baseline_screen", "Certified 1.2 baseline screen", null, SCREEN_GAMES_PER_STRATUM);
const screening = BALANCE_1_3_CANDIDATES.map((candidate) =>
  runMatrix(candidate.id, candidate.label, candidate, SCREEN_GAMES_PER_STRATUM, screenBaseline.criticalPairs),
);

const topIds = new Set(ranked(screening).slice(0, 4).map((result) => result.id));
const finalists = BALANCE_1_3_CANDIDATES.filter((candidate) => topIds.has(candidate.id));

const fullBaseline = runMatrix("baseline_full", "Certified 1.2 baseline control", null, FINAL_GAMES_PER_STRATUM);
const fullFinalists = finalists.map((candidate) =>
  runMatrix(candidate.id, candidate.label, candidate, FINAL_GAMES_PER_STRATUM, fullBaseline.criticalPairs),
);
const finalistRanking = ranked(fullFinalists);
const best = finalistRanking[0];

const allRuns = [screenBaseline, ...screening, fullBaseline, ...fullFinalists];
const qualityErrors = allRuns
  .filter((result) => !result.complete)
  .map((result) => `${result.id}: incomplete matrix ${result.totalGames} games`);

const eligible = finalistRanking.filter((result) =>
  result.complete &&
  result.health.criticalMatchups === 0 &&
  result.newCriticalPairs.length === 0 &&
  result.tracked.woodFlorestia.left >= 40 &&
  result.tracked.woodFlorestia.left <= 60 &&
  Math.abs(result.health.firstPlayerWinRate - 50) <= 2,
);

const report = {
  version: "1.3-round1",
  methodology:
    "Florestia-only two-slot matchup redistribution from certified 1.2; eight 750-game full-matrix screens; top four promoted to 3,000-game finalists; no-new-critical and zero-critical promotion rule",
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
    tracked: result.tracked,
  })),
  finalists: finalists.map((candidate) => ({ id: candidate.id, label: candidate.label, rationale: candidate.rationale })),
  fullBaseline,
  finalistRanking: finalistRanking.map((result) => ({
    id: result.id,
    label: result.label,
    score: result.score,
    health: result.health,
    criticalPairs: result.criticalPairs,
    newCriticalPairs: result.newCriticalPairs,
    tracked: result.tracked,
  })),
  eligible: eligible.map((result) => result.id),
  best,
  improvement: best
    ? {
        criticalMatchups: fullBaseline.health.criticalMatchups - best.health.criticalMatchups,
        watchMatchups: fullBaseline.health.watchMatchups - best.health.watchMatchups,
        healthScore: best.health.healthScore - fullBaseline.health.healthScore,
        woodFlorestia: round1(best.tracked.woodFlorestia.left - fullBaseline.tracked.woodFlorestia.left),
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
    tracked: fullBaseline.tracked,
  },
  finalists: report.finalists,
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
        tracked: best.tracked,
      }
    : null,
}, null, 2));

if (enforceQuality && qualityErrors.length) {
  console.error(`ALPHA STARTER BALANCE 1.3 GRID: BLOCKED QUALITY — ${qualityErrors.join(" | ")}`);
  process.exitCode = 1;
} else {
  console.log(
    `ALPHA STARTER BALANCE 1.3 GRID: COMPLETE — ${report.quality.totalSimulatedGames} games · eligible=${eligible.length} · best=${best?.id ?? "none"} · critical=${best?.health.criticalMatchups ?? "n/a"} · health=${best?.health.healthScore ?? "n/a"}`,
  );
}
