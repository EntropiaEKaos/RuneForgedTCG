import fs from "node:fs";
import { summarizeBalance } from "../src/game/balance-health";
import {
  ALPHA_STARTER_BALANCE_MATCHUPS,
  alphaStarterBalanceMatchups,
  alphaStarterBalanceSeed,
} from "../src/game/alpha-starter-balance";
import {
  ALPHA_RECIPE_CANDIDATES,
  ALPHA_STARTER_BALANCE_RECIPE_VERSION,
  recipeOverridesForCandidates,
  validateRecipeCandidateSet,
  type AlphaRecipeCandidate,
  type AlphaRecipeFamily,
} from "../src/game/alpha-starter-balance-1-1";
import {
  runStackAwareBalanceSimulation,
  type SimulationSummary,
} from "../src/lib/balance-simulator";

const SCREEN_GAMES_PER_STRATUM = Math.max(6, Math.min(30, Number(process.env.ALPHA_RECIPE_SCREEN_GAMES) || 10));
const FINAL_GAMES_PER_STRATUM = Math.max(20, Math.min(60, Number(process.env.ALPHA_RECIPE_FINAL_GAMES) || 40));
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

interface MatrixResult {
  id: string;
  label: string;
  candidateIds: string[];
  gamesPerStratum: number;
  totalGames: number;
  complete: boolean;
  health: ReturnType<typeof summarizeBalance>;
  score: number;
  rows: MatrixRow[];
}

function scoreMatrix(health: ReturnType<typeof summarizeBalance>): number {
  return (
    health.criticalMatchups * 100_000 +
    health.watchMatchups * 10_000 +
    (100 - health.healthScore) * 100 +
    Math.round(Math.abs(health.firstPlayerWinRate - 50) * 10)
  );
}

function runMatrix(
  id: string,
  label: string,
  candidates: readonly AlphaRecipeCandidate[],
  gamesPerStratum: number,
): MatrixResult {
  const overrides = candidates.length ? recipeOverridesForCandidates(candidates) : undefined;
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
  return {
    id,
    label,
    candidateIds: candidates.map((candidate) => candidate.id),
    gamesPerStratum,
    totalGames,
    complete: totalGames === expected && rows.every((row) => row.completedGames === row.requestedGames),
    health,
    score: scoreMatrix(health),
    rows,
  };
}

function familyCandidates(family: AlphaRecipeFamily): AlphaRecipeCandidate[] {
  return ALPHA_RECIPE_CANDIDATES.filter((candidate) => candidate.family === family);
}

function ranked(results: MatrixResult[]): MatrixResult[] {
  return [...results].sort(
    (a, b) =>
      a.score - b.score ||
      b.health.healthScore - a.health.healthScore ||
      a.id.localeCompare(b.id),
  );
}

const candidateErrors = validateRecipeCandidateSet();
if (candidateErrors.length) {
  throw new Error(`Alpha starter recipe candidate set is invalid: ${candidateErrors.join(" | ")}`);
}

const screeningBaseline = runMatrix("baseline_screen", "Baseline screen", [], SCREEN_GAMES_PER_STRATUM);
const screening = ALPHA_RECIPE_CANDIDATES.map((candidate) =>
  runMatrix(candidate.id, candidate.label, [candidate], SCREEN_GAMES_PER_STRATUM),
);

const topWoodIds = new Set(ranked(screening.filter((result) =>
  familyCandidates("wood").some((candidate) => candidate.id === result.id)
)).slice(0, 2).map((result) => result.id));
const topTideIds = new Set(ranked(screening.filter((result) =>
  familyCandidates("tide").some((candidate) => candidate.id === result.id)
)).slice(0, 2).map((result) => result.id));

const topWood = familyCandidates("wood").filter((candidate) => topWoodIds.has(candidate.id));
const topTide = familyCandidates("tide").filter((candidate) => topTideIds.has(candidate.id));

const fullBaseline = runMatrix("baseline_full", "Certified recipe baseline control", [], FINAL_GAMES_PER_STRATUM);
const finalists: MatrixResult[] = [];
for (const wood of topWood) {
  for (const tide of topTide) {
    finalists.push(
      runMatrix(
        `${wood.id}__${tide.id}`,
        `${wood.label} + ${tide.label}`,
        [wood, tide],
        FINAL_GAMES_PER_STRATUM,
      ),
    );
  }
}
const finalistRanking = ranked(finalists);
const bestFinalist = finalistRanking[0];

const allRuns = [screeningBaseline, ...screening, fullBaseline, ...finalists];
const qualityErrors = allRuns
  .filter((result) => !result.complete)
  .map((result) => `${result.id}: incomplete matrix ${result.totalGames} games`);

const report = {
  version: ALPHA_STARTER_BALANCE_RECIPE_VERSION,
  methodology:
    "recipe-only screening; canonical slot-local replacements; stack-aware simulator; same five deterministic strata; full 15-matchup round robin for every candidate; top two Wood and top two Tide candidates cross-combined; finalists and baseline rerun at 200 games/matchup",
  screeningGamesPerStratum: SCREEN_GAMES_PER_STRATUM,
  finalistGamesPerStratum: FINAL_GAMES_PER_STRATUM,
  strata: STRATA,
  screeningBaseline,
  screeningRanking: ranked(screening).map((result) => ({
    id: result.id,
    label: result.label,
    score: result.score,
    health: result.health,
  })),
  selectedWood: topWood.map((candidate) => ({ id: candidate.id, label: candidate.label, rationale: candidate.rationale })),
  selectedTide: topTide.map((candidate) => ({ id: candidate.id, label: candidate.label, rationale: candidate.rationale })),
  fullBaseline,
  finalistRanking: finalistRanking.map((result) => ({
    id: result.id,
    label: result.label,
    score: result.score,
    health: result.health,
  })),
  bestFinalist,
  improvement: bestFinalist
    ? {
        criticalMatchups: fullBaseline.health.criticalMatchups - bestFinalist.health.criticalMatchups,
        watchMatchups: fullBaseline.health.watchMatchups - bestFinalist.health.watchMatchups,
        healthScore: bestFinalist.health.healthScore - fullBaseline.health.healthScore,
        firstPlayerSkew:
          round1(Math.abs(fullBaseline.health.firstPlayerWinRate - 50) - Math.abs(bestFinalist.health.firstPlayerWinRate - 50)),
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
    score: fullBaseline.score,
  },
  selectedWood: report.selectedWood,
  selectedTide: report.selectedTide,
  finalistRanking: report.finalistRanking,
  improvement: report.improvement,
  bestFinalist: bestFinalist
    ? {
        id: bestFinalist.id,
        label: bestFinalist.label,
        health: bestFinalist.health,
        score: bestFinalist.score,
      }
    : null,
}, null, 2));

if (enforceQuality && qualityErrors.length) {
  console.error(`ALPHA STARTER BALANCE 1.1 GRID: BLOCKED QUALITY — ${qualityErrors.join(" | ")}`);
  process.exitCode = 1;
} else {
  console.log(
    `ALPHA STARTER BALANCE 1.1 GRID: COMPLETE — ${report.quality.totalSimulatedGames} games · best=${bestFinalist?.id ?? "none"} · critical=${bestFinalist?.health.criticalMatchups ?? "n/a"} · watch=${bestFinalist?.health.watchMatchups ?? "n/a"} · health=${bestFinalist?.health.healthScore ?? "n/a"}`,
  );
}
