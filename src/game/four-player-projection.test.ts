import assert from "node:assert/strict";
import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";
import { projectFourPlayerStateForSeat, type FourPlayerPrivateSeatState } from "./four-player-projection";

const states = Object.fromEntries(FOUR_PLAYER_SEATS.map((seat, index) => [seat, {
  seat,
  hand: [`${seat}-hand-a`, `${seat}-hand-b`],
  deck: [`${seat}-deck-secret`],
  graveyard: [`${seat}-grave-public`],
  publicBoard: [`${seat}-board-public`],
  nexusHealth: 30 - index,
  eliminated: false,
}])) as Record<FourPlayerSeat, FourPlayerPrivateSeatState>;

for (const viewer of FOUR_PLAYER_SEATS) {
  const projection = projectFourPlayerStateForSeat(states, viewer);
  assert.deepEqual(projection.seats[viewer].hand, states[viewer].hand);
  assert.deepEqual(projection.seats[viewer].deck, states[viewer].deck);

  for (const opponent of FOUR_PLAYER_SEATS.filter((seat) => seat !== viewer)) {
    const projected = projection.seats[opponent];
    assert.equal(projected.hand, undefined, `${viewer} must not receive ${opponent} hand identities`);
    assert.equal(projected.deck, undefined, `${viewer} must not receive ${opponent} deck identities`);
    assert.equal(projected.handCount, 2);
    assert.equal(projected.deckCount, 1);
    assert.deepEqual(projected.graveyard, states[opponent].graveyard);
    assert.deepEqual(projected.publicBoard, states[opponent].publicBoard);
  }
}

console.log("FOUR PLAYER HIDDEN INFORMATION PROJECTION: PASS");
