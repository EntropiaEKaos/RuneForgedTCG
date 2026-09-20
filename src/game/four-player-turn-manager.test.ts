import assert from "node:assert/strict";
import {
  advanceFourPlayerTurn,
  createFourPlayerTurnState,
  eliminateSeat,
  nextLivingSeat,
} from "./four-player-turn-manager";

let state = createFourPlayerTurnState();
assert.deepEqual([state.activeSeat, state.round, state.turn], ["p1", 1, 1]);

state = advanceFourPlayerTurn(state);
assert.deepEqual([state.activeSeat, state.round, state.turn], ["p2", 1, 2]);
state = advanceFourPlayerTurn(state);
assert.equal(state.activeSeat, "p3");
state = advanceFourPlayerTurn(state);
assert.equal(state.activeSeat, "p4");
state = advanceFourPlayerTurn(state);
assert.deepEqual([state.activeSeat, state.round, state.turn], ["p1", 2, 5]);

state = eliminateSeat(state, "p2");
assert.equal(nextLivingSeat("p1", state.eliminatedSeats), "p3");
state = advanceFourPlayerTurn(state);
assert.equal(state.activeSeat, "p3", "eliminated p2 must be skipped");

state = eliminateSeat(state, "p4");
state = advanceFourPlayerTurn(state);
assert.equal(state.activeSeat, "p1", "eliminated p4 must be skipped on wrap");
assert.equal(state.round, 3);

const onlyP1 = ["p2", "p3", "p4"] as const;
assert.equal(nextLivingSeat("p1", onlyP1), "p1", "last living seat remains active");

console.log("FOUR PLAYER TURN MANAGER: PASS");
