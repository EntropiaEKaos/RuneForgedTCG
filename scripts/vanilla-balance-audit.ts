import fs from "node:fs";
import { evaluateMatchup, summarizeBalance } from "../src/game/balance-health";
import {
  VANILLA_BALANCE_LAB_MATCHUPS,
  VANILLA_BALANCE_LAB_VERSION,
  VANILLA_BALANCE_STRATUM_BASES,
  validateVanillaBalancePool,
  vanillaBalanceMatchups,
  vanillaBalanceSeed,
  vanillaExperimentalOverrides,
} from "../src/game/vanilla-balance-lab";
import { VANILLA_EXPERIMENTAL_DECKS } from "../src/game/vanilla-experimental-decks";
import { runBalanceSimulation, type SimulationSummary } from "../src/lib/balance-simulator";

const gamesPerStratum = Math.max(10, Math.min(250, Number(process.argv[2]) || 40));
const strata = Math.max(3, Math.min(VANILLA_BALANCE_STRATUM_BASES.length, Number(process.argv[3]) || 5));
const enforce = process.argv.includes("--enforce");
const printFull = process.argv.includes("--print-full");
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";
const overrides = vanillaExperimentalOverrides();

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
  const pooled = round1((winsA / decisive) * 100);
  const medianSamples = parts.map((row) => row.roundDistribution.median).sort((a, b) => a - b);
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

type AggregatedRow = ReturnType<typeof aggregate>;

const poolErrors = validateVanillaBalancePool();
const rows: AggregatedRow[] = [];
for (const matchup of vanillaBalanceMatchups()) {
  const parts: SimulationSummary[] = [];
  for (let stratum = 0; stratum < strata; stratum += 1) {
    parts.push(
      runBalanceSimulation(
        matchup.leftId,
        matchup.rightId,
        gamesPerStratum,
        vanillaBalanceSeed(matchup, stratum),
        overrides,
      ),
    );
  }
  rows.push(aggregate(parts, matchup.leftId, matchup.rightId));
}

const health = summarizeBalance(rows);
const stabilityThreshold = round1(Math.max(10, 3 * Math.sqrt(0.25 / gamesPerStratum) * 100));
const unstable = rows.filter((row) => row.maxSeedDeviation > stabilityThreshold);
const incomplete = rows.filter((row) => row.completedGames !== row.requestedGames);
const totalGames = rows.reduce((sum, row) => sum + row.completedGames, 0);
const totalDraws = rows.reduce((sum, row) => sum + row.draws, 0);
const drawRate = round1((totalDraws / Math.max(1, totalGames)) * 100);
const totalRounds = rows.reduce((sum, row) => sum + row.avgRounds * row.completedGames, 0);
const overallAvgRounds = round1(totalRounds / Math.max(1, totalGames));

const deckSummaries = VANILLA_EXPERIMENTAL_DECKS.map((deck) => {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let games = 0;
  let critical = 0;
  let watch = 0;
  let healthy = 0;
  for (const row of rows) {
    if (row.deckA !== deck.id && row.deckB !== deck.id) continue;
    const asA = row.deckA === deck.id;
    wins += asA ? row.winsA : row.winsB;
    losses += asA ? row.winsB : row.winsA;
    draws += row.draws;
    games += row.completedGames;
    const rate = asA ? row.winRateA : row.winRateB;
    const matchupHealth = evaluateMatchup(rate).status;
    if (matchupHealth === "critical") critical += 1;
    else if (matchupHealth === "watch") watch += 1;
    else healthy += 1;
  }
  const decisive = Math.max(1, wins + losses);
  const winRate = round1((wins / decisive) * 100);
  return {
    id: deck.id,
    name: deck.name,
    region: deck.regions[0],
    games,
    wins,
    losses,
    draws,
    winRate,
    winRate95: wilson95(wins, decisive),
    matchupHealth: { healthy, watch, critical },
    distanceFromParity: round1(Math.abs(winRate - 50)),
  };
}).sort((a, b) => b.winRate - a.winRate || a.id.localeCompare(b.id));

const regionSummaries = [...new Set(VANILLA_EXPERIMENTAL_DECKS.map((deck) => deck.regions[0]))].map((region) => {
  const members = deckSummaries.filter((deck) => deck.region === region);
  const wins = members.reduce((sum, deck) => sum + deck.wins, 0);
  const losses = members.reduce((sum, deck) => sum + deck.losses, 0);
  const draws = members.reduce((sum, deck) => sum + deck.draws, 0);
  const decisive = Math.max(1, wins + losses);
  return {
    region,
    decks: members.map((deck) => deck.id),
    wins,
    losses,
    draws,
    winRate: round1((wins / decisive) * 100),
    winRate95: wilson95(wins, decisive),
  };
}).sort((a, b) => b.winRate - a.winRate || a.region.localeCompare(b.region));

const matchupRows = vanillaBalanceMatchups();
const sameRegionMatchups = matchupRows.filter((row) => row.sameRegion).length;
const crossRegionMatchups = matchupRows.length - sameRegionMatchups;
const strongestDeck = deckSummaries[0];
const weakestDeck = deckSummaries.at(-1)!;
const mostExtremeMatchup = [...rows].sort(
  (a, b) => Math.abs(b.winRateA - 50) - Math.abs(a.winRateA - 50),
)[0];

const simulationQuality = {
  expectedMatchups: VANILLA_BALANCE_LAB_MATCHUPS,
  completedMatchups: rows.length,
  incompleteMatchups: incomplete.length,
  poolErrors,
  stabilityMetric: "maximum absolute stratum deviation from pooled matchup win rate",
  stabilityThreshold,
  stableMatchups: rows.length - unstable.length,
  unstableMatchups: unstable.length,
  maxSeedDeviation: round1(Math.max(...rows.map((row) => row.maxSeedDeviation))),
  drawRate,
  gate:
    poolErrors.length === 0 &&
    rows.length === VANILLA_BALANCE_LAB_MATCHUPS &&
    incomplete.length === 0 &&
    unstable.length === 0
      ? "pass"
      : "blocked",
};

const report = {
  version: VANILLA_BALANCE_LAB_VERSION,
  methodology:
    "12 isolated Vanilla experimental precons via simulator overrides; full 66-matchup round robin; deterministic independent seed strata; alternating deck side and first player; Wilson 95%; balance findings are evidence, not an intake gate",
  gamesPerStratum,
  strata,
  gamesPerMatchup: gamesPerStratum * strata,
  matchups: rows.length,
  sameRegionMatchups,
  crossRegionMatchups,
  totalGames,
  overallAvgRounds,
  firstPlayerWinRate: health.firstPlayerWinRate,
  drawRate,
  balanceStatus: health.releaseGate,
  health,
  simulationQuality,
  strongestDeck,
  weakestDeck,
  mostExtremeMatchup,
  deckSummaries,
  regionSummaries,
  unstableMatchups: unstable.map((row) => ({
    deckA: row.deckA,
    deckB: row.deckB,
    maxSeedDeviation: row.maxSeedDeviation,
    seedWinRates: row.seedWinRates,
  })),
  rows,
};

const compact = {
  version: report.version,
  methodology: report.methodology,
  gamesPerStratum: report.gamesPerStratum,
  strata: report.strata,
  gamesPerMatchup: report.gamesPerMatchup,
  matchups: report.matchups,
  sameRegionMatchups: report.sameRegionMatchups,
  crossRegionMatchups: report.crossRegionMatchups,
  totalGames: report.totalGames,
  overallAvgRounds: report.overallAvgRounds,
  firstPlayerWinRate: report.firstPlayerWinRate,
  drawRate: report.drawRate,
  balanceStatus: report.balanceStatus,
  health: report.health,
  simulationQuality: report.simulationQuality,
  strongestDeck: report.strongestDeck,
  weakestDeck: report.weakestDeck,
  mostExtremeMatchup: report.mostExtremeMatchup,
  deckSummaries: report.deckSummaries,
  regionSummaries: report.regionSummaries,
};

const json = JSON.stringify(report, null, 2);
if (writePath) fs.writeFileSync(writePath, `${json}\n`);
console.log(JSON.stringify(printFull ? report : compact, null, 2));

if (enforce && simulationQuality.gate !== "pass") {
  console.error(
    `VANILLA BALANCE LAB 1.1: BLOCKED — quality gate failed (${poolErrors.length} pool errors, ${incomplete.length} incomplete, ${unstable.length} unstable)`,
  );
  process.exitCode = 1;
} else if (enforce) {
  console.log(
    `VANILLA BALANCE LAB 1.1: PASS — ${totalGames} games · ${rows.length}/${VANILLA_BALANCE_LAB_MATCHUPS} matchups · balance=${health.releaseGate} · health=${health.healthScore}`,
  );
}
