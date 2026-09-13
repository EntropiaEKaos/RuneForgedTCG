import fs from "node:fs";
import { evaluateMatchup, summarizeBalance } from "../src/game/balance-health";
import {
  VANILLA_BALANCE_LAB_MATCHUPS,
  VANILLA_BALANCE_STRATUM_BASES,
  validateVanillaBalancePool,
  vanillaBalanceMatchups,
  vanillaBalanceSeed,
  vanillaExperimentalOverrides,
} from "../src/game/vanilla-balance-lab";
import { VANILLA_EXPERIMENTAL_DECKS } from "../src/game/vanilla-experimental-decks";
import { runBalanceSimulation, type SimulationSummary } from "../src/lib/balance-simulator";

const TARGET = "vanilla_forest_2";
const GAMES_PER_STRATUM = 40;
const STRATA = 5;
const BASELINE = {
  healthScore: 74,
  healthyMatchups: 29,
  watchMatchups: 17,
  criticalMatchups: 20,
  florestiaWinRate: 40.4,
  florestiaCriticalMatchups: 6,
} as const;
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";

const targetDeck = VANILLA_EXPERIMENTAL_DECKS.find((deck) => deck.id === TARGET);
if (!targetDeck) throw new Error(`Missing ${TARGET}`);
const baseThirty = [...new Set(targetDeck.cards)];
if (baseThirty.length !== 30) throw new Error(`Expected 30 unique Florestia cards, found ${baseThirty.length}`);

const cardId = (suffix: string) => `van_forest_${suffix}`;
const FINALIST_CORE = ["u04", "u05", "u13", "u14", "u16"] as const;
const finalistCards = [...baseThirty, ...FINALIST_CORE.flatMap((suffix) => [cardId(suffix), cardId(suffix)])];
if (finalistCards.length !== 40) throw new Error(`Expected 40-card finalist recipe`);
const finalistCounts = new Map<string, number>();
for (const id of finalistCards) finalistCounts.set(id, (finalistCounts.get(id) ?? 0) + 1);
if (finalistCounts.size !== 30) throw new Error(`Finalist lost regional definition coverage`);
if (Math.max(...finalistCounts.values()) > 3) throw new Error(`Finalist exceeds the three-copy ceiling`);

const overrides = vanillaExperimentalOverrides();
overrides[TARGET] = {
  id: TARGET,
  name: `${targetDeck.name} · Vanilla 1.9 finalist`,
  cards: finalistCards,
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function aggregate(parts: SimulationSummary[], deckA: string, deckB: string) {
  const winsA = parts.reduce((sum, row) => sum + row.winsA, 0);
  const winsB = parts.reduce((sum, row) => sum + row.winsB, 0);
  const draws = parts.reduce((sum, row) => sum + row.draws, 0);
  const completedGames = parts.reduce((sum, row) => sum + row.completedGames, 0);
  const requestedGames = parts.reduce((sum, row) => sum + row.requestedGames, 0);
  const firstPlayerWins = parts.reduce((sum, row) => sum + row.firstPlayerWins, 0);
  const secondPlayerWins = parts.reduce((sum, row) => sum + row.secondPlayerWins, 0);
  const decisive = Math.max(1, winsA + winsB);
  const seedWinRates = parts.map((row) => row.winRateA);
  const pooled = round1((winsA / decisive) * 100);
  return {
    deckA,
    deckB,
    requestedGames,
    completedGames,
    winsA,
    winsB,
    draws,
    winRateA: pooled,
    winRateB: round1((winsB / decisive) * 100),
    firstPlayerWins,
    secondPlayerWins,
    maxSeedDeviation: round1(Math.max(...seedWinRates.map((rate) => Math.abs(rate - pooled)))),
    seedWinRates,
  };
}

type AggregatedRow = ReturnType<typeof aggregate>;

const poolErrors = validateVanillaBalancePool();
if (poolErrors.length > 0) throw new Error(`Invalid Vanilla pool: ${poolErrors.join(" | ")}`);

const rows: AggregatedRow[] = [];
for (const matchup of vanillaBalanceMatchups()) {
  const parts: SimulationSummary[] = [];
  for (let stratum = 0; stratum < STRATA; stratum += 1) {
    parts.push(
      runBalanceSimulation(
        matchup.leftId,
        matchup.rightId,
        GAMES_PER_STRATUM,
        vanillaBalanceSeed(matchup, stratum),
        overrides,
      ),
    );
  }
  rows.push(aggregate(parts, matchup.leftId, matchup.rightId));
}

if (rows.length !== VANILLA_BALANCE_LAB_MATCHUPS) {
  throw new Error(`Expected ${VANILLA_BALANCE_LAB_MATCHUPS} matchups, found ${rows.length}`);
}
const incomplete = rows.filter((row) => row.completedGames !== row.requestedGames);
const stabilityThreshold = round1(Math.max(10, 3 * Math.sqrt(0.25 / GAMES_PER_STRATUM) * 100));
const unstable = rows.filter((row) => row.maxSeedDeviation > stabilityThreshold);
const totalGames = rows.reduce((sum, row) => sum + row.completedGames, 0);
const expectedTotalGames = VANILLA_BALANCE_LAB_MATCHUPS * GAMES_PER_STRATUM * STRATA;
if (totalGames !== expectedTotalGames) throw new Error(`Expected ${expectedTotalGames} games, found ${totalGames}`);
if (incomplete.length > 0) throw new Error(`${incomplete.length} incomplete matchups`);
if (unstable.length > 0) {
  throw new Error(`Simulation stability blocked: ${unstable.length} matchups exceeded ${stabilityThreshold}pp`);
}

const health = summarizeBalance(rows);
const deckSummaries = VANILLA_EXPERIMENTAL_DECKS.map((deck) => {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let games = 0;
  let healthy = 0;
  let watch = 0;
  let critical = 0;
  const matchups = [];
  for (const row of rows) {
    if (row.deckA !== deck.id && row.deckB !== deck.id) continue;
    const asA = row.deckA === deck.id;
    const rate = asA ? row.winRateA : row.winRateB;
    wins += asA ? row.winsA : row.winsB;
    losses += asA ? row.winsB : row.winsA;
    draws += row.draws;
    games += row.completedGames;
    const evaluated = evaluateMatchup(rate);
    if (evaluated.status === "healthy") healthy += 1;
    else if (evaluated.status === "watch") watch += 1;
    else critical += 1;
    matchups.push({
      opponentId: asA ? row.deckB : row.deckA,
      winRate: rate,
      status: evaluated.status,
      deviation: evaluated.deviation,
    });
  }
  return {
    id: deck.id,
    name: deck.name,
    region: deck.regions[0],
    games,
    wins,
    losses,
    draws,
    winRate: round1((wins / Math.max(1, wins + losses)) * 100),
    matchupHealth: { healthy, watch, critical },
    matchups: matchups.sort((a, b) => a.opponentId.localeCompare(b.opponentId)),
  };
}).sort((a, b) => b.winRate - a.winRate || a.id.localeCompare(b.id));

const florestia = deckSummaries.find((deck) => deck.id === TARGET);
if (!florestia) throw new Error(`Missing finalist deck summary`);
const strongestDeck = deckSummaries[0];
const weakestDeck = deckSummaries.at(-1)!;
const criticalOutliers = health.outliers.filter((row) => row.status === "critical");
const watchOutliers = health.outliers.filter((row) => row.status === "watch");

const report = {
  version: "1.9-global-finalist-1",
  methodology:
    "Official full Vanilla Balance Lab round robin with only Florestia Ascendant composition overridden to wide_u04_u05; 66 matchups × 5 deterministic strata × 40 games. No CardDef, AI or rules mutation.",
  finalistCore: FINALIST_CORE.map(cardId),
  gamesPerStratum: GAMES_PER_STRATUM,
  strata: STRATA,
  gamesPerMatchup: GAMES_PER_STRATUM * STRATA,
  matchups: rows.length,
  totalGames,
  stabilityThreshold,
  simulationQuality: {
    poolErrors: poolErrors.length,
    incompleteMatchups: incomplete.length,
    unstableMatchups: unstable.length,
    maxSeedDeviation: round1(Math.max(...rows.map((row) => row.maxSeedDeviation))),
    gate: "pass",
  },
  baseline: BASELINE,
  candidate: {
    healthScore: health.healthScore,
    healthyMatchups: health.healthyMatchups,
    watchMatchups: health.watchMatchups,
    criticalMatchups: health.criticalMatchups,
    releaseGate: health.releaseGate,
    florestiaWinRate: florestia.winRate,
    florestiaMatchupHealth: florestia.matchupHealth,
  },
  delta: {
    healthScore: health.healthScore - BASELINE.healthScore,
    healthyMatchups: health.healthyMatchups - BASELINE.healthyMatchups,
    watchMatchups: health.watchMatchups - BASELINE.watchMatchups,
    criticalMatchups: health.criticalMatchups - BASELINE.criticalMatchups,
    florestiaWinRate: round1(florestia.winRate - BASELINE.florestiaWinRate),
    florestiaCriticalMatchups: florestia.matchupHealth.critical - BASELINE.florestiaCriticalMatchups,
  },
  strongestDeck: { id: strongestDeck.id, winRate: strongestDeck.winRate, matchupHealth: strongestDeck.matchupHealth },
  weakestDeck: { id: weakestDeck.id, winRate: weakestDeck.winRate, matchupHealth: weakestDeck.matchupHealth },
  florestia,
  criticalOutliers,
  watchOutliers,
  deckSummaries: deckSummaries.map(({ matchups: _matchups, ...deck }) => deck),
};

if (writePath) fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
console.log(
  `VANILLA 1.9 GLOBAL FINALIST: PASS — ${totalGames} games · health=${health.healthScore} (${health.healthyMatchups}H/${health.watchMatchups}W/${health.criticalMatchups}C) · Florestia=${florestia.winRate}%/${florestia.matchupHealth.critical} critical · deltaCritical=${report.delta.criticalMatchups}`,
);
