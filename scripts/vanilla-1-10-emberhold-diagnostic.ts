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

const poolErrors = validateVanillaBalancePool();
const overrides = vanillaExperimentalOverrides();
const matchups = vanillaBalanceMatchups().filter(
  (matchup) => matchup.leftId === TARGET_ID || matchup.rightId === TARGET_ID,
);
const telemetryParts = [];
const matchupRows = [];
let incompleteStrata = 0;

for (const matchup of matchups) {
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

  const completedGames = parts.reduce((sum, row) => sum + row.completedGames, 0);
  const targetIsLeft = matchup.leftId === TARGET_ID;
  const targetWins = parts.reduce((sum, row) => sum + (targetIsLeft ? row.winsA : row.winsB), 0);
  const opponentWins = parts.reduce((sum, row) => sum + (targetIsLeft ? row.winsB : row.winsA), 0);
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
if (!target) throw new Error(`Missing utilization telemetry for ${TARGET_ID}`);

const expectedGames = matchups.length * GAMES_PER_STRATUM * STRATA;
const expectedPolicyGames = expectedGames / 2;
const telemetryErrors: string[] = [];
if (matchups.length !== 11) telemetryErrors.push(`expected 11 target matchups, found ${matchups.length}`);
if (target.games !== expectedGames) telemetryErrors.push(`expected ${expectedGames} target games, found ${target.games}`);
if (target.policies["player-heuristic"].games !== expectedPolicyGames) {
  telemetryErrors.push(`player-heuristic expected ${expectedPolicyGames} games, found ${target.policies["player-heuristic"].games}`);
}
if (target.policies["ai-core"].games !== expectedPolicyGames) {
  telemetryErrors.push(`ai-core expected ${expectedPolicyGames} games, found ${target.policies["ai-core"].games}`);
}

const cardRows = Object.values(target.cards).map((card) => ({
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

const player = target.policies["player-heuristic"];
const ai = target.policies["ai-core"];
const decisiveGames = target.wins + target.losses;
const critical = matchupRows.filter((row) => row.status === "critical").length;
const watch = matchupRows.filter((row) => row.status === "watch").length;
const healthy = matchupRows.filter((row) => row.status === "healthy").length;
const qualityGate =
  poolErrors.length === 0 && incompleteStrata === 0 && telemetryErrors.length === 0 ? "pass" : "blocked";

const report = {
  version: "1.10-diagnostic-1",
  methodology:
    "Read-only Emberhold Ascendant utilization diagnostic using the certified Vanilla Balance Lab simulator, exact five deterministic strata and current product recipes. No CardDef, recipe, AI or rules mutation.",
  target: {
    id: TARGET_ID,
    name: VANILLA_EXPERIMENTAL_DECKS.find((deck) => deck.id === TARGET_ID)?.name ?? TARGET_ID,
    games: target.games,
    wins: target.wins,
    losses: target.losses,
    draws: target.draws,
    winRate: pct(target.wins, decisiveGames),
    matchupHealth: { healthy, watch, critical },
    cardsPlayedPerGame: perGame(target.cardsPlayed, target.games),
    endHandPerGame: perGame(target.endHandCards, target.games),
    finalHandPerGame: perGame(target.finalHandSize, target.games),
    finalBenchPerGame: perGame(target.finalBenchSize, target.games),
    finalAlliesSummonedPerGame: perGame(target.finalAlliesSummoned, target.games),
    nexusDamageDealtPerGame: perGame(target.finalNexusDamageDealt, target.games),
    targetStarvedSamples: cardRows.reduce((sum, card) => sum + card.targetStarvedSamples, 0),
    ignoredPlayableSamples: cardRows.reduce((sum, card) => sum + card.ignoredPlayableSamples, 0),
    policyUnsupportedSamples: cardRows.reduce((sum, card) => sum + card.policyUnsupportedSamples, 0),
    playerHeuristic: {
      games: player.games,
      cardPlaysPerGame: perGame(player.cardPlays, player.games),
      endTurnsWithPlayableRate: pct(player.endTurnsWithPlayable, player.endTurns),
      avgUnspentManaAtTurnEnd: round1(player.unspentManaAtTurnEnd / Math.max(1, player.endTurns)),
      avgUnspentSpellManaAtTurnEnd: round1(player.unspentSpellManaAtTurnEnd / Math.max(1, player.endTurns)),
    },
    aiCore: {
      games: ai.games,
      cardPlaysPerGame: perGame(ai.cardPlays, ai.games),
      endTurnsWithPlayableRate: pct(ai.endTurnsWithPlayable, ai.endTurns),
      avgUnspentManaAtTurnEnd: round1(ai.unspentManaAtTurnEnd / Math.max(1, ai.endTurns)),
      avgUnspentSpellManaAtTurnEnd: round1(ai.unspentSpellManaAtTurnEnd / Math.max(1, ai.endTurns)),
    },
  },
  simulation: {
    gamesPerStratum: GAMES_PER_STRATUM,
    strata: STRATA,
    certifiedSeedBases: VANILLA_BALANCE_STRATUM_BASES.slice(0, STRATA),
    matchups: matchups.length,
    totalGames: matchupRows.reduce((sum, row) => sum + row.completedGames, 0),
  },
  quality: { gate: qualityGate, poolErrors, telemetryErrors, incompleteStrata },
  matchupRows: matchupRows.sort((a, b) => a.winRate - b.winRate || a.opponentId.localeCompare(b.opponentId)),
  mostStuckCards: [...cardRows]
    .filter((card) => card.seen >= Math.max(10, Math.floor(target.games * 0.08)))
    .sort((a, b) => b.endHandRateWhenSeen - a.endHandRateWhenSeen || b.endHand - a.endHand)
    .slice(0, 10),
  mostIgnoredPlayableCards: [...cardRows]
    .filter((card) => card.playableSamples > 0)
    .sort((a, b) => b.ignoredPlayableRate - a.ignoredPlayableRate || b.ignoredPlayableSamples - a.ignoredPlayableSamples)
    .slice(0, 10),
  mostTargetStarvedCards: [...cardRows]
    .filter((card) => card.targetStarvedSamples > 0)
    .sort((a, b) => b.targetStarvedSamples - a.targetStarvedSamples)
    .slice(0, 10),
  cardRows: cardRows.sort((a, b) => a.printedCost - b.printedCost || a.defId.localeCompare(b.defId)),
};

if (writePath) fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (qualityGate !== "pass") {
  console.error(`VANILLA 1.10 EMBERHOLD DIAGNOSTIC: BLOCKED — ${poolErrors.length} pool errors · ${telemetryErrors.length} telemetry errors · ${incompleteStrata} incomplete strata`);
  process.exitCode = 1;
} else {
  console.log(
    `VANILLA 1.10 EMBERHOLD DIAGNOSTIC: PASS — ${report.simulation.totalGames} games · ${matchups.length}/11 matchups · WR=${report.target.winRate}% · ${healthy}H/${watch}W/${critical}C`,
  );
}
