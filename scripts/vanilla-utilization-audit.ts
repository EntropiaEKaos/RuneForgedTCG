import fs from "node:fs";
import { VANILLA_EXPERIMENTAL_DECKS } from "../src/game/vanilla-experimental-decks";
import {
  VANILLA_BALANCE_LAB_MATCHUPS,
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

const gamesPerStratumRaw = Math.max(10, Math.min(100, Number(process.argv[2]) || 20));
const gamesPerStratum = gamesPerStratumRaw % 2 === 0 ? gamesPerStratumRaw : gamesPerStratumRaw + 1;
const strata = Math.max(3, Math.min(VANILLA_BALANCE_STRATUM_BASES.length, Number(process.argv[3]) || 3));
const enforce = process.argv.includes("--enforce");
const printFull = process.argv.includes("--print-full");
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
  const winsA = parts.reduce((sum, row) => sum + row.winsA, 0);
  const winsB = parts.reduce((sum, row) => sum + row.winsB, 0);
  const draws = parts.reduce((sum, row) => sum + row.draws, 0);
  const completedGames = parts.reduce((sum, row) => sum + row.completedGames, 0);
  return {
    deckA: parts[0]?.deckA ?? "unknown",
    deckB: parts[0]?.deckB ?? "unknown",
    completedGames,
    winsA,
    winsB,
    draws,
    winRateA: pct(winsA, winsA + winsB),
    winRateB: pct(winsB, winsA + winsB),
    avgRounds: round1(parts.reduce((sum, row) => sum + row.avgRounds * row.completedGames, 0) / Math.max(1, completedGames)),
    firstPlayerWinRate: pct(
      parts.reduce((sum, row) => sum + row.firstPlayerWins, 0),
      parts.reduce((sum, row) => sum + row.firstPlayerWins + row.secondPlayerWins, 0),
    ),
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

function deckSummary(deck: DeckUtilizationTelemetry) {
  const cards = cardRows(deck);
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
    region: VANILLA_EXPERIMENTAL_DECKS.find((candidate) => candidate.id === deck.id)?.regions[0] ?? "unknown",
    family: deck.id.endsWith("_1") ? "Vanguard" : "Ascendant",
    games: deck.games,
    wins: deck.wins,
    losses: deck.losses,
    draws: deck.draws,
    winRate: pct(deck.wins, decisive),
    seenCards: deck.seenCards,
    initialHandPerGame: perGame(deck.initialHandCards, deck.games),
    drawnPerGame: perGame(deck.drawnCards, deck.games),
    cardsPlayedPerGame: perGame(deck.cardsPlayed, deck.games),
    playRateWhenSeen: pct(deck.cardsPlayed, deck.seenCards),
    endHandPerGame: perGame(deck.endHandCards, deck.games),
    endHandRateWhenSeen: pct(deck.endHandCards, deck.seenCards),
    avgPrintedCostPlayed: round1(deck.printedCostPlayed / Math.max(1, deck.cardsPlayed)),
    avgManaSpentOnCardPlay: round1(deck.manaSpentOnCardPlays / Math.max(1, deck.cardsPlayed)),
    avgSpellManaSpentOnCardPlay: round1(deck.spellManaSpentOnCardPlays / Math.max(1, deck.cardsPlayed)),
    avgHandAtDecision: round1(deck.handSizeSamples / Math.max(1, deck.decisionSamples)),
    avgBenchAtDecision: round1(deck.benchSizeSamples / Math.max(1, deck.decisionSamples)),
    avgPermanentsAtDecision: round1(deck.permanentSizeSamples / Math.max(1, deck.decisionSamples)),
    avgSentinelasAtDecision: round1(deck.sentinelaSizeSamples / Math.max(1, deck.decisionSamples)),
    avgManaAtDecision: round1(deck.manaSamples / Math.max(1, deck.decisionSamples)),
    avgSpellManaAtDecision: round1(deck.spellManaSamples / Math.max(1, deck.decisionSamples)),
    finalSpellsCastPerGame: perGame(deck.finalSpellsCast, deck.games),
    finalAlliesSummonedPerGame: perGame(deck.finalAlliesSummoned, deck.games),
    nexusDamageDealtPerGame: perGame(deck.finalNexusDamageDealt, deck.games),
    finalHandPerGame: perGame(deck.finalHandSize, deck.games),
    finalBenchPerGame: perGame(deck.finalBenchSize, deck.games),
    finalPermanentsPerGame: perGame(deck.finalPermanentSize, deck.games),
    finalSentinelasPerGame: perGame(deck.finalSentinelaSize, deck.games),
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
      .slice(0, 6),
    mostIgnoredPlayableCards: [...cards]
      .filter((card) => card.playableSamples > 0)
      .sort((a, b) => b.ignoredPlayableRate - a.ignoredPlayableRate || b.ignoredPlayableSamples - a.ignoredPlayableSamples)
      .slice(0, 6),
    mostTargetStarvedCards: [...cards]
      .filter((card) => card.targetStarvedSamples > 0)
      .sort((a, b) => b.targetStarvedSamples - a.targetStarvedSamples)
      .slice(0, 6),
    cards,
  };
}

type DeckSummary = ReturnType<typeof deckSummary>;

function familySummary(name: "Vanguard" | "Ascendant", decks: DeckSummary[]) {
  const members = decks.filter((deck) => deck.family === name);
  const games = members.reduce((sum, deck) => sum + deck.games, 0);
  const wins = members.reduce((sum, deck) => sum + deck.wins, 0);
  const losses = members.reduce((sum, deck) => sum + deck.losses, 0);
  return {
    family: name,
    decks: members.map((deck) => deck.id),
    games,
    winRate: pct(wins, wins + losses),
    cardsPlayedPerGame: round1(members.reduce((sum, deck) => sum + deck.cardsPlayedPerGame * deck.games, 0) / Math.max(1, games)),
    endHandPerGame: round1(members.reduce((sum, deck) => sum + deck.endHandPerGame * deck.games, 0) / Math.max(1, games)),
    nexusDamageDealtPerGame: round1(members.reduce((sum, deck) => sum + deck.nexusDamageDealtPerGame * deck.games, 0) / Math.max(1, games)),
    finalAlliesSummonedPerGame: round1(members.reduce((sum, deck) => sum + deck.finalAlliesSummonedPerGame * deck.games, 0) / Math.max(1, games)),
    playerEndTurnsWithPlayableRate: round1(members.reduce((sum, deck) => sum + deck.playerHeuristic.endTurnsWithPlayableRate * deck.playerHeuristic.endTurns, 0) / Math.max(1, members.reduce((sum, deck) => sum + deck.playerHeuristic.endTurns, 0))),
    aiEndTurnsWithPlayableRate: round1(members.reduce((sum, deck) => sum + deck.aiCore.endTurnsWithPlayableRate * deck.aiCore.endTurns, 0) / Math.max(1, members.reduce((sum, deck) => sum + deck.aiCore.endTurns, 0))),
    policyUnsupportedSamples: members.reduce((sum, deck) => sum + deck.policyUnsupportedSamples, 0),
    targetStarvedSamples: members.reduce((sum, deck) => sum + deck.targetStarvedSamples, 0),
    ignoredPlayableSamples: members.reduce((sum, deck) => sum + deck.ignoredPlayableSamples, 0),
  };
}

const poolErrors = validateVanillaBalancePool();
const telemetryParts = [];
const matchupRows = [];
let incompleteMatchups = 0;
for (const matchup of vanillaBalanceMatchups()) {
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
    if (result.summary.completedGames !== gamesPerStratum) incompleteMatchups += 1;
  }
  matchupRows.push(aggregateMatch(summaries));
}

const telemetry = mergeBalanceSimulationTelemetry(telemetryParts);
const deckSummaries = Object.values(telemetry.decks).map(deckSummary).sort((a, b) => b.winRate - a.winRate || a.id.localeCompare(b.id));
const expectedGamesPerDeck = 11 * gamesPerStratum * strata;
const expectedPolicyGamesPerDeck = expectedGamesPerDeck / 2;
const telemetryErrors: string[] = [];
for (const deck of deckSummaries) {
  if (deck.games !== expectedGamesPerDeck) telemetryErrors.push(`${deck.id}: expected ${expectedGamesPerDeck} games, found ${deck.games}`);
  if (deck.playerHeuristic.games !== expectedPolicyGamesPerDeck) telemetryErrors.push(`${deck.id}: player-heuristic expected ${expectedPolicyGamesPerDeck} games, found ${deck.playerHeuristic.games}`);
  if (deck.aiCore.games !== expectedPolicyGamesPerDeck) telemetryErrors.push(`${deck.id}: ai-core expected ${expectedPolicyGamesPerDeck} games, found ${deck.aiCore.games}`);
  if (deck.seenCards < deck.games) telemetryErrors.push(`${deck.id}: implausibly low seen-card count ${deck.seenCards}`);
}

const vanguard = familySummary("Vanguard", deckSummaries);
const ascendant = familySummary("Ascendant", deckSummaries);
const diagnosis = {
  vanguardVsAscendantWinRateGap: round1(vanguard.winRate - ascendant.winRate),
  cardsPlayedPerGameGap: round1(vanguard.cardsPlayedPerGame - ascendant.cardsPlayedPerGame),
  endHandPerGameGap: round1(vanguard.endHandPerGame - ascendant.endHandPerGame),
  nexusDamagePerGameGap: round1(vanguard.nexusDamageDealtPerGame - ascendant.nexusDamageDealtPerGame),
  summonPerGameGap: round1(vanguard.finalAlliesSummonedPerGame - ascendant.finalAlliesSummonedPerGame),
  note: "Positive gaps are Vanguard minus Ascendant. Utilization telemetry diagnoses extraction friction; it does not itself authorize card-stat changes.",
};

const totalGames = matchupRows.reduce((sum, row) => sum + row.completedGames, 0);
const qualityGate =
  poolErrors.length === 0 &&
  matchupRows.length === VANILLA_BALANCE_LAB_MATCHUPS &&
  incompleteMatchups === 0 &&
  telemetryErrors.length === 0
    ? "pass"
    : "blocked";

const report = {
  version: "1.2",
  methodology: "read-only instrumentation of the exact Balance Lab simulator; full 66-matchup round robin; alternating deck policy side and first player; semantic card-type aware utilization; no authoritative gameplay mutations",
  gamesPerStratum,
  strata,
  gamesPerMatchup: gamesPerStratum * strata,
  matchups: matchupRows.length,
  totalGames,
  expectedGamesPerDeck,
  expectedPolicyGamesPerDeck,
  quality: {
    gate: qualityGate,
    poolErrors,
    telemetryErrors,
    incompleteMatchups,
  },
  families: { vanguard, ascendant },
  diagnosis,
  deckSummaries,
  matchupRows,
};

const compact = {
  version: report.version,
  methodology: report.methodology,
  gamesPerStratum: report.gamesPerStratum,
  strata: report.strata,
  gamesPerMatchup: report.gamesPerMatchup,
  matchups: report.matchups,
  totalGames: report.totalGames,
  quality: report.quality,
  families: report.families,
  diagnosis: report.diagnosis,
  deckSummaries: report.deckSummaries.map((deck) => ({
    id: deck.id,
    name: deck.name,
    family: deck.family,
    winRate: deck.winRate,
    cardsPlayedPerGame: deck.cardsPlayedPerGame,
    endHandPerGame: deck.endHandPerGame,
    nexusDamageDealtPerGame: deck.nexusDamageDealtPerGame,
    finalAlliesSummonedPerGame: deck.finalAlliesSummonedPerGame,
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

if (writePath) fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(printFull ? report : compact, null, 2));
if (enforce && qualityGate !== "pass") {
  console.error(`VANILLA UTILIZATION 1.2: BLOCKED — ${poolErrors.length} pool errors · ${telemetryErrors.length} telemetry errors · ${incompleteMatchups} incomplete strata`);
  process.exitCode = 1;
} else if (enforce) {
  console.log(`VANILLA UTILIZATION 1.2: PASS — ${totalGames} games · ${matchupRows.length}/${VANILLA_BALANCE_LAB_MATCHUPS} matchups · telemetry quality certified`);
}
