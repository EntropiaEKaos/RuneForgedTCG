import assert from "node:assert/strict";
import {
  FOUR_PLAYER_MAX_MANA,
  advanceFourPlayerMatchTurn,
  createFourPlayerMatchState,
  eliminateFourPlayerMatchSeat,
  type FourPlayerMatchState,
} from "./four-player-match";

let match: FourPlayerMatchState = createFourPlayerMatchState("p1", undefined, 0);
assert.equal(match.seats.p1.maxMana, 1);
assert.equal(match.seats.p1.mana, 1);
assert.equal(match.seats.p2.maxMana, 0);
match = advanceFourPlayerMatchTurn(match);
assert.equal(match.turn.activeSeat, "p2");
assert.equal(match.seats.p2.maxMana, 1);
assert.equal(match.seats.p2.mana, 1);
assert.equal(match.seats.p1.maxMana, 1);

match = { ...match, seats: { ...match.seats, p2: { ...match.seats.p2, mana: 0 } } };
match = advanceFourPlayerMatchTurn(match);
assert.equal(match.turn.activeSeat, "p3");
assert.equal(match.seats.p2.mana, 0);
assert.equal(match.seats.p3.mana, 1);

let skip: FourPlayerMatchState = createFourPlayerMatchState("p1", undefined, 0);
skip = eliminateFourPlayerMatchSeat(skip, "p2");
skip = advanceFourPlayerMatchTurn(skip);
assert.equal(skip.turn.activeSeat, "p3");
assert.equal(skip.seats.p2.mana, 0);
assert.equal(skip.seats.p2.maxMana, 0);
assert.equal(skip.seats.p3.mana, 1);
assert.equal(skip.seats.p3.maxMana, 1);

let capped: FourPlayerMatchState = createFourPlayerMatchState("p1", undefined, FOUR_PLAYER_MAX_MANA);
assert.equal(capped.seats.p1.maxMana, FOUR_PLAYER_MAX_MANA);
assert.equal(capped.seats.p1.mana, FOUR_PLAYER_MAX_MANA);
capped = advanceFourPlayerMatchTurn(capped);
assert.equal(capped.seats.p2.maxMana, FOUR_PLAYER_MAX_MANA);
assert.equal(capped.seats.p2.mana, FOUR_PLAYER_MAX_MANA);

console.log("FOUR PLAYER TURN MANA PROGRESSION + REFRESH: PASS");
