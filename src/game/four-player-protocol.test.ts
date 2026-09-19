import assert from "node:assert/strict";
import {
  acceptFourPlayerCommand,
  createFourPlayerProtocolState,
  validateFourPlayerCommand,
  type FourPlayerClientCommand,
} from "./four-player-protocol";

let protocol = createFourPlayerProtocolState("match-4p-1");
const first: FourPlayerClientCommand = {
  commandId: "cmd-1",
  matchId: "match-4p-1",
  seat: "p1",
  expectedRevision: 0,
  type: "pass_priority",
  payload: {},
};

let accepted = acceptFourPlayerCommand(protocol, first);
protocol = accepted.state;
assert.equal(protocol.revision, 1);
assert.equal(accepted.event.eventId, "match-4p-1:1");
assert.equal(accepted.event.actor, "p1");

assert.deepEqual(validateFourPlayerCommand(protocol, first), {
  ok: false,
  code: "duplicate_command",
  message: "Command was already processed.",
});

const stale: FourPlayerClientCommand = {
  commandId: "cmd-2",
  matchId: "match-4p-1",
  seat: "p2",
  expectedRevision: 0,
  type: "submit_action",
  payload: {},
};
assert.equal(validateFourPlayerCommand(protocol, stale).ok, false);
assert.throws(() => acceptFourPlayerCommand(protocol, stale), /stale_revision/);

const wrongMatch: FourPlayerClientCommand = {
  ...stale,
  commandId: "cmd-3",
  matchId: "other-match",
  expectedRevision: 1,
};
assert.throws(() => acceptFourPlayerCommand(protocol, wrongMatch), /wrong_match/);

const second: FourPlayerClientCommand = {
  commandId: "cmd-4",
  matchId: "match-4p-1",
  seat: "p2",
  expectedRevision: 1,
  type: "submit_action",
  payload: { cardId: "card-a" },
};
accepted = acceptFourPlayerCommand(protocol, second);
assert.equal(accepted.state.revision, 2);
assert.equal(accepted.event.revision, 2);
assert.deepEqual(accepted.event.payload, { cardId: "card-a" });

console.log("FOUR PLAYER AUTHORITATIVE PROTOCOL: PASS");
