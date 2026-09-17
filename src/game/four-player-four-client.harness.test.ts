import assert from "node:assert/strict";
import { acceptAuthoritativeFourPlayerCommand, assertPriorityHolder } from "./four-player-authority";
import { createFourPlayerMatchState } from "./four-player-match";
import { createFourPlayerProtocolState, type FourPlayerClientCommand } from "./four-player-protocol";
import { reduceFourPlayerServerEvent } from "./four-player-reducer";
import { bindFourPlayerSession, createFourPlayerSessionRegistry } from "./four-player-session";

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

function dispatch(seat: "p1" | "p2" | "p3" | "p4", type: FourPlayerClientCommand["type"], payload: unknown = {}): void {
  const accepted = acceptAuthoritativeFourPlayerCommand(authority, `session-${seat}`, command(seat, type, payload), (match, cmd) => {
    if (cmd.type === "pass_priority" || cmd.type === "submit_action") assertPriorityHolder(match, cmd.seat);
  });
  authority = { ...accepted.state, match: reduceFourPlayerServerEvent(accepted.state.match, accepted.event) };
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
dispatch("p3", "pass_priority");
assert.equal(authority.match.resolution.stack.items.length, 2);
assert.equal(authority.match.resolution.priority.consecutivePasses, 4);

// P3 concedes while its response is on the stack: only P3's object disappears.
dispatch("p3", "concede");
assert.equal(authority.match.seats.p3.eliminated, true);
assert.deepEqual(authority.match.resolution.stack.items.map((item) => item.id), ["p1-spell"]);
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
assert.equal(authority.protocol.revision, 12);

console.log("FOUR PLAYER FOUR-CLIENT AUTHORITATIVE HARNESS: PASS");
