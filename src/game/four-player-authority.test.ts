import assert from "node:assert/strict";
import { acceptAuthoritativeFourPlayerCommand, assertPriorityHolder, processAuthoritativeFourPlayerCommand } from "./four-player-authority";
import { createFourPlayerMatchState, eliminateFourPlayerMatchSeat } from "./four-player-match";
import { createFourPlayerProtocolState, type FourPlayerClientCommand } from "./four-player-protocol";
import { bindFourPlayerSession, createFourPlayerSessionRegistry, disconnectFourPlayerSession } from "./four-player-session";

let sessions = createFourPlayerSessionRegistry();
sessions = bindFourPlayerSession(sessions, "session-p1", "p1");
sessions = bindFourPlayerSession(sessions, "session-p2", "p2");
let authority = {
  match: createFourPlayerMatchState("p1"),
  protocol: createFourPlayerProtocolState("match-authority"),
  sessions,
};

const p1Pass: FourPlayerClientCommand = {
  commandId: "cmd-p1-pass",
  matchId: "match-authority",
  seat: "p1",
  expectedRevision: 0,
  type: "pass_priority",
  payload: {},
};

const accepted = acceptAuthoritativeFourPlayerCommand(authority, "session-p1", p1Pass, (match, command) => {
  assertPriorityHolder(match, command.seat);
});
authority = accepted.state;
assert.equal(authority.protocol.revision, 1);
assert.equal(accepted.event.actor, "p1");

// A connected P2 session cannot impersonate P1.
assert.throws(
  () => acceptAuthoritativeFourPlayerCommand(authority, "session-p2", { ...p1Pass, commandId: "impersonate", expectedRevision: 1 }, () => {}),
  /does not control seat p1/,
);

// Rule rejection happens before revision advancement.
const illegalP2: FourPlayerClientCommand = {
  commandId: "illegal-p2",
  matchId: "match-authority",
  seat: "p2",
  expectedRevision: 1,
  type: "submit_action",
  payload: {},
};
assert.throws(
  () => acceptAuthoritativeFourPlayerCommand(authority, "session-p2", illegalP2, (match, command) => assertPriorityHolder(match, command.seat)),
  /does not hold priority/,
);
assert.equal(authority.protocol.revision, 1);

// Eliminated players cannot continue issuing gameplay commands, including repeated concede.
authority = { ...authority, match: eliminateFourPlayerMatchSeat(authority.match, "p2") };
assert.throws(
  () => acceptAuthoritativeFourPlayerCommand(authority, "session-p2", illegalP2, () => {}),
  /Eliminated seat p2/,
);
assert.throws(
  () => acceptAuthoritativeFourPlayerCommand(authority, "session-p2", { ...illegalP2, commandId: "repeat-concede", type: "concede" }, () => {}),
  /Eliminated seat p2/,
);

// Atomic authority applies the canonical event and revision together.
let atomicSessions = createFourPlayerSessionRegistry();
atomicSessions = bindFourPlayerSession(atomicSessions, "atomic-p1", "p1");
atomicSessions = bindFourPlayerSession(atomicSessions, "atomic-p2", "p2");
let atomic = {
  match: createFourPlayerMatchState("p1"),
  protocol: createFourPlayerProtocolState("match-atomic"),
  sessions: atomicSessions,
};
const atomicPass: FourPlayerClientCommand = {
  commandId: "atomic-pass",
  matchId: "match-atomic",
  seat: "p1",
  expectedRevision: 0,
  type: "pass_priority",
  payload: {},
};
const processed = processAuthoritativeFourPlayerCommand(atomic, "atomic-p1", 1, atomicPass, (match, command) => assertPriorityHolder(match, command.seat));
atomic = processed.state;
assert.equal(atomic.protocol.revision, 1);
assert.equal(atomic.match.resolution.priority.holder, "p2");
assert.equal(atomic.match.resolution.priority.consecutivePasses, 1);

// Reconnect invalidates the old transport epoch before it can mutate protocol or match state.
atomic.sessions = disconnectFourPlayerSession(atomic.sessions, "atomic-p1");
atomic.sessions = bindFourPlayerSession(atomic.sessions, "atomic-p1", "p1");
const beforeStale = atomic;
assert.throws(
  () => processAuthoritativeFourPlayerCommand(atomic, "atomic-p1", 1, { ...atomicPass, commandId: "stale", expectedRevision: 1 }, () => {}),
  /Stale connection epoch 1; current epoch is 2/,
);
assert.equal(atomic.protocol.revision, beforeStale.protocol.revision);
assert.equal(atomic.match, beforeStale.match);

// Once a winner exists, the authority rejects every further command without revision churn.
atomic.match = eliminateFourPlayerMatchSeat(atomic.match, "p2");
atomic.match = eliminateFourPlayerMatchSeat(atomic.match, "p3");
atomic.match = eliminateFourPlayerMatchSeat(atomic.match, "p4");
assert.equal(atomic.match.status, "completed");
assert.equal(atomic.match.winner, "p1");
const terminalRevision = atomic.protocol.revision;
assert.throws(
  () => processAuthoritativeFourPlayerCommand(atomic, "atomic-p1", 2, { ...atomicPass, commandId: "after-win", expectedRevision: terminalRevision }, () => {}),
  /Completed match cannot accept command/,
);
assert.equal(atomic.protocol.revision, terminalRevision);

console.log("FOUR PLAYER AUTHORITATIVE MATCH GATE: PASS");
