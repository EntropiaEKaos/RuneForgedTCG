import assert from "node:assert/strict";
import { getDeck } from "./decks";
import { profileDeck } from "./gameplay-profile";
import {
  ALPHA_STARTER_BALANCE_MATCHUPS,
  ALPHA_STARTER_BALANCE_STRATUM_BASES,
  ALPHA_STARTER_IDS,
  alphaStarterBalanceMatchups,
  alphaStarterBalanceSeed,
  validateAlphaStarterBalancePool,
} from "./alpha-starter-balance";
import {
  runBalanceSimulation,
  runBalanceSimulationWithTelemetry,
} from "../lib/balance-simulator";

assert.deepEqual(validateAlphaStarterBalancePool(), [], "Alpha starter balance pool must be structurally valid");
assert.equal(ALPHA_STARTER_IDS.length, 6, "Alpha balance baseline must contain exactly six starters");

for (const deckId of ALPHA_STARTER_IDS) {
  const deck = getDeck(deckId);
  const profile = profileDeck(deck.cards);
  assert.equal(profile.size, 40, `${deckId} must remain a 40-card starter`);
  assert.ok(profile.averageCost > 0, `${deckId} must expose a measurable mana curve`);
}

const matchups = alphaStarterBalanceMatchups();
assert.equal(matchups.length, ALPHA_STARTER_BALANCE_MATCHUPS, "six starters must produce exactly 15 unique pairwise matchups");
assert.equal(
  new Set(matchups.map((row) => `${row.leftId}::${row.rightId}`)).size,
  ALPHA_STARTER_BALANCE_MATCHUPS,
  "Alpha starter matchups must not contain duplicate pairs",
);

const seeds = new Set<number>();
for (const matchup of matchups) {
  for (let stratum = 0; stratum < ALPHA_STARTER_BALANCE_STRATUM_BASES.length; stratum += 1) {
    const seed = alphaStarterBalanceSeed(matchup, stratum);
    assert.equal(seeds.has(seed), false, `seed collision detected at ${matchup.leftId} vs ${matchup.rightId}, stratum ${stratum}`);
    seeds.add(seed);
  }
}

const probe = matchups[0];
const seed = alphaStarterBalanceSeed(probe, 0);
const plain = runBalanceSimulation(probe.leftId, probe.rightId, 4, seed);
const instrumented = runBalanceSimulationWithTelemetry(probe.leftId, probe.rightId, 4, seed);
assert.deepEqual(
  instrumented.summary,
  plain,
  "read-only starter utilization telemetry must never change deterministic simulation results",
);
assert.equal(instrumented.summary.completedGames, 4, "starter baseline probe must complete every requested game");
assert.equal(instrumented.telemetry.decks[probe.leftId]?.games, 4, "left starter telemetry must account for all probe games");
assert.equal(instrumented.telemetry.decks[probe.rightId]?.games, 4, "right starter telemetry must account for all probe games");

console.log(
  "ALPHA STARTER BALANCE 1.0 CONTRACT: PASS — 6 starters · 15 matchups · 8 deterministic seed strata · telemetry non-interference certified",
);
