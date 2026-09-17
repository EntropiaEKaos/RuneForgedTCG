import assert from "node:assert/strict";
import { declareFourPlayerAttacker, declareFourPlayerBlocker } from "./four-player-combat";
import { cleanupObjectsForEliminatedSeat } from "./four-player-elimination";
import { passFourPlayerFlow, resolveFourPlayerFlow, submitFourPlayerAction } from "./four-player-flow";
import { advanceFourPlayerMatchTurn, createFourPlayerMatchState, eliminateFourPlayerMatchSeat } from "./four-player-match";

let match = createFourPlayerMatchState("p1");
assert.equal(match.turn.activeSeat, "p1");

// P1 opens a spell; P2 passes; P3 answers.
match.resolution = submitFourPlayerAction(match.resolution, {
  id: "p1-opener", controller: "p1", kind: "spell", payload: {},
});
match.resolution = passFourPlayerFlow(match.resolution);
match.resolution = submitFourPlayerAction(match.resolution, {
  id: "p3-response", controller: "p3", kind: "response", payload: {},
});

// Everyone passes after P3's response, so it resolves first.
for (let i = 0; i < 4; i += 1) match.resolution = passFourPlayerFlow(match.resolution);
let resolution = resolveFourPlayerFlow(match.resolution);
assert.equal(resolution.resolved?.id, "p3-response");
match.resolution = resolution.flow;

// A fresh pass cycle resolves P1's original spell.
for (let i = 0; i < 4; i += 1) match.resolution = passFourPlayerFlow(match.resolution);
resolution = resolveFourPlayerFlow(match.resolution);
assert.equal(resolution.resolved?.id, "p1-opener");
match.resolution = resolution.flow;

// P1 splits combat across all three opponents; only each assigned defender may block.
match.combat = declareFourPlayerAttacker(match.combat, "dragon", "p2");
match.combat = declareFourPlayerAttacker(match.combat, "warrior", "p3");
match.combat = declareFourPlayerAttacker(match.combat, "elemental", "p4");
match.combat = declareFourPlayerBlocker(match.combat, "p2", "p2-guard", "dragon");
assert.throws(
  () => declareFourPlayerBlocker(match.combat, "p4", "p4-illegal", "dragon"),
  /cannot block an attacker assigned to p2/,
);

// P3 is eliminated. Owned objects leave; a P1 object controlled by P3 returns to P1.
const cleanup = cleanupObjectsForEliminatedSeat([
  { id: "p3-unit", kind: "unit", owner: "p3", controller: "p3" },
  { id: "p1-stolen", kind: "unit", owner: "p1", controller: "p3" },
], "p3");
assert.deepEqual(cleanup.removedObjectIds, ["p3-unit"]);
assert.equal(cleanup.survivingObjects[0]?.controller, "p1");

match = eliminateFourPlayerMatchSeat(match, "p3");
assert.equal(match.seats.p3.eliminated, true);

// End P1 turn: P2 is next. End P2 turn: eliminated P3 is skipped and P4 becomes active.
match = advanceFourPlayerMatchTurn(match);
assert.equal(match.turn.activeSeat, "p2");
match = advanceFourPlayerMatchTurn(match);
assert.equal(match.turn.activeSeat, "p4");
assert.deepEqual(match.turn.eliminatedSeats, ["p3"]);

console.log("FOUR PLAYER COMPLETE HEADLESS MINI-MATCH: PASS");
