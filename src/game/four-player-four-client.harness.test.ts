import assert from "node:assert/strict";
import { assertPriorityHolder, processAuthoritativeFourPlayerCommand } from "./four-player-authority";
import { createFourPlayerMatchState } from "./four-player-match";
import { createFourPlayerProtocolState, type FourPlayerClientCommand } from "./four-player-protocol";
import { bindFourPlayerSession, createFourPlayerSessionRegistry, sessionForSeat } from "./four-player-session";

const matchId = "harness-4p-001";
let sessions = createFourPlayerSessionRegistry();
for (const seat of ["p1", "p2", "p3", "p4"] as const) sessions = bindFourPlayerSession(sessions, `session-${seat}`, seat);

let authority = {
  match: createFourPlayerMatchState("p1"),
  protocol: createFourPlayerProtocolState(matchId),
  sessions,
};

function command(seat: "p1" | "p2" | "p3" | "p4", type: FourPlayerClientCommand["type"], payload: unknown = {}): FourPlayerClientCommand {
  return { commandId: `cmd-${authority.protocol.revision + 1}-${seat}-${type}`, matchId, seat, expectedRevision: authority.protocol.revision, type, payload };
}

function dispatch(seat: "p1" | "p2" | "p3" | "p4", type: FourPlayerClientCommand["type"], payload: unknown = {}) {
  const session = sessionForSeat(authority.sessions, seat);
  assert.ok(session);
  const accepted = processAuthoritativeFourPlayerCommand(authority, session.sessionId, session.connectionEpoch, command(seat, type, payload), (match, cmd) => {
    if (cmd.type === "pass_priority" || cmd.type === "submit_action") assertPriorityHolder(match, cmd.seat);
  });
  authority = accepted.state;
  return accepted;
}

// Four independent clients participate in one authoritative revision stream.
dispatch("p1", "submit_action", { id: "p1-spell", controller: "p1", kind: "spell", payload: {} });
assert.equal(authority.protocol.revision, 1);
assert.equal(authority.match.resolution.priority.holder, "p2");

dispatch("p2", "pass_priority");
dispatch("p3", "submit_action", { id: "p3-response", controller: "p3", kind: "response", payload: {} });
dispatch("p4", "pass_priority");
dispatch("p1", "pass_priority");
dispatch("p2", "pass_priority");
const responseResolution = dispatch("p3", "pass_priority");
assert.deepEqual(responseResolution.pump?.resolved.map((item) => item.id), ["p3-response"]);
assert.deepEqual(authority.match.resolution.stack.items.map((item) => item.id), ["p1-spell"]);
assert.equal(authority.match.resolution.priority.consecutivePasses, 0);
assert.equal(authority.match.resolution.priority.holder, "p1");

// Resolution is atomic: after the completed pass cycle no client can interleave
// before P3's response has already left the authoritative stack.
dispatch("p1", "pass_priority");
dispatch("p2", "pass_priority");
dispatch("p3", "pass_priority");
const openerResolution = dispatch("p4", "pass_priority");
assert.deepEqual(openerResolution.pump?.resolved.map((item) => item.id), ["p1-spell"]);
assert.equal(authority.match.resolution.stack.items.length, 0);
assert.equal(authority.match.resolution.priority.holder, "p1");

// With the stack settled, P3 may concede. Its seat is removed from future rotation.
dispatch("p3", "concede");
assert.equal(authority.match.seats.p3.eliminated, true);
assert.notEqual(authority.match.resolution.priority.holder, "p3");

// Active P1 ends the turn; eliminated P3 will be skipped after P2.
dispatch("p1", "end_turn");
assert.equal(authority.match.turn.activeSeat, "p2");
dispatch("p2", "end_turn");
assert.equal(authority.match.turn.activeSeat, "p4");

// P4 and P2 concede; P1 is the deterministic last living player.
dispatch("p4", "concede");
dispatch("p2", "concede");
assert.equal(authority.match.winner, "p1");
assert.equal(authority.match.status, "completed");
assert.equal(authority.protocol.revision, 16);

console.log("FOUR PLAYER FOUR-CLIENT ATOMIC AUTHORITY HARNESS: PASS");
