import assert from "node:assert/strict";
import { passFourPlayerFlow, submitFourPlayerAction } from "./four-player-flow";
import { createFourPlayerMatchState, eliminateFourPlayerMatchSeat, type FourPlayerMatchState } from "./four-player-match";
import type { FourPlayerServerEvent } from "./four-player-protocol";
import { reduceFourPlayerServerEvent } from "./four-player-reducer";
import { pumpFourPlayerServer } from "./four-player-server-pump";

function passAllLiving(match: FourPlayerMatchState): FourPlayerMatchState {
  let next = match;
  const livingCount = 4 - next.turn.eliminatedSeats.length;
  for (let index = 0; index < livingCount; index += 1) {
    next = { ...next, resolution: passFourPlayerFlow(next.resolution) };
  }
  return next;
}

let match: FourPlayerMatchState = createFourPlayerMatchState("p1");
match = {
  ...match,
  resolution: submitFourPlayerAction(match.resolution, {
    id: "p1-opener",
    controller: "p1",
    kind: "spell",
    payload: {},
  }),
};
assert.equal(match.resolution.priority.holder, "p2");

// Until every living player passes, the server must not resolve the stack.
match = { ...match, resolution: passFourPlayerFlow(match.resolution) }; // p2
match = { ...match, resolution: passFourPlayerFlow(match.resolution) }; // p3
match = { ...match, resolution: passFourPlayerFlow(match.resolution) }; // p4
let pumped = pumpFourPlayerServer(match);
assert.equal(pumped.resolved.length, 0);
assert.equal(pumped.match.resolution.stack.items.length, 1);
assert.equal(pumped.awaitingClientInput, true);
assert.equal(pumped.phaseAdvanced, false);

match = { ...match, resolution: passFourPlayerFlow(match.resolution) }; // p1
pumped = pumpFourPlayerServer(match);
assert.equal(pumped.resolved.length, 1);
assert.equal(pumped.resolved[0]?.id, "p1-opener");
assert.equal(pumped.match.resolution.stack.items.length, 0);
assert.equal(pumped.match.resolution.priority.consecutivePasses, 0);
assert.equal(pumped.match.resolution.priority.holder, "p1");
assert.equal(pumped.match.phase, "beginning");
assert.equal(pumped.phaseAdvanced, false);

// A General cast is a real authoritative stack object and resolves to battlefield only after all living players pass.
const castEvent: FourPlayerServerEvent = {
  eventId: "e-general-cast",
  commandId: "c-general-cast",
  matchId: "m",
  revision: 1,
  actor: "p1",
  type: "cast_general",
  payload: {},
};
let generalMatch: FourPlayerMatchState = { ...createFourPlayerMatchState("p1"), phase: "main_1" };
generalMatch = reduceFourPlayerServerEvent(generalMatch, castEvent);
assert.equal(generalMatch.generals.p1.location, "stack");
assert.equal(generalMatch.resolution.stack.items[0]?.kind, "general_cast");
generalMatch = passAllLiving(generalMatch);
const generalPump = pumpFourPlayerServer(generalMatch);
assert.equal(generalPump.resolved[0]?.kind, "general_cast");
assert.equal(generalPump.match.generals.p1.location, "battlefield");
assert.equal(generalPump.match.generals.p1.castsFromGeneralZone, 1);
assert.equal(generalPump.match.seats.p1.generalCastsFromZone, 1);
const physicalGeneral = generalPump.match.battlefield?.objects.find((object) => object.kind === "general" && object.ownerSeat === "p1");
assert.equal(physicalGeneral?.defId, "general-p1");
assert.equal(physicalGeneral?.controllerSeat, "p1");
assert.equal(physicalGeneral?.zone, "battlefield");
assert.equal(generalPump.match.resolution.stack.items.length, 0);
assert.equal(generalPump.match.resolution.priority.holder, "p1");

// Empty-stack all-pass advances exactly one phase and reopens priority.
let empty: FourPlayerMatchState = passAllLiving(createFourPlayerMatchState("p1"));
const emptyPump = pumpFourPlayerServer(empty);
assert.equal(emptyPump.resolved.length, 0);
assert.equal(emptyPump.match.turn.activeSeat, "p1");
assert.equal(emptyPump.match.phase, "main_1");
assert.equal(emptyPump.match.resolution.priority.holder, "p1");
assert.equal(emptyPump.match.resolution.priority.consecutivePasses, 0);
assert.equal(emptyPump.phaseAdvanced, true);
assert.equal(emptyPump.turnAdvanced, false);
assert.equal(emptyPump.awaitingClientInput, true);

// Ending all-pass advances to the next living player's beginning.
let ending: FourPlayerMatchState = { ...createFourPlayerMatchState("p1"), phase: "ending" };
ending = eliminateFourPlayerMatchSeat(ending, "p2");
ending = passAllLiving(ending);
const endingPump = pumpFourPlayerServer(ending);
assert.equal(endingPump.match.turn.activeSeat, "p3");
assert.equal(endingPump.match.phase, "beginning");
assert.equal(endingPump.match.resolution.priority.holder, "p3");
assert.equal(endingPump.phaseAdvanced, true);
assert.equal(endingPump.turnAdvanced, true);

// Completed matches remain terminal.
let completed: FourPlayerMatchState = createFourPlayerMatchState("p1");
completed = eliminateFourPlayerMatchSeat(completed, "p2");
completed = eliminateFourPlayerMatchSeat(completed, "p3");
completed = eliminateFourPlayerMatchSeat(completed, "p4");
const terminal = pumpFourPlayerServer(completed);
assert.equal(terminal.match, completed);
assert.equal(terminal.phaseAdvanced, false);
assert.equal(terminal.turnAdvanced, false);
assert.equal(terminal.awaitingClientInput, false);

console.log("FOUR PLAYER SERVER STACK/PHASE + GENERAL RESOLUTION PUMP: PASS");
