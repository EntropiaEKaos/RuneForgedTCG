import fs from "node:fs";
import { DECKS } from "../src/game/decks";
import { summarizeBalance } from "../src/game/balance-health";
import { runBalanceSimulation, type SimulationSummary } from "../src/lib/balance-simulator";

const gamesPerStratum = Math.max(20, Math.min(250, Number(process.argv[2]) || 40));
const strata = Math.max(3, Math.min(8, Number(process.argv[3]) || 5));
const enforce = process.argv.includes("--enforce");
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";

// Fixed, widely separated strata make the certification reproducible while
// avoiding the accidental seed-block overfitting observed in the 2.93 audit.
const STRATUM_BASES = [293_000, 911_000, 1_729_000, 2_718_000, 4_137_000, 6_151_000, 8_009_000, 10_007_000] as const;

function round1(value: number): number { return Math.round(value * 10) / 10; }
function wilson95(wins: number, total: number): { low: number; high: number } {
  if (!total) return { low: 0, high: 0 };
  const z = 1.96, p = wins / total, z2 = z * z;
  const center = (p + z2 / (2 * total)) / (1 + z2 / total);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total) / (1 + z2 / total);
  return { low: round1(Math.max(0, center - margin) * 100), high: round1(Math.min(1, center + margin) * 100) };
}

function aggregate(parts: SimulationSummary[], deckA: string, deckB: string): SimulationSummary & { seedStrata:number[]; seedWinRates:number[]; seedSpread:number } {
  const winsA = parts.reduce((sum, row) => sum + row.winsA, 0), winsB = parts.reduce((sum, row) => sum + row.winsB, 0);
  const draws = parts.reduce((sum, row) => sum + row.draws, 0), completedGames = parts.reduce((sum, row) => sum + row.completedGames, 0);
  const firstPlayerWins = parts.reduce((sum, row) => sum + row.firstPlayerWins, 0), secondPlayerWins = parts.reduce((sum, row) => sum + row.secondPlayerWins, 0);
  const decisive = Math.max(1, winsA + winsB), firstDecisive = Math.max(1, firstPlayerWins + secondPlayerWins);
  const seedWinRates = parts.map((row) => row.winRateA);
  const medianSamples = parts.map((row) => row.roundDistribution.median).sort((a,b) => a-b);
  return {
    deckA, deckB,
    requestedGames: parts.reduce((sum, row) => sum + row.requestedGames, 0), completedGames,
    winsA, winsB, draws,
    avgRounds: Math.round(parts.reduce((sum, row) => sum + row.avgRounds * row.completedGames, 0) / Math.max(1, completedGames)),
    winRateA: round1(winsA / decisive * 100), winRateB: round1(winsB / decisive * 100),
    firstPlayerWins, secondPlayerWins, firstPlayerWinRate: round1(firstPlayerWins / firstDecisive * 100),
    winRateA95: wilson95(winsA, decisive),
    seed: parts[0]?.seed || 0,
    engineVersion: parts[0]?.engineVersion || "unknown", rulesetVersion: parts[0]?.rulesetVersion || "unknown",
    roundDistribution: {
      min: Math.min(...parts.map((row) => row.roundDistribution.min)),
      max: Math.max(...parts.map((row) => row.roundDistribution.max)),
      median: medianSamples[Math.floor(medianSamples.length / 2)] || 0,
    },
    seedStrata: parts.map((row) => row.seed), seedWinRates,
    seedSpread: round1(Math.max(...seedWinRates) - Math.min(...seedWinRates)),
  };
}

const rows: Array<ReturnType<typeof aggregate>> = [];
for (let left = 0; left < DECKS.length; left += 1) {
  for (let right = left + 1; right < DECKS.length; right += 1) {
    const parts: SimulationSummary[] = [];
    for (let stratum = 0; stratum < strata; stratum += 1) {
      const seed = STRATUM_BASES[stratum] + left * 1009 + right * 97;
      parts.push(runBalanceSimulation(DECKS[left].id, DECKS[right].id, gamesPerStratum, seed));
    }
    rows.push(aggregate(parts, DECKS[left].id, DECKS[right].id));
  }
}

const health = summarizeBalance(rows);
// Seed-to-seed spread is judged relative to per-stratum sampling noise.
// Four binomial standard errors at p=.5 keeps the default 40-game stratum
// from flagging ordinary variance while converging to 20pp at 100 games.
const stabilityThreshold = round1(Math.max(15, 4 * Math.sqrt(0.25 / gamesPerStratum) * 100));
const unstable = rows.filter((row) => row.seedSpread >= stabilityThreshold);
const stability = {
  threshold: stabilityThreshold,
  stableMatchups: rows.length - unstable.length,
  unstableMatchups: unstable.length,
  maxSeedSpread: round1(Math.max(...rows.map((row) => row.seedSpread))),
  unstable: unstable.map((row) => ({ deckA: row.deckA, deckB: row.deckB, seedSpread: row.seedSpread, seedWinRates: row.seedWinRates })),
};
const certifiedGate = health.releaseGate === "pass" && unstable.length === 0 ? "pass" : health.releaseGate === "blocked" ? "blocked" : "review";
const report = {
  version: "2.96",
  methodology: "stratified deterministic seed blocks; alternating deck side + first player inside each stratum",
  gamesPerStratum, strata, gamesPerMatchup: gamesPerStratum * strata,
  matchups: rows.length,
  totalGames: rows.length * gamesPerStratum * strata,
  health,
  stability,
  certifiedGate,
  rows,
};
const json = JSON.stringify(report, null, 2);
console.log(json);
if (writePath) fs.writeFileSync(writePath, `${json}\n`);
if (enforce && certifiedGate !== "pass") {
  console.error(`RANKED BALANCE GATE 2.96: ${certifiedGate.toUpperCase()} (${health.criticalMatchups} critical, ${health.watchMatchups} watch, ${unstable.length} seed-sensitive)`);
  process.exitCode = 1;
}
