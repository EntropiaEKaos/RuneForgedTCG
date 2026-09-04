import fs from "node:fs";
import { summarizeBalance } from "../src/game/balance-health";
import {
  ALPHA_STARTER_BALANCE_MATCHUPS,
  alphaStarterBalanceMatchups,
  alphaStarterBalanceSeed,
} from "../src/game/alpha-starter-balance";
import {
  BALANCE_1_4_CANDIDATES,
  overridesForBalance14Candidate,
  validateBalance14CandidateSet,
  type Balance14Candidate,
} from "../src/game/alpha-starter-balance-1-4";
import {
  runStackAwareBalanceSimulation,
  type SimulationSummary,
} from "../src/lib/balance-simulator";

const FINAL_GAMES_PER_STRATUM = Math.max(20, Math.min(60, Number(process.env.ALPHA_1_4_FINAL_GAMES) || 40));
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
  candidate: Balance14Candidate | null,
  baselineCriticalPairs: readonly string[] = [],
): MatrixResult {
  const overrides = candidate ? overridesForBalance14Candidate(candidate) : undefined;
  const rows: MatrixRow[] = [];

  for (const pair of alphaStarterBalanceMatchups()) {
    const parts: SimulationSummary[] = [];
    for (let stratum = 0; stratum < STRATA; stratum += 1) {
      parts.push(
        runStackAwareBalanceSimulation(
          pair.leftId,
          pair.rightId,
          FINAL_GAMES_PER_STRATUM,
          alphaStarterBalanceSeed(pair, stratum),
          overrides,
        ),
      );
    }
    rows.push(aggregate(parts, pair.leftId, pair.rightId));
  }

  const health = summarizeBalance(rows);
  const totalGames = rows.reduce((sum, row) => sum + row.completedGames, 0);
  const expected = ALPHA_STARTER_BALANCE_MATCHUPS * STRATA * FINAL_GAMES_PER_STRATUM;
  const critical = criticalPairs(health);
  const baselineSet = new Set(baselineCriticalPairs);
  const newCriticalPairs = critical.filter((pair) => !baselineSet.has(pair));

  const tracked = {
    emberTide: matchup(rows, "ember_aggro", "tide_control"),
    emberWood: matchup(rows, "ember_aggro", "wood_midrange"),
    emberTempestade: matchup(rows, "ember_aggro", "tempestade_rush"),
    tideWood: matchup(rows, "tide_control", "wood_midrange"),
    tideVoid: matchup(rows, "tide_control", "void_shadow"),
    tideFlorestia: matchup(rows, "tide_control", "florestia_tribal"),
    tideTempestade: matchup(rows, "tide_control", "tempestade_rush"),
    woodFlorestia: matchup(rows, "wood_midrange", "florestia_tribal"),
    woodTempestade: matchup(rows, "wood_midrange", "tempestade_rush"),
  };

  const targetPenalty =
    Math.max(0, 40 - tracked.emberTide.left) * 50_000 +
    Math.max(0, 40 - tracked.tideWood.left) * 50_000 +
    Math.max(0, 40 - tracked.tideFlorestia.left) * 50_000 +
    Math.max(0, 40 - tracked.tideTempestade.left) * 50_000;

  const score =
    health.criticalMatchups * 1_000_000 +
    newCriticalPairs.length * 500_000 +
    health.watchMatchups * 50_000 +
    targetPenalty +
    (100 - health.healthScore) * 100 +
    Math.round(Math.abs(health.firstPlayerWinRate - 50) * 10);

  return {
    id,
    label,
    candidateId: candidate?.id ?? null,
    gamesPerStratum: FINAL_GAMES_PER_STRATUM,
    totalGames,
    complete: totalGames === expected && rows.every((row) => row.completedGames === row.requestedGames),
    health,
    criticalPairs: critical,
    newCriticalPairs,
    tracked,
    score,
    rows,
  };
}

function ranked(results: MatrixResult[]): MatrixResult[] {
  return [...results].sort(
    (a, b) =>
      a.score - b.score ||
      a.health.criticalMatchups - b.health.criticalMatchups ||
      a.health.watchMatchups - b.health.watchMatchups ||
      b.health.healthScore - a.health.healthScore ||
      a.id.localeCompare(b.id),
  );
}

const candidateErrors = validateBalance14CandidateSet();
if (candidateErrors.length) {
  throw new Error(`Alpha starter 1.4 Round 3 candidate set is invalid: ${candidateErrors.join(" | ")}`);
}

const fullBaseline = runMatrix("baseline_full", "Certified 1.3 baseline control", null);
const fullCandidates = BALANCE_1_4_CANDIDATES.map((candidate) =>
  runMatrix(candidate.id, candidate.label, candidate, fullBaseline.criticalPairs),
);
const ranking = ranked(fullCandidates);
const best = ranking[0];

const allRuns = [fullBaseline, ...fullCandidates];
const qualityErrors = allRuns
  .filter((result) => !result.complete)
  .map((result) => `${result.id}: incomplete matrix ${result.totalGames} games`);

const eligible = ranking.filter((result) =>
  result.complete &&
  result.health.criticalMatchups === 0 &&
  result.newCriticalPairs.length === 0 &&
  result.health.watchMatchups < fullBaseline.health.watchMatchups &&
  result.health.healthScore > fullBaseline.health.healthScore &&
  result.tracked.emberTempestade.left === fullBaseline.tracked.emberTempestade.left &&
  result.tracked.woodTempestade.left === fullBaseline.tracked.woodTempestade.left &&
  result.tracked.woodFlorestia.left === fullBaseline.tracked.woodFlorestia.left &&
  result.tracked.emberTide.left >= 40 &&
  result.tracked.tideWood.left >= 40 &&
  result.tracked.tideFlorestia.left >= 40 &&
  result.tracked.tideTempestade.left >= 40 &&
  Math.abs(result.health.firstPlayerWinRate - 50) <= 2,
);

const report = {
  version: "1.4-round3",
  methodology:
    "Tide-only full-matrix verification after rejected Ember/Tide and Tempestade/Tide rounds; four canonical-recipe overrides each tested directly at 3,000 games; zero-critical watch-compression promotion rule; non-Tide boundary matchups frozen",
  finalistGamesPerStratum: FINAL_GAMES_PER_STRATUM,
  strata: STRATA,
  fullBaseline,
  candidateRanking: ranking.map((result) => ({
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
  candidateRanking: report.candidateRanking,
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
  console.error(`ALPHA STARTER BALANCE 1.4 ROUND 3: BLOCKED QUALITY — ${qualityErrors.join(" | ")}`);
  process.exitCode = 1;
} else {
  console.log(
    `ALPHA STARTER BALANCE 1.4 ROUND 3: COMPLETE — ${report.quality.totalSimulatedGames} games · eligible=${eligible.length} · best=${best?.id ?? "none"} · critical=${best?.health.criticalMatchups ?? "n/a"} · watch=${best?.health.watchMatchups ?? "n/a"} · health=${best?.health.healthScore ?? "n/a"}`,
  );
}
