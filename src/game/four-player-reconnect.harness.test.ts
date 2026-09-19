import assert from "node:assert/strict";
import { assertSessionControlsSeat } from "./four-player-session";
import { bindFourPlayerSession, createFourPlayerSessionRegistry, disconnectFourPlayerSession, sessionForSeat } from "./four-player-session";
import { createFourPlayerProtocolState } from "./four-player-protocol";
import { decideFourPlayerResync, createFourPlayerResyncSnapshot } from "./four-player-resync";
import { projectFourPlayerStateForSeat, type FourPlayerPrivateSeatState } from "./four-player-projection";
import { createFourPlayerMatchState } from "./four-player-match";
import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";

const matchId = "reconnect-4p-001";
let sessions = createFourPlayerSessionRegistry();
for (const seat of FOUR_PLAYER_SEATS) sessions = bindFourPlayerSession(sessions, `session-${seat}`, seat);
let protocol = createFourPlayerProtocolState(matchId);
protocol = { ...protocol, revision: 17 };

// P2 loses transport at revision 17. The seat stays reserved and cannot issue commands.
sessions = disconnectFourPlayerSession(sessions, "session-p2");
assert.throws(() => assertSessionControlsSeat(sessions, "session-p2", "p2", 1), /does not control seat p2/);
assert.throws(() => bindFourPlayerSession(sessions, "attacker-session", "p2"), /reserved by another session/);

// The authoritative match advances while P2 is offline.
protocol = { ...protocol, revision: 21 };
assert.deepEqual(decideFourPlayerResync(matchId, protocol.revision, { matchId, revision: 17 }), { type: "snapshot_required", reason: "behind" });

// Same logical session reconnects. Epoch changes so the old socket can never become authoritative again.
sessions = bindFourPlayerSession(sessions, "session-p2", "p2");
assert.equal(sessionForSeat(sessions, "p2")?.connectionEpoch, 2);
assert.throws(() => assertSessionControlsSeat(sessions, "session-p2", "p2", 1), /Stale connection epoch/);
assertSessionControlsSeat(sessions, "session-p2", "p2", 2);

const privateStates = FOUR_PLAYER_SEATS.reduce<Record<FourPlayerSeat, FourPlayerPrivateSeatState>>((result, seat) => {
  result[seat] = {
    seat,
    hand: [`${seat}-hand-secret`],
    deck: [`${seat}-deck-future-secret`],
    graveyard: [],
    publicBoard: [`${seat}-public-unit`],
    nexusHealth: 30,
    eliminated: false,
  };
  return result;
}, {} as Record<FourPlayerSeat, FourPlayerPrivateSeatState>);

// Reconnect snapshots include public authoritative flow so the client cannot guess phase/priority.
const match = { ...createFourPlayerMatchState("p3"), phase: "main_2" as const };
const projection = projectFourPlayerStateForSeat(privateStates, "p2", match);
const snapshot = createFourPlayerResyncSnapshot(matchId, protocol.revision, projection);
assert.equal(snapshot.revision, 21);
assert.equal(snapshot.viewer, "p2");
assert.deepEqual(snapshot.projection.seats.p2.hand, ["p2-hand-secret"]);
assert.deepEqual(snapshot.projection.match, {
  activeSeat: "p3",
  round: 1,
  phase: "main_2",
  priorityHolder: "p3",
  status: "active",
});
const serialized = JSON.stringify(snapshot);
for (const seat of FOUR_PLAYER_SEATS) assert.equal(serialized.includes(`${seat}-deck-future-secret`), false);
for (const opponent of FOUR_PLAYER_SEATS.filter((seat) => seat !== "p2")) assert.equal(serialized.includes(`${opponent}-hand-secret`), false);
assert.deepEqual(decideFourPlayerResync(matchId, 21, { matchId, revision: 21 }), { type: "current" });

console.log("FOUR PLAYER RECONNECT, AUTHORITATIVE PHASE AND SAFE RESYNC HARNESS: PASS");
