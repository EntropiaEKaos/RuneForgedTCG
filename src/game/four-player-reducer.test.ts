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
assert.throws(() => reduceFourPlayerServerEvent(match, event("cast_general", "p1")), /main phase/);
match = { ...match, phase: "main_1" };
match = reduceFourPlayerServerEvent(match, event("cast_general", "p1"));
assert.equal(match.generals.p1.location, "stack");
assert.equal(match.seats.p1.generalCastsFromZone, 1);
assert.equal(match.resolution.stack.items.length, 1);
assert.equal(match.resolution.stack.items[0]?.kind, "general_cast");
assert.equal(match.resolution.stack.items[0]?.controller, "p1");
assert.deepEqual(match.resolution.stack.items[0]?.payload, { owner: "p1", defId: "general-p1" });
assert.equal(match.resolution.priority.holder, "p2");
assert.throws(() => reduceFourPlayerServerEvent(match, event("cast_general", "p1")), /Only priority holder p2/);

let timing: FourPlayerMatchState = { ...createFourPlayerMatchState("p1"), phase: "main_2" };
timing = reduceFourPlayerServerEvent(timing, event("submit_action", "p1", { id: "occupied-stack", controller: "p1", kind: "spell", payload: {} }));
// Even if priority cycles back later, a General cannot be inserted over a non-empty stack.
timing = { ...timing, resolution: { ...timing.resolution, priority: { ...timing.resolution.priority, holder: "p1", consecutivePasses: 0 } } };
assert.throws(() => reduceFourPlayerServerEvent(timing, event("cast_general", "p1")), /stack is empty/);


// General payment is authoritative, atomic, and ignores forged client cost/mana payloads.
const printedCosts = { p1: 5, p2: 4, p3: 3, p4: 2 } as const;
let paid: FourPlayerMatchState = { ...createFourPlayerMatchState("p1", undefined, 10, printedCosts), phase: "main_1" };
paid = reduceFourPlayerServerEvent(paid, event("cast_general", "p1", { cost: 0, mana: 999 }));
assert.equal(paid.seats.p1.mana, 5);
assert.equal(paid.generals.p1.castsFromGeneralZone, 1);

const poorBase = createFourPlayerMatchState("p1", undefined, 4, printedCosts);
const poor: FourPlayerMatchState = {
  ...poorBase,
  phase: "main_1",
  seats: { ...poorBase.seats, p1: { ...poorBase.seats.p1, mana: 4, maxMana: 4 } },
};
assert.throws(() => reduceFourPlayerServerEvent(poor, event("cast_general", "p1", { cost: 0, mana: 999 })), /requires 5, has 4/);
assert.equal(poor.seats.p1.mana, 4);
assert.equal(poor.generals.p1.location, "general_zone");
assert.equal(poor.generals.p1.castsFromGeneralZone, 0);
assert.equal(poor.resolution.stack.items.length, 0);

// A returned General pays +2 for each previous cast from the General Zone.
let recast: FourPlayerMatchState = { ...createFourPlayerMatchState("p1", undefined, 12, printedCosts), phase: "main_1" };
recast = {
  ...recast,
  generals: { ...recast.generals, p1: { ...recast.generals.p1, castsFromGeneralZone: 1 } },
  seats: { ...recast.seats, p1: { ...recast.seats.p1, generalCastsFromZone: 1 } },
};
recast = reduceFourPlayerServerEvent(recast, event("cast_general", "p1"));
assert.equal(recast.seats.p1.mana, 3); // first-turn grant caps 12 at 10; printed 5 + recast tax 2 leaves 3
assert.equal(recast.generals.p1.castsFromGeneralZone, 2);

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

console.log("FOUR PLAYER AUTHORITATIVE EVENT REDUCER + GENERAL STACK HARDENING: PASS");
