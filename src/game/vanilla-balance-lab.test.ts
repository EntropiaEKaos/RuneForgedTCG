import assert from "node:assert/strict";
import { runBalanceSimulation } from "../lib/balance-simulator";
import { VANILLA_EXPERIMENTAL_DECKS } from "./vanilla-experimental-decks";
import {
  VANILLA_BALANCE_LAB_DECKS,
  VANILLA_BALANCE_LAB_MATCHUPS,
  validateVanillaBalancePool,
  vanillaBalanceMatchups,
  vanillaBalanceSeed,
  vanillaExperimentalOverrides,
} from "./vanilla-balance-lab";

const errors = validateVanillaBalancePool();
assert.deepEqual(errors, []);
assert.equal(VANILLA_EXPERIMENTAL_DECKS.length, VANILLA_BALANCE_LAB_DECKS);

const overrides = vanillaExperimentalOverrides();
assert.equal(Object.keys(overrides).length, VANILLA_BALANCE_LAB_DECKS);
for (const deck of VANILLA_EXPERIMENTAL_DECKS) {
  assert.ok(overrides[deck.id], `${deck.id} must exist as an isolated simulator override`);
  assert.equal(overrides[deck.id].cards.length, 40, `${deck.id} must remain a 40-card simulation deck`);
}

const matchups = vanillaBalanceMatchups();
assert.equal(matchups.length, VANILLA_BALANCE_LAB_MATCHUPS);
assert.equal(matchups.filter((row) => row.sameRegion).length, 6);
assert.equal(matchups.filter((row) => !row.sameRegion).length, 60);
assert.equal(new Set(matchups.map((row) => `${row.leftId}::${row.rightId}`)).size, VANILLA_BALANCE_LAB_MATCHUPS);

const first = matchups[0];
assert.equal(vanillaBalanceSeed(first, 0), vanillaBalanceSeed(first, 0), "seed generation must be deterministic");
assert.notEqual(vanillaBalanceSeed(first, 0), vanillaBalanceSeed(first, 1), "independent strata need distinct seeds");

const smoke = runBalanceSimulation(first.leftId, first.rightId, 4, vanillaBalanceSeed(first, 0), overrides);
assert.equal(smoke.requestedGames, 4);
assert.equal(smoke.completedGames, 4);
assert.equal(smoke.winsA + smoke.winsB + smoke.draws, 4);
assert.equal(smoke.firstPlayerWins + smoke.secondPlayerWins, smoke.winsA + smoke.winsB);
assert.ok(Number.isFinite(smoke.avgRounds));
assert.ok(smoke.roundDistribution.max >= smoke.roundDistribution.min);

console.log(
  `VANILLA BALANCE LAB 1.1: PASS — ${VANILLA_BALANCE_LAB_DECKS} isolated decks · ${VANILLA_BALANCE_LAB_MATCHUPS} pairwise matchups · deterministic real-engine simulation smoke certified`,
);
