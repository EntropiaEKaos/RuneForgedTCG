import fs from "node:fs";
import { summarizeBalance } from "../src/game/balance-health";
import { RANKED_DECK_POOL_VERSION, RANKED_PRECONS, RANKED_RULESET_VERSION, rankedPreconOverrides, validateRankedPreconPool } from "../src/game/ranked-decks";
import { runBalanceSimulation, type SimulationSummary } from "../src/lib/balance-simulator";

const gamesPerStratum = Math.max(40, Math.min(250, Number(process.argv[2]) || 100));
const strata = Math.max(5, Math.min(8, Number(process.argv[3]) || 8));
const enforce = process.argv.includes("--enforce");
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";

const STRATUM_BASES = [293_000, 911_000, 1_729_000, 2_718_000, 4_137_000, 6_151_000, 8_009_000, 10_007_000] as const;
const overrides = rankedPreconOverrides();

function round1(value: number): number { return Math.round(value * 10) / 10; }
function wilson95(wins: number, total: number): { low: number; high: number } {
  if (!total) return { low: 0, high: 0 };
  const z = 1.96;
  const p = wins / total;
  const z2 = z * z;
  const center = (p + z2 / (2 * total)) / (1 + z2 / total);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total) / (1 + z2 / total);
  return { low: round1(Math.max(0, center - margin) * 100), high: round1(Math.min(1, center + margin) * 100) };
}

function aggregate(parts: SimulationSummary[], deckA: string, deckB: string) {
  const winsA = parts.reduce((sum, row) => sum + row.winsA, 0);
  const winsB = parts.reduce((sum, row) => sum + row.winsB, 0);
  const draws = parts.reduce((sum, row) => sum + row.draws, 0);
  const completedGames = parts.reduce((sum, row) => sum + row.completedGames, 0);
  const firstPlayerWins = parts.reduce((sum, row) => sum + row.firstPlayerWins, 0);
  const secondPlayerWins = parts.reduce((sum, row) => sum + row.secondPlayerWins, 0);
  const decisive = Math.max(1, winsA + winsB);
  const firstDecisive = Math.max(1, firstPlayerWins + secondPlayerWins);
  const seedWinRates = parts.map((row) => row.winRateA);
  const pooled = round1(winsA / decisive * 100);
  const medianSamples = parts.map((row) => row.roundDistribution.median).sort((a, b) => a - b);
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
    winRateB: round1(winsB / decisive * 100),
    firstPlayerWins,
    secondPlayerWins,
    firstPlayerWinRate: round1(firstPlayerWins / firstDecisive * 100),
    winRateA95: wilson95(winsA, decisive),
    seed: parts[0]?.seed || 0,
    engineVersion: parts[0]?.engineVersion || "unknown",
    rulesetVersion: parts[0]?.rulesetVersion || "unknown",
    roundDistribution: {
      min: Math.min(...parts.map((row) => row.roundDistribution.min)),
      max: Math.max(...parts.map((row) => row.roundDistribution.max)),
      median: medianSamples[Math.floor(medianSamples.length / 2)] || 0,
    },
    seedStrata: parts.map((row) => row.seed),
    seedWinRates,
    maxSeedDeviation: round1(Math.max(...seedWinRates.map((rate) => Math.abs(rate - pooled)))),
  };
}

const poolErrors = validateRankedPreconPool();
const rows: Array<ReturnType<typeof aggregate>> = [];
for (let left = 0; left < RANKED_PRECONS.length; left += 1) {
  for (let right = left + 1; right < RANKED_PRECONS.length; right += 1) {
    const leftDeck = RANKED_PRECONS[left];
    const rightDeck = RANKED_PRECONS[right];
    const parts: SimulationSummary[] = [];
    for (let stratum = 0; stratum < strata; stratum += 1) {
      const seed = STRATUM_BASES[stratum] + leftDeck.certificationSeedSlot * 1009 + rightDeck.certificationSeedSlot * 97;
      parts.push(runBalanceSimulation(leftDeck.id, rightDeck.id, gamesPerStratum, seed, overrides));
    }
    rows.push(aggregate(parts, leftDeck.id, rightDeck.id));
  }
}

const health = summarizeBalance(rows);
// Stability is based on each deterministic stratum's deviation from the pooled
// estimate. Three standard errors at p=.5 is intentionally stricter than the
// old max-spread heuristic while avoiding a multiple-comparison penalty for
// merely adding more independent holdout strata.
const stabilityThreshold = round1(Math.max(10, 3 * Math.sqrt(0.25 / gamesPerStratum) * 100));
const unstable = rows.filter((row) => row.maxSeedDeviation > stabilityThreshold);
const stability = {
  metric: "maximum absolute stratum deviation from pooled matchup win rate",
  threshold: stabilityThreshold,
  stableMatchups: rows.length - unstable.length,
  unstableMatchups: unstable.length,
  maxSeedDeviation: round1(Math.max(...rows.map((row) => row.maxSeedDeviation))),
  unstable: unstable.map((row) => ({ deckA: row.deckA, deckB: row.deckB, maxSeedDeviation: row.maxSeedDeviation, seedWinRates: row.seedWinRates })),
};

const certifiedGate = poolErrors.length === 0 && health.releaseGate === "pass" && unstable.length === 0 ? "pass" : "blocked";
const report = {
  version: "2.97",
  rankedRulesVersion: RANKED_RULESET_VERSION,
  rankedDeckPoolVersion: RANKED_DECK_POOL_VERSION,
  methodology: "certified immutable Ranked precon pool; 8 deterministic seed strata; alternating deck side + first player; independent holdout strata included",
  gamesPerStratum,
  strata,
  gamesPerMatchup: gamesPerStratum * strata,
  matchups: rows.length,
  totalGames: rows.length * gamesPerStratum * strata,
  certifiedDecks: RANKED_PRECONS.map((deck) => deck.id),
  poolErrors,
  health,
  stability,
  certifiedGate,
  rows,
};
const json = JSON.stringify(report, null, 2);
console.log(json);
if (writePath) fs.writeFileSync(writePath, `${json}\n`);
if (enforce && certifiedGate !== "pass") {
  console.error(`RANKED BALANCE GATE 2.97: BLOCKED (${health.criticalMatchups} critical, ${health.watchMatchups} watch, ${unstable.length} unstable, ${poolErrors.length} pool errors)`);
  process.exitCode = 1;
} else if (enforce) {
  console.log(`RANKED BALANCE GATE 2.97: PASS (${report.totalGames} games, ${rows.length}/${rows.length} stable matchups)`);
}
