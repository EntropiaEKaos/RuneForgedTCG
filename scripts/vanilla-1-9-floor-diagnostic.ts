import fs from "node:fs";
import { evaluateMatchup } from "../src/game/balance-health";
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
  type DeckUtilizationTelemetry,
  type SimulationSummary,
} from "../src/lib/balance-simulator";

const TARGETS = ["vanilla_forest_2", "vanilla_ember_2"] as const;
const gamesPerStratumRaw = Math.max(10, Math.min(100, Number(process.argv[2]) || 40));
const gamesPerStratum = gamesPerStratumRaw % 2 === 0 ? gamesPerStratumRaw : gamesPerStratumRaw + 1;
const strata = Math.max(3, Math.min(VANILLA_BALANCE_STRATUM_BASES.length, Number(process.argv[3]) || 5));
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";
const overrides = vanillaExperimentalOverrides();

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pct(numerator: number, denominator: number): number {
  return round1((numerator / Math.max(1, denominator)) * 100);
}

function perGame(value: number, games: number): number {
  return round1(value / Math.max(1, games));
}

function aggregateMatch(parts: SimulationSummary[]) {
  const winsLeft = parts.reduce((sum, row) => sum + row.winsA, 0);
  const winsRight = parts.reduce((sum, row) => sum + row.winsB, 0);
  const draws = parts.reduce((sum, row) => sum + row.draws, 0);
  const completedGames = parts.reduce((sum, row) => sum + row.completedGames, 0);
  return {
    leftId: parts[0]?.deckA ?? "unknown",
    rightId: parts[0]?.deckB ?? "unknown",
    completedGames,
    winsLeft,
    winsRight,
    draws,
    winRateLeft: pct(winsLeft, winsLeft + winsRight),
    winRateRight: pct(winsRight, winsLeft + winsRight),
  };
}

type MatchRow = ReturnType<typeof aggregateMatch>;

function policySummary(deck: DeckUtilizationTelemetry, policyName: "player-heuristic" | "ai-core") {
  const policy = deck.policies[policyName];
  return {
    games: policy.games,
    decisions: policy.decisions,
    cardPlaysPerGame: perGame(policy.cardPlays, policy.games),
    attacksPerGame: perGame(policy.attacks, policy.games),
    endTurns: policy.endTurns,
    endTurnsWithPlayable: policy.endTurnsWithPlayable,
    endTurnsWithPlayableRate: pct(policy.endTurnsWithPlayable, policy.endTurns),
    avgUnspentManaAtTurnEnd: round1(policy.unspentManaAtTurnEnd / Math.max(1, policy.endTurns)),
    avgUnspentSpellManaAtTurnEnd: round1(policy.unspentSpellManaAtTurnEnd / Math.max(1, policy.endTurns)),
  };
}

function cardRows(deck: DeckUtilizationTelemetry) {
  return Object.values(deck.cards).map((card) => ({
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
}

function targetMatchups(targetId: string, rows: MatchRow[]) {
  return rows
    .filter((row) => row.leftId === targetId || row.rightId === targetId)
    .map((row) => {
      const targetIsLeft = row.leftId === targetId;
      const opponentId = targetIsLeft ? row.rightId : row.leftId;
      const winRate = targetIsLeft ? row.winRateLeft : row.winRateRight;
      const health = evaluateMatchup(winRate);
      return {
        opponentId,
        games: row.completedGames,
        winRate,
        status: health.status,
        deviation: health.deviation,
      };
    })
    .sort((a, b) => a.winRate - b.winRate || a.opponentId.localeCompare(b.opponentId));
}

function targetSummary(deck: DeckUtilizationTelemetry, rows: MatchRow[]) {
  const cards = cardRows(deck);
  const matchups = targetMatchups(deck.id, rows);
  const critical = matchups.filter((row) => row.status === "critical");
  const watch = matchups.filter((row) => row.status === "watch");
  const healthy = matchups.filter((row) => row.status === "healthy");
  const targetStarvedSamples = cards.reduce((sum, card) => sum + card.targetStarvedSamples, 0);
  const ignoredPlayableSamples = cards.reduce((sum, card) => sum + card.ignoredPlayableSamples, 0);
  const policyUnsupportedSamples = cards.reduce((sum, card) => sum + card.policyUnsupportedSamples, 0);
  const decisive = deck.wins + deck.losses;
  const seenFloor = Math.max(20, Math.floor(deck.games * 0.05));

  return {
    id: deck.id,
    name: deck.name,
    games: deck.games,
    wins: deck.wins,
    losses: deck.losses,
    draws: deck.draws,
    winRate: pct(deck.wins, decisive),
    matchupHealth: {
      healthy: healthy.length,
      watch: watch.length,
      critical: critical.length,
    },
    cardsPlayedPerGame: perGame(deck.cardsPlayed, deck.games),
    playRateWhenSeen: pct(deck.cardsPlayed, deck.seenCards),
    finalHandPerGame: perGame(deck.finalHandSize, deck.games),
    finalBenchPerGame: perGame(deck.finalBenchSize, deck.games),
    finalPermanentsPerGame: perGame(deck.finalPermanentSize, deck.games),
    finalSentinelasPerGame: perGame(deck.finalSentinelaSize, deck.games),
    alliesSummonedPerGame: perGame(deck.finalAlliesSummoned, deck.games),
    nexusDamagePerGame: perGame(deck.finalNexusDamageDealt, deck.games),
    spellsCastPerGame: perGame(deck.finalSpellsCast, deck.games),
    targetStarvedSamples,
    targetStarvedPerGame: perGame(targetStarvedSamples, deck.games),
    ignoredPlayableSamples,
    ignoredPlayablePerGame: perGame(ignoredPlayableSamples, deck.games),
    policyUnsupportedSamples,
    playerHeuristic: policySummary(deck, "player-heuristic"),
    aiCore: policySummary(deck, "ai-core"),
    criticalMatchups: critical,
    watchMatchups: watch,
    healthiestMatchups: [...healthy].sort((a, b) => Math.abs(a.winRate - 50) - Math.abs(b.winRate - 50)),
    mostStuckCards: [...cards]
      .filter((card) => card.seen >= seenFloor)
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
    bestExtractedCards: [...cards]
      .filter((card) => card.seen >= seenFloor)
      .sort((a, b) => b.playRateWhenSeen - a.playRateWhenSeen || b.played - a.played)
      .slice(0, 8),
  };
}

const poolErrors = validateVanillaBalancePool();
if (poolErrors.length > 0) {
  throw new Error(`Vanilla Balance Lab pool is invalid: ${poolErrors.join(" | ")}`);
}

const selectedMatchups = vanillaBalanceMatchups().filter(
  (matchup) => TARGETS.includes(matchup.leftId as (typeof TARGETS)[number]) || TARGETS.includes(matchup.rightId as (typeof TARGETS)[number]),
);
if (selectedMatchups.length !== 21) {
  throw new Error(`Vanilla 1.9 diagnostic expected 21 unique target matchups, found ${selectedMatchups.length}`);
}

const telemetryParts = [];
const rows: MatchRow[] = [];
let incompleteRuns = 0;
for (const matchup of selectedMatchups) {
  const summaries: SimulationSummary[] = [];
  for (let stratum = 0; stratum < strata; stratum += 1) {
    const result = runBalanceSimulationWithTelemetry(
      matchup.leftId,
      matchup.rightId,
      gamesPerStratum,
      vanillaBalanceSeed(matchup, stratum),
      overrides,
    );
    summaries.push(result.summary);
    telemetryParts.push(result.telemetry);
    if (result.summary.completedGames !== gamesPerStratum) incompleteRuns += 1;
  }
  rows.push(aggregateMatch(summaries));
}

const telemetry = mergeBalanceSimulationTelemetry(telemetryParts);
const expectedGamesPerTarget = 11 * gamesPerStratum * strata;
const targets = TARGETS.map((targetId) => {
  const deck = telemetry.decks[targetId];
  if (!deck) throw new Error(`Missing telemetry for ${targetId}`);
  if (deck.games !== expectedGamesPerTarget) {
    throw new Error(`${targetId}: expected ${expectedGamesPerTarget} games, found ${deck.games}`);
  }
  return targetSummary(deck, rows);
});

for (const target of targets) {
  if (target.policyUnsupportedSamples !== 0) {
    throw new Error(`${target.id}: expected zero policy-unsupported samples, found ${target.policyUnsupportedSamples}`);
  }
  if (target.criticalMatchups.length + target.watchMatchups.length + target.healthiestMatchups.length !== 11) {
    throw new Error(`${target.id}: expected 11 classified matchups`);
  }
}

const forest = targets.find((target) => target.id === "vanilla_forest_2")!;
const ember = targets.find((target) => target.id === "vanilla_ember_2")!;
const criticalOverlap = forest.criticalMatchups
  .map((row) => row.opponentId)
  .filter((opponentId) => ember.criticalMatchups.some((row) => row.opponentId === opponentId))
  .sort();
const unionCriticalOpponents = [...new Set([
  ...forest.criticalMatchups.map((row) => row.opponentId),
  ...ember.criticalMatchups.map((row) => row.opponentId),
])].sort();

const report = {
  version: "1.9-diagnostic-1",
  methodology:
    "Read-only targeted utilization telemetry over the exact certified Vanilla Balance Lab simulator and seed table; 21 unique matchups involving either floor deck; no CardDef, recipe, AI or rules mutation.",
  gamesPerStratum,
  strata,
  gamesPerMatchup: gamesPerStratum * strata,
  uniqueMatchups: selectedMatchups.length,
  totalGames: rows.reduce((sum, row) => sum + row.completedGames, 0),
  expectedGamesPerTarget,
  incompleteRuns,
  targets,
  comparison: {
    winRateForestMinusEmber: round1(forest.winRate - ember.winRate),
    cardsPlayedPerGameForestMinusEmber: round1(forest.cardsPlayedPerGame - ember.cardsPlayedPerGame),
    finalHandPerGameForestMinusEmber: round1(forest.finalHandPerGame - ember.finalHandPerGame),
    alliesSummonedPerGameForestMinusEmber: round1(forest.alliesSummonedPerGame - ember.alliesSummonedPerGame),
    nexusDamagePerGameForestMinusEmber: round1(forest.nexusDamagePerGame - ember.nexusDamagePerGame),
    targetStarvedPerGameForestMinusEmber: round1(forest.targetStarvedPerGame - ember.targetStarvedPerGame),
    ignoredPlayablePerGameForestMinusEmber: round1(forest.ignoredPlayablePerGame - ember.ignoredPlayablePerGame),
    aiEndTurnsWithPlayableRateForestMinusEmber: round1(
      forest.aiCore.endTurnsWithPlayableRate - ember.aiCore.endTurnsWithPlayableRate,
    ),
    criticalOverlap,
    criticalOverlapCount: criticalOverlap.length,
    unionCriticalOpponents,
    unionCriticalOpponentCount: unionCriticalOpponents.length,
  },
};

if (incompleteRuns !== 0) {
  throw new Error(`Vanilla 1.9 diagnostic has ${incompleteRuns} incomplete simulation runs`);
}
if (report.totalGames !== selectedMatchups.length * gamesPerStratum * strata) {
  throw new Error(`Vanilla 1.9 diagnostic expected ${selectedMatchups.length * gamesPerStratum * strata} games, found ${report.totalGames}`);
}

if (writePath) fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
console.log(
  `VANILLA 1.9 FLOOR DIAGNOSTIC: PASS — ${report.totalGames} games · Forest=${forest.winRate}% (${forest.matchupHealth.critical} critical) · Ember=${ember.winRate}% (${ember.matchupHealth.critical} critical) · overlap=${criticalOverlap.length}`,
);
