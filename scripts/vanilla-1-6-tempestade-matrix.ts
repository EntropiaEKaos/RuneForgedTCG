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
import { getCard } from "../src/game/cards";
import { runBalanceSimulation, type SimulationSummary } from "../src/lib/balance-simulator";

const TARGET_ID = "vanilla_storm_1";
const gamesPerStratum = Math.max(10, Math.min(250, Number(process.argv[2]) || 40));
const strata = Math.max(3, Math.min(VANILLA_BALANCE_STRATUM_BASES.length, Number(process.argv[3]) || 5));
const enforce = process.argv.includes("--enforce");
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pct(wins: number, losses: number): number {
  return round1((wins / Math.max(1, wins + losses)) * 100);
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

const units = Array.from({ length: 18 }, (_, index) => `van_storm_u${String(index + 1).padStart(2, "0")}`);
const singletonUnits = new Set([
  "van_storm_u03",
  "van_storm_u05",
  "van_storm_u08",
  "van_storm_u11",
]);
const candidateCards = [
  ...units.flatMap((defId) => singletonUnits.has(defId) ? [defId] : [defId, defId]),
  "van_storm_s01", "van_storm_s01",
  "van_storm_s02", "van_storm_s02",
  "van_storm_s05", "van_storm_s05",
  "van_storm_s06", "van_storm_s06",
];

if (candidateCards.length !== 40) throw new Error(`evasion32 expected 40 cards, found ${candidateCards.length}`);
for (const defId of candidateCards) getCard(defId);
const copyCounts = candidateCards.reduce<Record<string, number>>((counts, defId) => {
  counts[defId] = (counts[defId] ?? 0) + 1;
  return counts;
}, {});
if (Object.values(copyCounts).some((count) => count > 2)) throw new Error("evasion32 exceeds two-copy ceiling");

const overrides = vanillaExperimentalOverrides();
const target = overrides[TARGET_ID];
if (!target) throw new Error(`${TARGET_ID} missing from Vanilla Balance Lab overrides`);
overrides[TARGET_ID] = { ...target, cards: [...candidateCards] };

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
    avgRounds: Math.round(parts.reduce((sum, row) => sum + row.avgRounds * row.completedGames, 0) / Math.max(1, completedGames)),
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
    const status = evaluateMatchup(rate).status;
    if (status === "critical") critical += 1;
    else if (status === "watch") watch += 1;
    else healthy += 1;
  }
  const winRate = pct(wins, losses);
  return {
    id: deck.id,
    name: deck.name,
    region: deck.regions[0],
    games,
    wins,
    losses,
    draws,
    winRate,
    winRate95: wilson95(wins, Math.max(1, wins + losses)),
    matchupHealth: { healthy, watch, critical },
    distanceFromParity: round1(Math.abs(winRate - 50)),
  };
}).sort((a, b) => b.winRate - a.winRate || a.id.localeCompare(b.id));

const regionSummaries = [...new Set(VANILLA_EXPERIMENTAL_DECKS.map((deck) => deck.regions[0]))].map((region) => {
  const members = deckSummaries.filter((deck) => deck.region === region);
  const wins = members.reduce((sum, deck) => sum + deck.wins, 0);
  const losses = members.reduce((sum, deck) => sum + deck.losses, 0);
  const draws = members.reduce((sum, deck) => sum + deck.draws, 0);
  return {
    region,
    decks: members.map((deck) => deck.id),
    wins,
    losses,
    draws,
    winRate: pct(wins, losses),
    winRate95: wilson95(wins, Math.max(1, wins + losses)),
  };
}).sort((a, b) => b.winRate - a.winRate || a.region.localeCompare(b.region));

const targetSummary = deckSummaries.find((deck) => deck.id === TARGET_ID);
if (!targetSummary) throw new Error("Tempestade Vanguard summary missing");
const targetMatchups = rows.map((row) => {
  if (row.deckA !== TARGET_ID && row.deckB !== TARGET_ID) return null;
  const asA = row.deckA === TARGET_ID;
  const winRate = asA ? row.winRateA : row.winRateB;
  return {
    opponent: asA ? row.deckB : row.deckA,
    games: row.completedGames,
    winRate,
    status: evaluateMatchup(winRate).status,
  };
}).filter((row): row is NonNullable<typeof row> => row !== null);

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
    poolErrors.length === 0 && rows.length === VANILLA_BALANCE_LAB_MATCHUPS && incomplete.length === 0 && unstable.length === 0
      ? "pass"
      : "blocked",
};

const defs = candidateCards.map(getCard);
const report = {
  version: `${VANILLA_BALANCE_LAB_VERSION} / Vanilla 1.6 Tempestade evasion32 candidate`,
  methodology:
    "Full certified 66-matchup Vanilla round robin using the same deterministic seed strata as the product Balance Lab. Only vanilla_storm_1 is overridden in-memory with evasion32; no CardDef, AI, engine, Ascendant, Ranked, or other deck mutation is performed.",
  candidate: {
    id: TARGET_ID,
    recipe: "evasion32",
    cards: candidateCards,
    singletonUnits: [...singletonUnits],
    units: defs.filter((card) => card.type === "Unit").length,
    spells: defs.filter((card) => card.type === "Spell").length,
    uniqueCards: new Set(candidateCards).size,
    averageCost: round1(defs.reduce((sum, card) => sum + card.cost, 0) / candidateCards.length),
    topEnd7Plus: defs.filter((card) => card.cost >= 7).length,
    maxCopies: Math.max(...Object.values(copyCounts)),
  },
  run: {
    gamesPerStratum,
    strata,
    gamesPerMatchup: gamesPerStratum * strata,
    matchups: rows.length,
    totalGames,
    overallAvgRounds,
    firstPlayerWinRate: health.firstPlayerWinRate,
    drawRate,
  },
  health,
  simulationQuality,
  targetSummary,
  targetMatchups,
  strongestDeck: deckSummaries[0],
  weakestDeck: deckSummaries.at(-1),
  deckSummaries,
  regionSummaries,
  rows,
};

if (writePath) {
  fs.mkdirSync(writePath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({
  version: report.version,
  candidate: report.candidate,
  run: report.run,
  health: report.health,
  simulationQuality: report.simulationQuality,
  targetSummary: report.targetSummary,
  targetMatchups: report.targetMatchups,
  strongestDeck: report.strongestDeck,
  weakestDeck: report.weakestDeck,
  deckSummaries: report.deckSummaries,
  regionSummaries: report.regionSummaries,
}, null, 2));

if (enforce && simulationQuality.gate !== "pass") {
  console.error(`Vanilla 1.6 Tempestade matrix: BLOCKED — simulation quality failed`);
  process.exitCode = 1;
} else if (enforce) {
  console.log(`Vanilla 1.6 Tempestade matrix: PASS — ${totalGames} games · health ${health.healthyMatchups}/${health.watchMatchups}/${health.criticalMatchups}`);
}
