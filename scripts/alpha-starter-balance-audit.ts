import fs from "node:fs";
import { evaluateMatchup, summarizeBalance } from "../src/game/balance-health";
import { getDeck } from "../src/game/decks";
import { profileDeck } from "../src/game/gameplay-profile";
import {
  ALPHA_STARTER_BALANCE_MATCHUPS,
  ALPHA_STARTER_BALANCE_STRATUM_BASES,
  ALPHA_STARTER_BALANCE_VERSION,
  ALPHA_STARTER_IDS,
  alphaStarterBalanceMatchups,
  alphaStarterBalanceSeed,
  validateAlphaStarterBalancePool,
} from "../src/game/alpha-starter-balance";
import {
  mergeBalanceSimulationTelemetry,
  runStackAwareBalanceSimulationWithTelemetry,
  type DeckUtilizationTelemetry,
  type SimulationSummary,
} from "../src/lib/balance-simulator";

const gamesPerStratumRaw = Math.max(10, Math.min(100, Number(process.argv[2]) || 40));
const gamesPerStratum = gamesPerStratumRaw % 2 === 0 ? gamesPerStratumRaw : gamesPerStratumRaw + 1;
const strata = Math.max(3, Math.min(ALPHA_STARTER_BALANCE_STRATUM_BASES.length, Number(process.argv[3]) || 5));
const enforceQuality = process.argv.includes("--enforce") || process.argv.includes("--enforce-quality");
const enforceBalance = process.argv.includes("--enforce-balance");
const printFull = process.argv.includes("--print-full");
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

function policySummary(deck: DeckUtilizationTelemetry, policyName: "player-heuristic" | "ai-core") {
  const policy = deck.policies[policyName];
  return {
    games: policy.games,
    decisions: policy.decisions,
    cardPlaysPerGame: perGame(policy.cardPlays, policy.games),
    activationsPerGame: perGame(policy.activations, policy.games),
    attacksPerGame: perGame(policy.attacks, policy.games),
    endTurnsWithPlayableRate: pct(policy.endTurnsWithPlayable, policy.endTurns),
    avgUnspentManaAtTurnEnd: round1(policy.unspentManaAtTurnEnd / Math.max(1, policy.endTurns)),
    avgUnspentSpellManaAtTurnEnd: round1(policy.unspentSpellManaAtTurnEnd / Math.max(1, policy.endTurns)),
    noOpActions: policy.noOpActions,
  };
}

function deckSummary(deck: DeckUtilizationTelemetry) {
  const deckDef = getDeck(deck.id);
  const profile = profileDeck(deckDef.cards);
  const cards = Object.values(deck.cards).map((card) => ({
    defId: card.defId,
    name: card.name,
    semanticType: card.semanticType,
    printedCost: card.printedCost,
    seen: card.seen,
    played: card.played,
    endHand: card.endHand,
    playRateWhenSeen: pct(card.played, card.seen),
    endHandRateWhenSeen: pct(card.endHand, card.seen),
    playableSamples: card.playableSamples,
    ignoredPlayableSamples: card.ignoredPlayableSamples,
    ignoredPlayableRate: pct(card.ignoredPlayableSamples, card.playableSamples),
    targetStarvedSamples: card.targetStarvedSamples,
    reactionOnlySamples: card.reactionOnlySamples,
    policyUnsupportedSamples: card.policyUnsupportedSamples,
  }));
  const semanticTypes = Object.values(deck.semanticTypes)
    .map((type) => ({
      semanticType: type.semanticType,
      seen: type.seen,
      played: type.played,
      endHand: type.endHand,
      playRateWhenSeen: pct(type.played, type.seen),
      endHandRateWhenSeen: pct(type.endHand, type.seen),
      playableSamples: type.playableSamples,
      ignoredPlayableSamples: type.ignoredPlayableSamples,
      targetStarvedSamples: type.targetStarvedSamples,
      reactionOnlySamples: type.reactionOnlySamples,
      policyUnsupportedSamples: type.policyUnsupportedSamples,
    }))
    .sort((a, b) => b.seen - a.seen || a.semanticType.localeCompare(b.semanticType));
  const decisive = deck.wins + deck.losses;
  return {
    id: deck.id,
    name: deck.name,
    regions: deckDef.regions,
    profile,
    games: deck.games,
    wins: deck.wins,
    losses: deck.losses,
    draws: deck.draws,
    winRate: pct(deck.wins, decisive),
    winRate95: wilson95(deck.wins, decisive),
    cardsPlayedPerGame: perGame(deck.cardsPlayed, deck.games),
    playRateWhenSeen: pct(deck.cardsPlayed, deck.seenCards),
    endHandPerGame: perGame(deck.endHandCards, deck.games),
    endHandRateWhenSeen: pct(deck.endHandCards, deck.seenCards),
    avgPrintedCostPlayed: round1(deck.printedCostPlayed / Math.max(1, deck.cardsPlayed)),
    avgManaSpentOnCardPlay: round1(deck.manaSpentOnCardPlays / Math.max(1, deck.cardsPlayed)),
    avgSpellManaSpentOnCardPlay: round1(deck.spellManaSpentOnCardPlays / Math.max(1, deck.cardsPlayed)),
    finalSpellsCastPerGame: perGame(deck.finalSpellsCast, deck.games),
    finalAlliesSummonedPerGame: perGame(deck.finalAlliesSummoned, deck.games),
    nexusDamageDealtPerGame: perGame(deck.finalNexusDamageDealt, deck.games),
    finalHandPerGame: perGame(deck.finalHandSize, deck.games),
    finalBenchPerGame: perGame(deck.finalBenchSize, deck.games),
    finalPermanentsPerGame: perGame(deck.finalPermanentSize, deck.games),
    policyUnsupportedSamples: cards.reduce((sum, card) => sum + card.policyUnsupportedSamples, 0),
    targetStarvedSamples: cards.reduce((sum, card) => sum + card.targetStarvedSamples, 0),
    reactionOnlySamples: cards.reduce((sum, card) => sum + card.reactionOnlySamples, 0),
    ignoredPlayableSamples: cards.reduce((sum, card) => sum + card.ignoredPlayableSamples, 0),
    playerHeuristic: policySummary(deck, "player-heuristic"),
    aiCore: policySummary(deck, "ai-core"),
    semanticTypes,
    mostStuckCards: [...cards]
      .filter((card) => card.seen >= Math.max(10, Math.floor(deck.games * 0.08)))
      .sort((a, b) => b.endHandRateWhenSeen - a.endHandRateWhenSeen || b.endHand - a.endHand)
      .slice(0, 8),
    mostIgnoredPlayableCards: [...cards]
      .filter((card) => card.playableSamples > 0)
      .sort((a, b) => b.ignoredPlayableRate - a.ignoredPlayableRate || b.ignoredPlayableSamples - a.ignoredPlayableSamples)
      .slice(0, 8),
    mostTargetStarvedCards: [...cards]
      .filter((card) => card.targetStarvedSamples > 0)
      .sort((a, b) => b.targetStarvedSamples - a.targetStarvedSamples)
      .slice(0, 8),
    cards,
  };
}

const poolErrors = validateAlphaStarterBalancePool();
const rows: AggregatedRow[] = [];
const telemetryParts = [];
let incompleteStrata = 0;

for (const matchup of alphaStarterBalanceMatchups()) {
  const parts: SimulationSummary[] = [];
  for (let stratum = 0; stratum < strata; stratum += 1) {
    const result = runStackAwareBalanceSimulationWithTelemetry(
      matchup.leftId,
      matchup.rightId,
      gamesPerStratum,
      alphaStarterBalanceSeed(matchup, stratum),
    );
    parts.push(result.summary);
    telemetryParts.push(result.telemetry);
    if (result.summary.completedGames !== gamesPerStratum) incompleteStrata += 1;
  }
  rows.push(aggregate(parts, matchup.leftId, matchup.rightId));
}

const health = summarizeBalance(rows);
const stabilityThreshold = round1(Math.max(10, 3 * Math.sqrt(0.25 / gamesPerStratum) * 100));
const unstable = rows.filter((row) => row.maxSeedDeviation > stabilityThreshold);
const incompleteMatchups = rows.filter((row) => row.completedGames !== row.requestedGames);
const telemetry = mergeBalanceSimulationTelemetry(telemetryParts);
const deckSummaries = Object.values(telemetry.decks)
  .map(deckSummary)
  .sort((a, b) => b.winRate - a.winRate || a.id.localeCompare(b.id));

const expectedGamesPerDeck = (ALPHA_STARTER_IDS.length - 1) * gamesPerStratum * strata;
const expectedPolicyGamesPerDeck = expectedGamesPerDeck / 2;
const telemetryErrors: string[] = [];
const reactionCoverageErrors: string[] = [];
const reactionCoverage = deckSummaries.map((deck) => {
  const trap = deck.semanticTypes.find((type) => type.semanticType === "Armadilha");
  const seen = trap?.seen ?? 0;
  const played = trap?.played ?? 0;
  if (!trap) reactionCoverageErrors.push(`${deck.id}: missing Armadilha semantic telemetry`);
  else if (seen <= 0) reactionCoverageErrors.push(`${deck.id}: starter Trap was never seen in the certified matrix`);
  else if (played <= 0) reactionCoverageErrors.push(`${deck.id}: starter Trap was seen ${seen} times but never played`);
  return {
    deckId: deck.id,
    seen,
    played,
    playRateWhenSeen: pct(played, seen),
  };
});
for (const deck of deckSummaries) {
  if (deck.games !== expectedGamesPerDeck) telemetryErrors.push(`${deck.id}: expected ${expectedGamesPerDeck} games, found ${deck.games}`);
  if (deck.playerHeuristic.games !== expectedPolicyGamesPerDeck) {
    telemetryErrors.push(`${deck.id}: player-heuristic expected ${expectedPolicyGamesPerDeck} games, found ${deck.playerHeuristic.games}`);
  }
  if (deck.aiCore.games !== expectedPolicyGamesPerDeck) {
    telemetryErrors.push(`${deck.id}: ai-core expected ${expectedPolicyGamesPerDeck} games, found ${deck.aiCore.games}`);
  }
}
for (const starterId of ALPHA_STARTER_IDS) {
  if (!telemetry.decks[starterId]) telemetryErrors.push(`${starterId}: missing utilization telemetry`);
}

const totalGames = rows.reduce((sum, row) => sum + row.completedGames, 0);
const totalDraws = rows.reduce((sum, row) => sum + row.draws, 0);
const totalRounds = rows.reduce((sum, row) => sum + row.avgRounds * row.completedGames, 0);
const simulationQuality = {
  expectedMatchups: ALPHA_STARTER_BALANCE_MATCHUPS,
  completedMatchups: rows.length,
  incompleteMatchups: incompleteMatchups.length,
  incompleteStrata,
  poolErrors,
  telemetryErrors,
  reactionCoverageErrors,
  reactionCoverage,
  stabilityMetric: "maximum absolute seed-stratum deviation from pooled matchup win rate",
  stabilityThreshold,
  stableMatchups: rows.length - unstable.length,
  unstableMatchups: unstable.length,
  maxSeedDeviation: round1(Math.max(...rows.map((row) => row.maxSeedDeviation))),
  gate:
    poolErrors.length === 0 &&
    rows.length === ALPHA_STARTER_BALANCE_MATCHUPS &&
    incompleteMatchups.length === 0 &&
    incompleteStrata === 0 &&
    unstable.length === 0 &&
    telemetryErrors.length === 0 &&
    reactionCoverageErrors.length === 0
      ? "pass"
      : "blocked",
};

const strongestDeck = deckSummaries[0];
const weakestDeck = deckSummaries.at(-1)!;
const mostExtremeMatchup = [...rows].sort(
  (a, b) => Math.abs(b.winRateA - 50) - Math.abs(a.winRateA - 50),
)[0];
const releaseCandidateGate =
  simulationQuality.gate !== "pass"
    ? "blocked-quality"
    : health.releaseGate === "pass"
      ? "pass"
      : health.releaseGate === "review"
        ? "review-balance"
        : "blocked-balance";

const report = {
  version: ALPHA_STARTER_BALANCE_VERSION,
  methodology:
    "six canonical Alpha starter recipes, unchanged; full 15-matchup round robin; deterministic independent seed strata; alternating policy side and first player; authoritative stack-aware reactions; Wilson 95%; read-only utilization telemetry; Trap reaction coverage is fail-closed; simulation quality and balance health are separate gates",
  starterIds: ALPHA_STARTER_IDS,
  gamesPerStratum,
  strata,
  gamesPerMatchup: gamesPerStratum * strata,
  matchups: rows.length,
  totalGames,
  overallAvgRounds: round1(totalRounds / Math.max(1, totalGames)),
  firstPlayerWinRate: health.firstPlayerWinRate,
  drawRate: pct(totalDraws, totalGames),
  balanceStatus: health.releaseGate,
  releaseCandidateGate,
  health,
  simulationQuality,
  strongestDeck,
  weakestDeck,
  mostExtremeMatchup,
  deckSummaries,
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
  starterIds: report.starterIds,
  gamesPerStratum: report.gamesPerStratum,
  strata: report.strata,
  gamesPerMatchup: report.gamesPerMatchup,
  matchups: report.matchups,
  totalGames: report.totalGames,
  overallAvgRounds: report.overallAvgRounds,
  firstPlayerWinRate: report.firstPlayerWinRate,
  drawRate: report.drawRate,
  balanceStatus: report.balanceStatus,
  releaseCandidateGate: report.releaseCandidateGate,
  health: report.health,
  simulationQuality: report.simulationQuality,
  reactionCoverage: report.simulationQuality.reactionCoverage,
  strongestDeck: report.strongestDeck,
  weakestDeck: report.weakestDeck,
  mostExtremeMatchup: report.mostExtremeMatchup,
  deckSummaries: report.deckSummaries.map((deck) => ({
    id: deck.id,
    name: deck.name,
    regions: deck.regions,
    profile: deck.profile,
    games: deck.games,
    winRate: deck.winRate,
    winRate95: deck.winRate95,
    cardsPlayedPerGame: deck.cardsPlayedPerGame,
    playRateWhenSeen: deck.playRateWhenSeen,
    endHandPerGame: deck.endHandPerGame,
    endHandRateWhenSeen: deck.endHandRateWhenSeen,
    nexusDamageDealtPerGame: deck.nexusDamageDealtPerGame,
    policyUnsupportedSamples: deck.policyUnsupportedSamples,
    targetStarvedSamples: deck.targetStarvedSamples,
    ignoredPlayableSamples: deck.ignoredPlayableSamples,
    playerHeuristic: deck.playerHeuristic,
    aiCore: deck.aiCore,
    semanticTypes: deck.semanticTypes,
    mostStuckCards: deck.mostStuckCards,
    mostIgnoredPlayableCards: deck.mostIgnoredPlayableCards,
    mostTargetStarvedCards: deck.mostTargetStarvedCards,
  })),
};

const json = JSON.stringify(report, null, 2);
if (writePath) fs.writeFileSync(writePath, `${json}\n`);
console.log(JSON.stringify(printFull ? report : compact, null, 2));

if (enforceQuality && simulationQuality.gate !== "pass") {
  console.error(
    `ALPHA STARTER BALANCE 1.0: BLOCKED — quality gate failed (${poolErrors.length} pool errors, ${incompleteMatchups.length} incomplete matchups, ${incompleteStrata} incomplete strata, ${unstable.length} unstable, ${telemetryErrors.length} telemetry errors)`,
  );
  process.exitCode = 1;
} else if (enforceBalance && health.releaseGate !== "pass") {
  console.error(
    `ALPHA STARTER BALANCE 1.0: BLOCKED — balance gate is ${health.releaseGate} (${health.criticalMatchups} critical, ${health.watchMatchups} watch)`,
  );
  process.exitCode = 1;
} else if (enforceQuality) {
  console.log(
    `ALPHA STARTER BALANCE 1.0: QUALITY PASS — ${totalGames} games · ${rows.length}/${ALPHA_STARTER_BALANCE_MATCHUPS} matchups · balance=${health.releaseGate} · health=${health.healthScore} · RC=${releaseCandidateGate}`,
  );
}
