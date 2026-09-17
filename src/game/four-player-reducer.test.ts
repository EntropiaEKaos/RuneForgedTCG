import assert from "node:assert/strict";
import { eliminateFourPlayerMatchSeat, createFourPlayerMatchState, type FourPlayerMatchState } from "./four-player-match";
import type { FourPlayerServerEvent } from "./four-player-protocol";
import { reduceFourPlayerServerEvent } from "./four-player-reducer";

function event(type: FourPlayerServerEvent["type"], actor: FourPlayerServerEvent["actor"], payload: unknown = {}): FourPlayerServerEvent {
  return { eventId: `e-${type}`, commandId: `c-${type}`, matchId: "m", revision: 1, actor, type, payload };
}

let match: FourPlayerMatchState = createFourPlayerMatchState("p1");
match = reduceFourPlayerServerEvent(match, event("pass_priority", "p1"));
assert.equal(match.resolution.priority.holder, "p2");
assert.throws(() => reduceFourPlayerServerEvent(match, event("pass_priority", "p3")), /Only priority holder p2/);

match = createFourPlayerMatchState("p1");
assert.throws(() => reduceFourPlayerServerEvent(match, event("submit_action", "p2", {
  id: "out-of-priority", controller: "p2", kind: "spell", payload: {},
})), /Only priority holder p1/);
assert.throws(() => reduceFourPlayerServerEvent(match, event("submit_action", "p1", {
  id: "forged-controller", controller: "p3", kind: "spell", payload: {},
})), /does not match actor p1/);
match = reduceFourPlayerServerEvent(match, event("submit_action", "p1", {
  id: "spell-1", controller: "p1", kind: "spell", payload: {},
}));
assert.equal(match.resolution.stack.items.length, 1);
assert.equal(match.resolution.priority.holder, "p2");

match = createFourPlayerMatchState("p1");
match = reduceFourPlayerServerEvent(match, event("declare_attacker", "p1", { unitId: "u1", defendingSeat: "p3" }));
assert.equal(match.combat.attackers[0]?.defendingSeat, "p3");
assert.throws(
  () => reduceFourPlayerServerEvent(match, event("declare_attacker", "p2", { unitId: "u2", defendingSeat: "p4" })),
  /Only active seat p1/,
);

match = createFourPlayerMatchState("p1");
assert.throws(() => reduceFourPlayerServerEvent(match, event("cast_general", "p2")), /Only priority holder p1/);
match = reduceFourPlayerServerEvent(match, event("cast_general", "p1"));
assert.equal(match.generals.p1.location, "stack");
assert.equal(match.seats.p1.generalCastsFromZone, 1);

match = createFourPlayerMatchState("p1");
const stacked = reduceFourPlayerServerEvent(match, event("submit_action", "p1", {
  id: "spell-before-end", controller: "p1", kind: "spell", payload: {},
}));
assert.throws(() => reduceFourPlayerServerEvent(stacked, event("end_turn", "p1")), /stack is not empty/);

const passing = reduceFourPlayerServerEvent(createFourPlayerMatchState("p1"), event("pass_priority", "p1"));
assert.throws(() => reduceFourPlayerServerEvent(passing, event("end_turn", "p1")), /unresolved priority pass cycle/);

match = createFourPlayerMatchState("p1");
match = reduceFourPlayerServerEvent(match, event("end_turn", "p1"));
assert.equal(match.turn.activeSeat, "p2");
assert.throws(() => reduceFourPlayerServerEvent(match, event("end_turn", "p3")), /Only active seat p2/);

match = reduceFourPlayerServerEvent(match, event("concede", "p3"));
assert.equal(match.seats.p3.eliminated, true);

let completed: FourPlayerMatchState = createFourPlayerMatchState("p1");
completed = eliminateFourPlayerMatchSeat(completed, "p2");
completed = eliminateFourPlayerMatchSeat(completed, "p3");
completed = eliminateFourPlayerMatchSeat(completed, "p4");
assert.equal(completed.status, "completed");
assert.throws(() => reduceFourPlayerServerEvent(completed, event("pass_priority", "p1")), /matches are terminal/);
assert.throws(() => reduceFourPlayerServerEvent(completed, event("concede", "p1")), /matches are terminal/);

console.log("FOUR PLAYER AUTHORITATIVE EVENT REDUCER HARDENING: PASS");
