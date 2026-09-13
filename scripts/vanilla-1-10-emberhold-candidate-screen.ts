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
const CRITICAL_OPPONENT_IDS = [
  "vanilla_storm_1",
  "vanilla_tide_1",
  "vanilla_void_1",
  "vanilla_wood_1",
] as const;
const GAMES_PER_STRATUM = 40;
const STRATA = 5;
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

function emberId(suffix: string): string {
  return `van_ember_${suffix}`;
}

const baselineDeck = VANILLA_EXPERIMENTAL_DECKS.find((deck) => deck.id === TARGET_ID);
if (!baselineDeck) throw new Error(`Missing ${TARGET_ID}`);

const floorCards: string[] = [];
const floorSet = new Set<string>();
const baselineExtras: string[] = [];
for (const defId of baselineDeck.cards) {
  if (floorSet.has(defId)) baselineExtras.push(defId);
  else {
    floorSet.add(defId);
    floorCards.push(defId);
  }
}

if (floorCards.length !== 30) throw new Error(`Expected Emberhold 30-card regional floor, found ${floorCards.length}`);
if (baselineExtras.length !== 10) throw new Error(`Expected Emberhold 10 extra slots, found ${baselineExtras.length}`);

interface CandidateSpec {
  id: string;
  label: string;
  rationale: string;
  extras: string[];
}

function doubled(...suffixes: string[]): string[] {
  return suffixes.flatMap((suffix) => [emberId(suffix), emberId(suffix)]);
}

const candidates: CandidateSpec[] = [
  {
    id: "baseline",
    label: "Current 1.9 floor",
    rationale: "Current Emberhold Ascendant recipe; control arm for paired deterministic comparison.",
    extras: baselineExtras,
  },
  {
    id: "low-curve-pressure",
    label: "Low-curve pressure",
    rationale: "Triples the five strongest 1-3 mana pressure bodies to reduce setup friction and punish Vanguard curves.",
    extras: doubled("u02", "u03", "u04", "u05", "u08"),
  },
  {
    id: "tempo-spine",
    label: "Tempo spine",
    rationale: "Concentrates Haste, nexus chip, QuickAttack and the Haste+Tough five-drop into a compact tempo spine.",
    extras: doubled("u03", "u04", "u08", "u11", "u13"),
  },
  {
    id: "resilient-pressure",
    label: "Resilient pressure",
    rationale: "Leans on Tough/Haste and efficient combat bodies to test whether board persistence fixes the Vanguard floor.",
    extras: doubled("u03", "u05", "u08", "u11", "u13"),
  },
  {
    id: "early-tempo",
    label: "Early tempo",
    rationale: "Keeps pressure almost entirely at four mana or less while retaining QuickAttack as the top of the duplicate curve.",
    extras: doubled("u02", "u03", "u04", "u08", "u11"),
  },
  {
    id: "nexus-clock",
    label: "Nexus clock",
    rationale: "Tests target-independent nexus damage alongside the best early pressure bodies, avoiding target-starved removal density.",
    extras: doubled("u02", "u04", "u08", "s02", "e01"),
  },
  {
    id: "burn-finish",
    label: "Burn finish",
    rationale: "Combines early Haste/nexus chip with extra direct nexus burn at two and seven mana to test closing power.",
    extras: doubled("u03", "u04", "u08", "s02", "s08"),
  },
  {
    id: "scaling-board",
    label: "Scaling board",
    rationale: "Tests whether repeated team scaling can convert Emberhold's existing summon volume into better Vanguard outcomes.",
    extras: doubled("u03", "u04", "u08", "u12", "e02"),
  },
];

function buildCandidateCards(extras: string[]): string[] {
  if (extras.length !== 10) throw new Error(`Candidate requires ten extra slots, found ${extras.length}`);
  const cards = [...floorCards, ...extras];
  if (cards.length !== 40) throw new Error(`Candidate requires 40 cards, found ${cards.length}`);
  const counts = new Map<string, number>();
  for (const defId of cards) {
    if (!floorSet.has(defId)) throw new Error(`Candidate contains non-Emberhold-floor card ${defId}`);
    const count = (counts.get(defId) ?? 0) + 1;
    if (count > 3) throw new Error(`Candidate exceeds three-copy ceiling for ${defId}`);
    counts.set(defId, count);
  }
  return cards;
}

const poolErrors = validateVanillaBalancePool();
const criticalMatchups = vanillaBalanceMatchups().filter((matchup) => {
  const targetIsLeft = matchup.leftId === TARGET_ID;
  const targetIsRight = matchup.rightId === TARGET_ID;
  if (!targetIsLeft && !targetIsRight) return false;
  const opponentId = targetIsLeft ? matchup.rightId : matchup.leftId;
  return CRITICAL_OPPONENT_IDS.includes(opponentId as (typeof CRITICAL_OPPONENT_IDS)[number]);
});

if (criticalMatchups.length !== CRITICAL_OPPONENT_IDS.length) {
  throw new Error(`Expected ${CRITICAL_OPPONENT_IDS.length} critical matchups, found ${criticalMatchups.length}`);
}

const candidateRows = [];
let incompleteStrata = 0;

for (const candidate of candidates) {
  const cards = buildCandidateCards(candidate.extras);
  const overrides = vanillaExperimentalOverrides();
  overrides[TARGET_ID] = { id: TARGET_ID, name: baselineDeck.name, cards };
  const telemetryParts = [];
  const matchupRows = [];

  for (const matchup of criticalMatchups) {
    const summaries: SimulationSummary[] = [];
    for (let stratum = 0; stratum < STRATA; stratum += 1) {
      const result = runBalanceSimulationWithTelemetry(
        matchup.leftId,
        matchup.rightId,
        GAMES_PER_STRATUM,
        vanillaBalanceSeed(matchup, stratum),
        overrides,
      );
      summaries.push(result.summary);
      telemetryParts.push(result.telemetry);
      if (result.summary.completedGames !== GAMES_PER_STRATUM) incompleteStrata += 1;
    }

    const completedGames = summaries.reduce((sum, row) => sum + row.completedGames, 0);
    const targetIsLeft = matchup.leftId === TARGET_ID;
    const targetWins = summaries.reduce((sum, row) => sum + (targetIsLeft ? row.winsA : row.winsB), 0);
    const opponentWins = summaries.reduce((sum, row) => sum + (targetIsLeft ? row.winsB : row.winsA), 0);
    const winRate = pct(targetWins, targetWins + opponentWins);
    matchupRows.push({
      opponentId: targetIsLeft ? matchup.rightId : matchup.leftId,
      completedGames,
      targetWins,
      opponentWins,
      winRate,
      status: status(winRate),
    });
  }

  const telemetry = mergeBalanceSimulationTelemetry(telemetryParts);
  const target = telemetry.decks[TARGET_ID];
  if (!target) throw new Error(`Missing utilization telemetry for ${candidate.id}`);
  const totalWins = matchupRows.reduce((sum, row) => sum + row.targetWins, 0);
  const totalLosses = matchupRows.reduce((sum, row) => sum + row.opponentWins, 0);
  const worstWinRate = Math.min(...matchupRows.map((row) => row.winRate));
  const bestWinRate = Math.max(...matchupRows.map((row) => row.winRate));
  const critical = matchupRows.filter((row) => row.status === "critical").length;
  const watch = matchupRows.filter((row) => row.status === "watch").length;
  const healthy = matchupRows.filter((row) => row.status === "healthy").length;

  candidateRows.push({
    id: candidate.id,
    label: candidate.label,
    rationale: candidate.rationale,
    extras: candidate.extras,
    games: target.games,
    wins: totalWins,
    losses: totalLosses,
    winRate: pct(totalWins, totalWins + totalLosses),
    worstWinRate,
    bestWinRate,
    matchupHealth: { healthy, watch, critical },
    cardsPlayedPerGame: perGame(target.cardsPlayed, target.games),
    endHandPerGame: perGame(target.endHandCards, target.games),
    finalBenchPerGame: perGame(target.finalBenchSize, target.games),
    nexusDamageDealtPerGame: perGame(target.finalNexusDamageDealt, target.games),
    matchups: matchupRows.sort((a, b) => a.winRate - b.winRate || a.opponentId.localeCompare(b.opponentId)),
  });
}

const ranked = [...candidateRows].sort((a, b) =>
  a.matchupHealth.critical - b.matchupHealth.critical
  || b.worstWinRate - a.worstWinRate
  || b.winRate - a.winRate
  || b.nexusDamageDealtPerGame - a.nexusDamageDealtPerGame
  || a.id.localeCompare(b.id),
);

const baseline = candidateRows.find((row) => row.id === "baseline");
if (!baseline) throw new Error("Missing baseline screen row");
const ranking = ranked.map((row, index) => ({
  rank: index + 1,
  id: row.id,
  label: row.label,
  criticalMatchups: row.matchupHealth.critical,
  worstWinRate: row.worstWinRate,
  winRate: row.winRate,
  deltaVsBaseline: round1(row.winRate - baseline.winRate),
  worstDeltaVsBaseline: round1(row.worstWinRate - baseline.worstWinRate),
  nexusDamageDealtPerGame: row.nexusDamageDealtPerGame,
}));

const expectedGames = candidates.length * criticalMatchups.length * GAMES_PER_STRATUM * STRATA;
const actualGames = candidateRows.reduce((sum, row) => sum + row.games, 0);
const screenErrors: string[] = [];
if (actualGames !== expectedGames) screenErrors.push(`expected ${expectedGames} candidate games, found ${actualGames}`);
if (incompleteStrata !== 0) screenErrors.push(`${incompleteStrata} strata incomplete`);
const qualityGate = poolErrors.length === 0 && screenErrors.length === 0 ? "pass" : "blocked";

const report = {
  version: "1.10-candidate-screen-1",
  methodology:
    "Read-only Emberhold Ascendant recipe screen. Candidate overrides mutate only the in-memory 40-card recipe, never CardDefs, rules, AI or product recipes. Each candidate uses the same five certified deterministic strata against the four Vanguards classified critical by the preceding 2,200-game diagnostic.",
  target: { id: TARGET_ID, name: baselineDeck.name },
  criticalOpponents: CRITICAL_OPPONENT_IDS,
  simulation: {
    candidates: candidates.length,
    matchupsPerCandidate: criticalMatchups.length,
    gamesPerMatchup: GAMES_PER_STRATUM * STRATA,
    gamesPerCandidate: criticalMatchups.length * GAMES_PER_STRATUM * STRATA,
    totalGames: actualGames,
    certifiedSeedBases: VANILLA_BALANCE_STRATUM_BASES.slice(0, STRATA),
  },
  selectionPolicy:
    "Rank by fewest critical matchups, then highest worst-matchup win rate, then highest aggregate win rate, then nexus damage per game. No product recipe changes are made by this screen.",
  quality: { gate: qualityGate, poolErrors, screenErrors, incompleteStrata },
  ranking,
  candidates: candidateRows,
};

if (writePath) fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  version: report.version,
  quality: report.quality,
  simulation: report.simulation,
  ranking: report.ranking,
}, null, 2));

if (qualityGate !== "pass") {
  console.error(`VANILLA 1.10 EMBERHOLD CANDIDATE SCREEN: BLOCKED — ${poolErrors.length} pool errors · ${screenErrors.length} screen errors`);
  process.exitCode = 1;
} else {
  const leader = ranking[0];
  console.log(
    `VANILLA 1.10 EMBERHOLD CANDIDATE SCREEN: PASS — ${actualGames} games · leader=${leader.id} · floor=${leader.worstWinRate}% · WR=${leader.winRate}% · critical=${leader.criticalMatchups}`,
  );
}
