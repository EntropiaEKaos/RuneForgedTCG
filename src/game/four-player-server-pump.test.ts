import assert from "node:assert/strict";
import { passFourPlayerFlow, submitFourPlayerAction } from "./four-player-flow";
import { createFourPlayerMatchState } from "./four-player-match";
import { pumpFourPlayerServer } from "./four-player-server-pump";

let match = createFourPlayerMatchState("p1");
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

match = { ...match, resolution: passFourPlayerFlow(match.resolution) }; // p1
pumped = pumpFourPlayerServer(match);
assert.equal(pumped.resolved.length, 1);
assert.equal(pumped.resolved[0]?.id, "p1-opener");
assert.equal(pumped.match.resolution.stack.items.length, 0);
assert.equal(pumped.match.resolution.priority.consecutivePasses, 0);
assert.equal(pumped.match.resolution.priority.holder, "p1");

// An empty-stack all-pass cycle is not silently converted into a turn skip.
let empty = createFourPlayerMatchState("p1");
empty = { ...empty, resolution: passFourPlayerFlow(empty.resolution) };
empty = { ...empty, resolution: passFourPlayerFlow(empty.resolution) };
empty = { ...empty, resolution: passFourPlayerFlow(empty.resolution) };
empty = { ...empty, resolution: passFourPlayerFlow(empty.resolution) };
const emptyPump = pumpFourPlayerServer(empty);
assert.equal(emptyPump.resolved.length, 0);
assert.equal(emptyPump.match.turn.activeSeat, "p1");
assert.equal(emptyPump.awaitingClientInput, false);

console.log("FOUR PLAYER SERVER STACK PUMP: PASS");
