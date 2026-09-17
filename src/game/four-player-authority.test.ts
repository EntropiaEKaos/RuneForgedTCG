import assert from "node:assert/strict";
import { acceptAuthoritativeFourPlayerCommand, assertPriorityHolder } from "./four-player-authority";
import { createFourPlayerMatchState, eliminateFourPlayerMatchSeat } from "./four-player-match";
import { createFourPlayerProtocolState, type FourPlayerClientCommand } from "./four-player-protocol";
import { bindFourPlayerSession, createFourPlayerSessionRegistry } from "./four-player-session";

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

// Eliminated players cannot continue issuing gameplay commands.
authority = { ...authority, match: eliminateFourPlayerMatchSeat(authority.match, "p2") };
assert.throws(
  () => acceptAuthoritativeFourPlayerCommand(authority, "session-p2", illegalP2, () => {}),
  /Eliminated seat p2/,
);

console.log("FOUR PLAYER AUTHORITATIVE MATCH GATE: PASS");
