import assert from "node:assert/strict";
import { eliminateFourPlayerMatchSeat, createFourPlayerMatchState } from "./four-player-match";
import { advanceFourPlayerPhase } from "./four-player-phase-machine";

let match = createFourPlayerMatchState("p1");
assert.equal(match.phase, "beginning");

for (const expected of ["main_1", "combat", "main_2", "ending"] as const) {
  const advanced = advanceFourPlayerPhase(match);
  match = advanced.match;
  assert.equal(match.phase, expected);
  assert.equal(advanced.turnAdvanced, false);
  assert.equal(match.turn.activeSeat, "p1");
  assert.equal(match.resolution.priority.holder, "p1");
  assert.equal(match.resolution.priority.consecutivePasses, 0);
}

const nextTurn = advanceFourPlayerPhase(match);
assert.equal(nextTurn.turnAdvanced, true);
assert.equal(nextTurn.match.turn.activeSeat, "p2");
assert.equal(nextTurn.match.turn.turn, 2);
assert.equal(nextTurn.match.phase, "beginning");
assert.equal(nextTurn.match.resolution.priority.holder, "p2");

// Eliminated seats are skipped by the canonical turn manager.
let skip = createFourPlayerMatchState("p1");
skip = eliminateFourPlayerMatchSeat(skip, "p2");
skip = { ...skip, phase: "ending" };
const skipped = advanceFourPlayerPhase(skip);
assert.equal(skipped.match.turn.activeSeat, "p3");
assert.equal(skipped.match.phase, "beginning");

// Eliminating the active seat starts the replacement active seat at beginning.
let activeElimination = { ...createFourPlayerMatchState("p1"), phase: "combat" as const };
activeElimination = eliminateFourPlayerMatchSeat(activeElimination, "p1");
assert.equal(activeElimination.turn.activeSeat, "p2");
assert.equal(activeElimination.phase, "beginning");

// Completed matches are terminal.
let completed = createFourPlayerMatchState("p1");
completed = eliminateFourPlayerMatchSeat(completed, "p2");
completed = eliminateFourPlayerMatchSeat(completed, "p3");
completed = eliminateFourPlayerMatchSeat(completed, "p4");
const terminal = advanceFourPlayerPhase(completed);
assert.equal(terminal.match, completed);
assert.equal(terminal.match.phase, "beginning");
assert.equal(terminal.turnAdvanced, false);

console.log("FOUR PLAYER PHASE MACHINE: PASS");
