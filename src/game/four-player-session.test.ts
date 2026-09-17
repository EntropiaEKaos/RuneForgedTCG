import assert from "node:assert/strict";
import {
  assertSessionControlsSeat,
  bindFourPlayerSession,
  createFourPlayerSessionRegistry,
  disconnectFourPlayerSession,
  sessionForSeat,
} from "./four-player-session";

let registry = createFourPlayerSessionRegistry();
registry = bindFourPlayerSession(registry, "session-p2", "p2");
assert.equal(sessionForSeat(registry, "p2")?.connectionEpoch, 1);
assertSessionControlsSeat(registry, "session-p2", "p2", 1);

registry = disconnectFourPlayerSession(registry, "session-p2");
assert.throws(() => assertSessionControlsSeat(registry, "session-p2", "p2"), /does not control seat p2/);
assert.throws(() => bindFourPlayerSession(registry, "hijacker", "p2"), /reserved by another session/);

registry = bindFourPlayerSession(registry, "session-p2", "p2");
assert.equal(sessionForSeat(registry, "p2")?.connected, true);
assert.equal(sessionForSeat(registry, "p2")?.connectionEpoch, 2);
assert.throws(() => assertSessionControlsSeat(registry, "session-p2", "p2", 1), /Stale connection epoch 1/);
assertSessionControlsSeat(registry, "session-p2", "p2", 2);
assert.throws(() => bindFourPlayerSession(registry, "session-p2", "p3"), /already bound to p2/);

console.log("FOUR PLAYER SESSION RECONNECT SECURITY: PASS");
