import assert from "node:assert/strict";
import { assertPriorityHolder, processAuthoritativeFourPlayerCommand } from "./four-player-authority";
import { createFourPlayerBroadcasts } from "./four-player-broadcast";
import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";
import { createFourPlayerMatchState } from "./four-player-match";
import type { FourPlayerPrivateSeatState } from "./four-player-projection";
import { createFourPlayerProtocolState, type FourPlayerClientCommand } from "./four-player-protocol";
import { bindFourPlayerSession, createFourPlayerSessionRegistry, disconnectFourPlayerSession, sessionForSeat } from "./four-player-session";

const matchId = "harness-4p-001";
let sessions = createFourPlayerSessionRegistry();
for (const seat of FOUR_PLAYER_SEATS) sessions = bindFourPlayerSession(sessions, `session-${seat}`, seat);

let authority = {
  match: createFourPlayerMatchState("p1"),
  protocol: createFourPlayerProtocolState(matchId),
  sessions,
};

const privateStates = FOUR_PLAYER_SEATS.reduce<Record<FourPlayerSeat, FourPlayerPrivateSeatState>>((result, seat) => {
  result[seat] = {
    seat,
    hand: [`${seat}-hand-secret`],
    deck: [`${seat}-future-deck-secret`],
    graveyard: [],
    publicBoard: [`${seat}-public-unit`],
    nexusHealth: 30,
    eliminated: false,
  };
  return result;
}, {} as Record<FourPlayerSeat, FourPlayerPrivateSeatState>);

function command(seat: FourPlayerSeat, type: FourPlayerClientCommand["type"], payload: unknown = {}): FourPlayerClientCommand {
  return { commandId: `cmd-${authority.protocol.revision + 1}-${seat}-${type}`, matchId, seat, expectedRevision: authority.protocol.revision, type, payload };
}

function dispatch(seat: FourPlayerSeat, type: FourPlayerClientCommand["type"], payload: unknown = {}) {
  const session = sessionForSeat(authority.sessions, seat);
  assert.ok(session);
  const accepted = processAuthoritativeFourPlayerCommand(authority, session.sessionId, session.connectionEpoch, command(seat, type, payload), (match, cmd) => {
    if (cmd.type === "pass_priority" || cmd.type === "submit_action") assertPriorityHolder(match, cmd.seat);
  });
  authority = accepted.state;
  return accepted;
}

function certifyBroadcasts(): void {
  const broadcasts = createFourPlayerBroadcasts(matchId, authority.protocol.revision, privateStates, authority.match);
  for (const viewer of FOUR_PLAYER_SEATS) {
    const envelope = broadcasts[viewer];
    assert.equal(envelope.revision, authority.protocol.revision);
    assert.equal(envelope.projection.match?.phase, authority.match.phase);
    assert.equal(envelope.projection.match?.priorityHolder, authority.match.resolution.priority.holder);
    assert.equal(envelope.projection.match?.status, authority.match.status);
    assert.deepEqual(envelope.projection.seats[viewer].hand, privateStates[viewer].hand);
    const serialized = JSON.stringify(envelope);
    for (const seat of FOUR_PLAYER_SEATS) assert.equal(serialized.includes(`${seat}-future-deck-secret`), false);
    for (const opponent of FOUR_PLAYER_SEATS.filter((seat) => seat !== viewer)) {
      assert.equal(serialized.includes(`${opponent}-hand-secret`), false);
    }
  }
}

// Four independent clients participate in one authoritative revision stream.
dispatch("p1", "submit_action", { id: "p1-spell", controller: "p1", kind: "spell", payload: {} });
assert.equal(authority.protocol.revision, 1);
assert.equal(authority.match.resolution.priority.holder, "p2");
certifyBroadcasts();

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
certifyBroadcasts();

// P2 disconnects while the match remains live. Its seat stays reserved and stale epoch cannot act.
const p2BeforeDisconnect = sessionForSeat(authority.sessions, "p2");
assert.ok(p2BeforeDisconnect);
authority = { ...authority, sessions: disconnectFourPlayerSession(authority.sessions, p2BeforeDisconnect.sessionId) };
assert.throws(() => dispatch("p2", "pass_priority"), /does not control seat p2/);
authority = { ...authority, sessions: bindFourPlayerSession(authority.sessions, p2BeforeDisconnect.sessionId, "p2") };
const p2Reconnected = sessionForSeat(authority.sessions, "p2");
assert.equal(p2Reconnected?.connectionEpoch, p2BeforeDisconnect.connectionEpoch + 1);
assert.throws(() => processAuthoritativeFourPlayerCommand(
  authority,
  p2BeforeDisconnect.sessionId,
  p2BeforeDisconnect.connectionEpoch,
  command("p2", "pass_priority"),
  () => undefined,
), /Stale connection epoch/);
certifyBroadcasts();

// Resolution is atomic: no client interleaves before the authoritative pump settles the top object.
dispatch("p1", "pass_priority");
dispatch("p2", "pass_priority");
dispatch("p3", "pass_priority");
const openerResolution = dispatch("p4", "pass_priority");
assert.deepEqual(openerResolution.pump?.resolved.map((item) => item.id), ["p1-spell"]);
assert.equal(authority.match.resolution.stack.items.length, 0);
assert.equal(authority.match.resolution.priority.holder, "p1");
certifyBroadcasts();

// With the stack settled, P3 concedes. Its seat is removed from future rotation and broadcast publicly.
dispatch("p3", "concede");
privateStates.p3 = { ...privateStates.p3, eliminated: true };
assert.equal(authority.match.seats.p3.eliminated, true);
assert.notEqual(authority.match.resolution.priority.holder, "p3");
certifyBroadcasts();

// Active P1 ends the turn; eliminated P3 is skipped after P2.
dispatch("p1", "end_turn");
assert.equal(authority.match.turn.activeSeat, "p2");
dispatch("p2", "end_turn");
assert.equal(authority.match.turn.activeSeat, "p4");
certifyBroadcasts();

// P4 and P2 concede; P1 is the deterministic last living player and all clients see terminal state.
dispatch("p4", "concede");
privateStates.p4 = { ...privateStates.p4, eliminated: true };
dispatch("p2", "concede");
privateStates.p2 = { ...privateStates.p2, eliminated: true };
assert.equal(authority.match.winner, "p1");
assert.equal(authority.match.status, "completed");
assert.equal(authority.protocol.revision, 16);
const terminalBroadcasts = createFourPlayerBroadcasts(matchId, authority.protocol.revision, privateStates, authority.match);
for (const viewer of FOUR_PLAYER_SEATS) {
  assert.equal(terminalBroadcasts[viewer].projection.match?.status, "completed");
  assert.equal(terminalBroadcasts[viewer].projection.match?.winner, "p1");
}
certifyBroadcasts();

console.log("FOUR PLAYER FOUR-CLIENT BROADCAST, RECONNECT, ELIMINATION AND ATOMIC AUTHORITY HARNESS: PASS");
