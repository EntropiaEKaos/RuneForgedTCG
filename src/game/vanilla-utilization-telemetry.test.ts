import assert from "node:assert/strict";
import { VANILLA_EXPERIMENTAL_DECKS } from "./vanilla-experimental-decks";
import { vanillaBalanceMatchups, vanillaBalanceSeed, vanillaExperimentalOverrides } from "./vanilla-balance-lab";
import {
  runBalanceSimulation,
  runBalanceSimulationWithTelemetry,
  mergeBalanceSimulationTelemetry,
} from "../lib/balance-simulator";

const overrides = vanillaExperimentalOverrides();
const regionalMatchups = vanillaBalanceMatchups().filter((matchup) => matchup.sameRegion);
assert.equal(regionalMatchups.length, 6, "the non-interference sentinel must cover all six regional Vanguard/Ascendant pairs");

for (const [index, matchup] of regionalMatchups.entries()) {
  const seed = vanillaBalanceSeed(matchup, index % 3);
  const plain = runBalanceSimulation(matchup.leftId, matchup.rightId, 4, seed, overrides);
  const instrumented = runBalanceSimulationWithTelemetry(matchup.leftId, matchup.rightId, 4, seed, overrides);

  assert.deepEqual(
    instrumented.summary,
    plain,
    `opt-in utilization telemetry must not alter deterministic match results for ${matchup.leftId} × ${matchup.rightId}`,
  );

  const left = instrumented.telemetry.decks[matchup.leftId];
  const right = instrumented.telemetry.decks[matchup.rightId];
  assert.ok(left && right, "both matchup decks need telemetry");
  assert.equal(left.games, 4);
  assert.equal(right.games, 4);
  assert.equal(left.policies["player-heuristic"].games, 2);
  assert.equal(left.policies["ai-core"].games, 2);
  assert.equal(right.policies["player-heuristic"].games, 2);
  assert.equal(right.policies["ai-core"].games, 2);
  assert.ok(left.seenCards >= left.cardsPlayed);
  assert.ok(right.seenCards >= right.cardsPlayed);
  assert.ok(left.initialHandCards > 0 && right.initialHandCards > 0);
  assert.ok(left.decisionSamples > 0 && right.decisionSamples > 0);
  assert.equal(left.wins + left.losses + left.draws, 4);
  assert.equal(right.wins + right.losses + right.draws, 4);
  assert.ok(Object.keys(left.cards).length > 0 && Object.keys(right.cards).length > 0);
  assert.ok(Object.keys(left.semanticTypes).length > 0 && Object.keys(right.semanticTypes).length > 0);

  for (const deck of [left, right]) {
    for (const card of Object.values(deck.cards)) {
      assert.ok(card.seen >= card.played, `${card.defId} cannot be played more times than it was seen`);
      assert.ok(card.seen >= card.endHand, `${card.defId} cannot end in hand more times than it was seen`);
    }
    assert.ok(Number.isFinite(deck.finalNexusDamageDealt));
    assert.ok(Number.isFinite(deck.manaSamples));
    assert.ok(Number.isFinite(deck.spellManaSamples));
    assert.equal(
      Object.values(deck.cards).reduce((sum, card) => sum + card.policyUnsupportedSamples, 0),
      0,
      `${deck.id} must not expose a telemetry-playable semantic type unsupported by the player heuristic`,
    );
  }

  const merged = mergeBalanceSimulationTelemetry([instrumented.telemetry, instrumented.telemetry]);
  assert.equal(merged.decks[matchup.leftId].games, 8);
  assert.equal(merged.decks[matchup.rightId].games, 8);
  assert.equal(merged.decks[matchup.leftId].cardsPlayed, left.cardsPlayed * 2);
  assert.equal(merged.decks[matchup.rightId].seenCards, right.seenCards * 2);
}

assert.equal(VANILLA_EXPERIMENTAL_DECKS.length, 12);
console.log(
  "VANILLA 1.2 UTILIZATION TELEMETRY: PASS — six regional pairs preserve deterministic summaries and record deck/card/type/policy utilization",
);
