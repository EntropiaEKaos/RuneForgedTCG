import assert from "node:assert/strict";
import {
  FOUR_PLAYER_STARTING_LIFE,
  applyFourPlayerDamage,
  createFourPlayerMatchState,
} from "./four-player-match";

let match = createFourPlayerMatchState("p1");
for (const seat of ["p1", "p2", "p3", "p4"] as const) {
  assert.equal(match.seats[seat].life, FOUR_PLAYER_STARTING_LIFE);
  assert.deepEqual(match.seats[seat].generalDamageReceived, {});
}

match = applyFourPlayerDamage(match, "p2", 4);
assert.equal(match.seats.p2.life, FOUR_PLAYER_STARTING_LIFE - 4);
assert.deepEqual(match.seats.p2.generalDamageReceived, {});

match = applyFourPlayerDamage(match, "p2", 6, "p1");
assert.equal(match.seats.p2.life, FOUR_PLAYER_STARTING_LIFE - 10);
assert.equal(match.seats.p2.generalDamageReceived.p1, 6);

match = applyFourPlayerDamage(match, "p2", 3, "p3");
match = applyFourPlayerDamage(match, "p2", 2, "p1");
assert.equal(match.seats.p2.generalDamageReceived.p1, 8);
assert.equal(match.seats.p2.generalDamageReceived.p3, 3);

assert.throws(() => applyFourPlayerDamage(match, "p2", -1), /non-negative finite/);

match = applyFourPlayerDamage(match, "p2", match.seats.p2.life, "p1");
assert.equal(match.seats.p2.life, 0);
assert.equal(match.seats.p2.eliminated, true);
assert.equal(match.seats.p2.generalDamageReceived.p1, 8 + (FOUR_PLAYER_STARTING_LIFE - 15));
assert.throws(() => applyFourPlayerDamage(match, "p2", 1), /eliminated seat/);

// General damage is telemetry/state only in v0: it does not independently eliminate a player.
let dominance = createFourPlayerMatchState("p1");
dominance = applyFourPlayerDamage(dominance, "p4", 21, "p1");
assert.equal(dominance.seats.p4.eliminated, false);
assert.equal(dominance.seats.p4.life, FOUR_PLAYER_STARTING_LIFE - 21);
assert.equal(dominance.seats.p4.generalDamageReceived.p1, 21);

console.log("FOUR PLAYER LIFE + GENERAL DAMAGE LEDGER: PASS");
