import assert from "node:assert/strict";
import { createFourPlayerBroadcasts } from "./four-player-broadcast";
import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";
import { createFourPlayerMatchState } from "./four-player-match";
import type { FourPlayerPrivateSeatState } from "./four-player-projection";

const privateStates = FOUR_PLAYER_SEATS.reduce<Record<FourPlayerSeat, FourPlayerPrivateSeatState>>((result, seat, index) => {
  result[seat] = {
    seat,
    hand: [`${seat}-hand-secret-a`, `${seat}-hand-secret-b`],
    deck: [`${seat}-future-deck-a`, `${seat}-future-deck-b`],
    graveyard: [`${seat}-grave-public`],
    publicBoard: [`${seat}-board-public`],
    nexusHealth: 30 - index,
    eliminated: false,
  };
  return result;
}, {} as Record<FourPlayerSeat, FourPlayerPrivateSeatState>);

const match = { ...createFourPlayerMatchState("p2"), phase: "combat" as const };
const broadcasts = createFourPlayerBroadcasts("broadcast-4p-001", 42, privateStates, match);

for (const viewer of FOUR_PLAYER_SEATS) {
  const envelope = broadcasts[viewer];
  assert.equal(envelope.seat, viewer);
  assert.equal(envelope.matchId, "broadcast-4p-001");
  assert.equal(envelope.revision, 42);
  assert.equal(envelope.projection.viewer, viewer);
  assert.deepEqual(envelope.projection.seats[viewer].hand, privateStates[viewer].hand);
  assert.deepEqual(envelope.projection.match, {
    activeSeat: "p2",
    round: 1,
    phase: "combat",
    priorityHolder: "p2",
    status: "active",
  });

  const serialized = JSON.stringify(envelope);
  for (const seat of FOUR_PLAYER_SEATS) {
    assert.equal(serialized.includes(`${seat}-future-deck-a`), false, `${viewer} must never receive ${seat} future deck identity`);
  }
  for (const opponent of FOUR_PLAYER_SEATS.filter((seat) => seat !== viewer)) {
    assert.equal(envelope.projection.seats[opponent].hand, undefined);
    assert.equal(serialized.includes(`${opponent}-hand-secret-a`), false, `${viewer} must not receive ${opponent} hand identity`);
  }
}

// Four envelopes are independent objects: mutating transport metadata cannot cross-contaminate another seat.
assert.notEqual(broadcasts.p1, broadcasts.p2);
assert.notEqual(broadcasts.p1.projection, broadcasts.p2.projection);
assert.throws(() => createFourPlayerBroadcasts("broadcast-4p-001", -1, privateStates, match), /Revision cannot be negative/);

console.log("FOUR PLAYER SEAT-SPECIFIC AUTHORITATIVE BROADCAST: PASS");
