import assert from "node:assert/strict";
import { putFourPlayerBattlefieldObject } from "./four-player-battlefield";
import type { FourPlayerCardInstance } from "./four-player-card-zones";
import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";
import { applyFourPlayerDamage, createFourPlayerMatchState } from "./four-player-match";
import { projectFourPlayerStateForSeat, type FourPlayerPrivateSeatState } from "./four-player-projection";

function card(seat: FourPlayerSeat, zone: string, index: number): FourPlayerCardInstance {
  return { instanceId: `${seat}:${zone}:${index}`, defId: `${seat}-${zone}-${index}`, ownerSeat: seat };
}

const states = FOUR_PLAYER_SEATS.reduce<Record<FourPlayerSeat, FourPlayerPrivateSeatState>>((result, seat, index) => {
  result[seat] = {
    seat,
    hand: [card(seat, "hand", 1), card(seat, "hand", 2)],
    deck: [card(seat, "deck-secret", 1)],
    graveyard: [card(seat, "grave-public", 1)],
    publicBoard: [`${seat}-board-public`],
    nexusHealth: 30 - index,
    eliminated: false,
  };
  return result;
}, {} as Record<FourPlayerSeat, FourPlayerPrivateSeatState>);

let authoritativeMatch = createFourPlayerMatchState("p3");
authoritativeMatch = applyFourPlayerDamage(authoritativeMatch, "p2", 7, "p3");
authoritativeMatch = {
  ...authoritativeMatch,
  battlefield: putFourPlayerBattlefieldObject(authoritativeMatch.battlefield!, {
    id: "p2-visible-unit",
    defId: "fixture-public-unit",
    kind: "unit",
    ownerSeat: "p2",
    controllerSeat: "p2",
    enteredTurn: 0,
  }),
};
const match = { ...authoritativeMatch, phase: "combat" as const };

for (const viewer of FOUR_PLAYER_SEATS) {
  const projection = projectFourPlayerStateForSeat(states, viewer, match);
  assert.deepEqual(
    projection.seats[viewer].hand,
    states[viewer].hand.map((entry) => ({ instanceId: entry.instanceId, defId: entry.defId })),
  );
  assert.deepEqual(projection.match, {
    activeSeat: "p3",
    round: 1,
    phase: "combat",
    priorityHolder: "p3",
    status: "active",
  });
  const serialized = JSON.stringify(projection);

  for (const seat of FOUR_PLAYER_SEATS) {
    assert.equal(serialized.includes(`${seat}-deck-secret-1`), false, `${viewer} must never receive ${seat} future deck identity`);
    assert.equal(projection.seats[seat].deckCount, 1);
    assert.equal(projection.seats[seat].life, match.seats[seat].life);
    assert.equal(projection.seats[seat].nexusHealth, match.seats[seat].life);
    assert.equal(projection.seats[seat].mana, match.seats[seat].mana);
    assert.equal(projection.seats[seat].maxMana, match.seats[seat].maxMana);
    assert.deepEqual(projection.seats[seat].generalDamageReceived, match.seats[seat].generalDamageReceived);
  }
  assert.deepEqual(projection.seats.p2.battlefield?.map((object) => object.id), ["p2-visible-unit"]);

  for (const opponent of FOUR_PLAYER_SEATS.filter((seat) => seat !== viewer)) {
    const projected = projection.seats[opponent];
    assert.equal(projected.hand, undefined, `${viewer} must not receive ${opponent} hand identities`);
    assert.equal(serialized.includes(`${opponent}-hand-1`), false);
    assert.equal(projected.handCount, 2);
    assert.deepEqual(
      projected.graveyard,
      states[opponent].graveyard.map((entry) => ({ instanceId: entry.instanceId, defId: entry.defId })),
    );
    assert.deepEqual(projected.publicBoard, states[opponent].publicBoard);
  }
}

assert.equal(projectFourPlayerStateForSeat(states, "p1", match).seats.p2.life, 23);
assert.equal(projectFourPlayerStateForSeat(states, "p1", match).seats.p2.generalDamageReceived?.p3, 7);

// Compatibility: callers that have not wired match flow yet still receive the same secure seat projection.
const legacyProjection = projectFourPlayerStateForSeat(states, "p1");
assert.equal(legacyProjection.match, undefined);

console.log("FOUR PLAYER HIDDEN INFORMATION + PUBLIC MATCH FLOW PROJECTION: PASS");
