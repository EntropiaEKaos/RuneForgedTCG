import assert from "node:assert/strict";
import { eliminateFourPlayerMatchSeat, createFourPlayerMatchState } from "./four-player-match";
import { advanceFourPlayerPhase, createFourPlayerPhaseState } from "./four-player-phase-machine";

let match = createFourPlayerMatchState("p1");
let phase = createFourPlayerPhaseState();

for (const expected of ["main_1", "combat", "main_2", "ending"] as const) {
  const advanced = advanceFourPlayerPhase(match, phase);
  match = advanced.match;
  phase = advanced.phase;
  assert.equal(phase.phase, expected);
  assert.equal(advanced.turnAdvanced, false);
  assert.equal(match.turn.activeSeat, "p1");
  assert.equal(match.resolution.priority.holder, "p1");
  assert.equal(match.resolution.priority.consecutivePasses, 0);
}

const nextTurn = advanceFourPlayerPhase(match, phase);
assert.equal(nextTurn.turnAdvanced, true);
assert.equal(nextTurn.match.turn.activeSeat, "p2");
assert.equal(nextTurn.match.turn.turn, 2);
assert.equal(nextTurn.phase.phase, "beginning");
assert.equal(nextTurn.match.resolution.priority.holder, "p2");

// Eliminated seats are skipped by the canonical turn manager.
let skip = createFourPlayerMatchState("p1");
skip = eliminateFourPlayerMatchSeat(skip, "p2");
const skipped = advanceFourPlayerPhase(skip, { phase: "ending" });
assert.equal(skipped.match.turn.activeSeat, "p3");
assert.equal(skipped.phase.phase, "beginning");

// Completed matches are terminal.
let completed = createFourPlayerMatchState("p1");
completed = eliminateFourPlayerMatchSeat(completed, "p2");
completed = eliminateFourPlayerMatchSeat(completed, "p3");
completed = eliminateFourPlayerMatchSeat(completed, "p4");
const terminal = advanceFourPlayerPhase(completed, { phase: "ending" });
assert.equal(terminal.match, completed);
assert.equal(terminal.phase.phase, "ending");
assert.equal(terminal.turnAdvanced, false);

console.log("FOUR PLAYER PHASE MACHINE: PASS");
