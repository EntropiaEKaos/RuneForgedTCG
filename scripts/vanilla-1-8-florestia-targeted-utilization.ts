import fs from "node:fs";
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

const TARGET_ID = "vanilla_forest_2";
const GAMES_PER_STRATUM = 100;
const STRATA = 5;
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";
const overrides = vanillaExperimentalOverrides();

if (STRATA > VANILLA_BALANCE_STRATUM_BASES.length) throw new Error("strata outside certified seed table");

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
function pct(numerator: number, denominator: number): number {
  return round1((numerator / Math.max(1, denominator)) * 100);
}
function perGame(value: number, games: number): number {
  return round1(value / Math.max(1, games));
}

function aggregateMatch(parts: SimulationSummary[], targetIsA: boolean) {
  const wins = parts.reduce((sum, row) => sum + (targetIsA ? row.winsA : row.winsB), 0);
  const losses = parts.reduce((sum, row) => sum + (targetIsA ? row.winsB : row.winsA), 0);
  const draws = parts.reduce((sum, row) => sum + row.draws, 0);
  const completedGames = parts.reduce((sum, row) => sum + row.completedGames, 0);
  return {
    completedGames,
    wins,
    losses,
    draws,
    winRate: pct(wins, wins + losses),
    avgRounds: round1(parts.reduce((sum, row) => sum + row.avgRounds * row.completedGames, 0) / Math.max(1, completedGames)),
  };
}

function cardRows(deck: DeckUtilizationTelemetry) {
  return Object.values(deck.cards).map((card) => ({
    defId: card.defId,
    name: card.name,
    semanticType: card.semanticType,
    printedCost: card.printedCost,
    seen: card.seen,
    initialHand: card.initialHand,
    drawn: card.drawn,
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

function policySummary(deck: DeckUtilizationTelemetry, policyName: "player-heuristic" | "ai-core") {
  const policy = deck.policies[policyName];
  return {
    games: policy.games,
    decisions: policy.decisions,
    cardPlays: policy.cardPlays,
    cardPlaysPerGame: perGame(policy.cardPlays, policy.games),
    activations: policy.activations,
    attacks: policy.attacks,
    endTurns: policy.endTurns,
    noOpActions: policy.noOpActions,
    endTurnsWithPlayable: policy.endTurnsWithPlayable,
    endTurnsWithPlayableRate: pct(policy.endTurnsWithPlayable, policy.endTurns),
    avgUnspentManaAtTurnEnd: round1(policy.unspentManaAtTurnEnd / Math.max(1, policy.endTurns)),
    avgUnspentSpellManaAtTurnEnd: round1(policy.unspentSpellManaAtTurnEnd / Math.max(1, policy.endTurns)),
  };
}

const poolErrors = validateVanillaBalancePool();
const selectedMatchups = vanillaBalanceMatchups().filter((row) => row.leftId === TARGET_ID || row.rightId === TARGET_ID);
if (selectedMatchups.length !== 11) throw new Error(`${TARGET_ID}: expected 11 matchups, found ${selectedMatchups.length}`);

const telemetryParts = [];
const matchupRows = [];
let incompleteStrata = 0;

for (const matchup of selectedMatchups) {
  const parts: SimulationSummary[] = [];
  for (let stratum = 0; stratum < STRATA; stratum += 1) {
    const result = runBalanceSimulationWithTelemetry(
      matchup.leftId,
      matchup.rightId,
      GAMES_PER_STRATUM,
      vanillaBalanceSeed(matchup, stratum),
      overrides,
    );
    parts.push(result.summary);
    telemetryParts.push(result.telemetry);
    if (result.summary.completedGames !== GAMES_PER_STRATUM) incompleteStrata += 1;
  }
  const targetIsA = matchup.leftId === TARGET_ID;
  matchupRows.push({
    opponent: targetIsA ? matchup.rightId : matchup.leftId,
    ...aggregateMatch(parts, targetIsA),
  });
}

const telemetry = mergeBalanceSimulationTelemetry(telemetryParts);
const deck = telemetry.decks[TARGET_ID];
if (!deck) throw new Error(`${TARGET_ID}: telemetry missing target deck`);
const cards = cardRows(deck);
const expectedGames = 11 * GAMES_PER_STRATUM * STRATA;
const expectedPolicyGames = expectedGames / 2;
const telemetryErrors: string[] = [];
if (deck.games !== expectedGames) telemetryErrors.push(`expected ${expectedGames} target games, found ${deck.games}`);
if (deck.policies["player-heuristic"].games !== expectedPolicyGames) telemetryErrors.push(`player-heuristic expected ${expectedPolicyGames}, found ${deck.policies["player-heuristic"].games}`);
if (deck.policies["ai-core"].games !== expectedPolicyGames) telemetryErrors.push(`ai-core expected ${expectedPolicyGames}, found ${deck.policies["ai-core"].games}`);
if (deck.seenCards < deck.games) telemetryErrors.push(`implausibly low seen-card count ${deck.seenCards}`);

const decisive = deck.wins + deck.losses;
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

const qualityGate = poolErrors.length === 0 && incompleteStrata === 0 && telemetryErrors.length === 0 ? "pass" : "blocked";
const report = {
  version: "Vanilla 1.8 Florestia targeted utilization",
  methodology: "Exact production Balance Lab engine, seeds and policies; only matchups containing Florestia Ascendant are instrumented. No CardDef, recipe, AI or engine mutation.",
  targetId: TARGET_ID,
  gamesPerStratum: GAMES_PER_STRATUM,
  strata: STRATA,
  gamesPerMatchup: GAMES_PER_STRATUM * STRATA,
  matchups: selectedMatchups.length,
  totalGames: matchupRows.reduce((sum, row) => sum + row.completedGames, 0),
  quality: { gate: qualityGate, poolErrors, telemetryErrors, incompleteStrata },
  deck: {
    games: deck.games,
    wins: deck.wins,
    losses: deck.losses,
    draws: deck.draws,
    winRate: pct(deck.wins, decisive),
    seenCards: deck.seenCards,
    cardsPlayedPerGame: perGame(deck.cardsPlayed, deck.games),
    playRateWhenSeen: pct(deck.cardsPlayed, deck.seenCards),
    endHandPerGame: perGame(deck.endHandCards, deck.games),
    endHandRateWhenSeen: pct(deck.endHandCards, deck.seenCards),
    avgPrintedCostPlayed: round1(deck.printedCostPlayed / Math.max(1, deck.cardsPlayed)),
    avgManaSpentOnCardPlay: round1(deck.manaSpentOnCardPlays / Math.max(1, deck.cardsPlayed)),
    finalSpellsCastPerGame: perGame(deck.finalSpellsCast, deck.games),
    finalAlliesSummonedPerGame: perGame(deck.finalAlliesSummoned, deck.games),
    nexusDamageDealtPerGame: perGame(deck.finalNexusDamageDealt, deck.games),
    finalHandPerGame: perGame(deck.finalHandSize, deck.games),
    finalBenchPerGame: perGame(deck.finalBenchSize, deck.games),
    finalPermanentsPerGame: perGame(deck.finalPermanentSize, deck.games),
    policyUnsupportedSamples: cards.reduce((sum, card) => sum + card.policyUnsupportedSamples, 0),
    targetStarvedSamples: cards.reduce((sum, card) => sum + card.targetStarvedSamples, 0),
    ignoredPlayableSamples: cards.reduce((sum, card) => sum + card.ignoredPlayableSamples, 0),
    playerHeuristic: policySummary(deck, "player-heuristic"),
    aiCore: policySummary(deck, "ai-core"),
    semanticTypes,
    mostStuckCards: [...cards]
      .filter((card) => card.seen >= Math.max(10, Math.floor(deck.games * 0.08)))
      .sort((a, b) => b.endHandRateWhenSeen - a.endHandRateWhenSeen || b.endHand - a.endHand)
      .slice(0, 10),
    mostIgnoredPlayableCards: [...cards]
      .filter((card) => card.playableSamples > 0)
      .sort((a, b) => b.ignoredPlayableRate - a.ignoredPlayableRate || b.ignoredPlayableSamples - a.ignoredPlayableSamples)
      .slice(0, 10),
    mostTargetStarvedCards: [...cards]
      .filter((card) => card.targetStarvedSamples > 0)
      .sort((a, b) => b.targetStarvedSamples - a.targetStarvedSamples)
      .slice(0, 10),
    cards: [...cards].sort((a, b) => a.defId.localeCompare(b.defId)),
  },
  matchupRows,
};

if (writePath) {
  fs.mkdirSync(writePath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
if (qualityGate !== "pass") {
  console.error(`VANILLA 1.8 FLORESTIA TARGETED UTILIZATION: BLOCKED — ${poolErrors.length} pool errors · ${telemetryErrors.length} telemetry errors · ${incompleteStrata} incomplete strata`);
  process.exitCode = 1;
} else {
  console.log(`VANILLA 1.8 FLORESTIA TARGETED UTILIZATION: PASS — ${report.totalGames} games · ${selectedMatchups.length}/11 matchups`);
}
