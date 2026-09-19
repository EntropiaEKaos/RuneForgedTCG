import assert from "node:assert/strict";
import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";
import {
  applyFourPlayerTurnStartDraw,
  createFourPlayerCardZones,
  drawFourPlayerCard,
  shouldDrawAtFourPlayerTurnStart,
} from "./four-player-card-zones";

const decks = Object.fromEntries(FOUR_PLAYER_SEATS.map((seat) => [
  seat,
  [seat + "-a", seat + "-b", seat + "-c", seat + "-d"],
])) as Record<FourPlayerSeat, string[]>;

let zones = createFourPlayerCardZones(decks, 2);
for (const seat of FOUR_PLAYER_SEATS) {
  assert.deepEqual(zones[seat].hand, [seat + "-a", seat + "-b"]);
  assert.deepEqual(zones[seat].deck, [seat + "-c", seat + "-d"]);
}

assert.equal(shouldDrawAtFourPlayerTurnStart("p1", 1, "p1"), false);
assert.equal(shouldDrawAtFourPlayerTurnStart("p2", 1, "p1"), true);
assert.equal(shouldDrawAtFourPlayerTurnStart("p3", 1, "p1"), true);
assert.equal(shouldDrawAtFourPlayerTurnStart("p4", 1, "p1"), true);
assert.equal(shouldDrawAtFourPlayerTurnStart("p1", 2, "p1"), true);

const p2Draw = drawFourPlayerCard(zones, "p2");
assert.equal(p2Draw.deckOut, false);
assert.equal(p2Draw.drawnDefId, "p2-c");
zones = p2Draw.zones;
assert.deepEqual(zones.p2.hand, ["p2-a", "p2-b", "p2-c"]);
assert.deepEqual(zones.p2.deck, ["p2-d"]);
assert.deepEqual(zones.p1.hand, ["p1-a", "p1-b"]);

const empty = createFourPlayerCardZones({ p1: [], p2: [], p3: [], p4: [] });
const deckOut = drawFourPlayerCard(empty, "p3");
assert.equal(deckOut.deckOut, true);
assert.equal(deckOut.drawnDefId, undefined);
assert.equal(deckOut.zones, empty);

const opening = createFourPlayerCardZones(decks, 2);
const p1Start = applyFourPlayerTurnStartDraw(opening, "p1", 1, "p1");
assert.equal(p1Start.drew, false);
assert.equal(p1Start.deckOut, false);
assert.equal(p1Start.zones, opening);

const p2Start = applyFourPlayerTurnStartDraw(opening, "p2", 1, "p1");
assert.equal(p2Start.drew, true);
assert.equal(p2Start.drawnDefId, "p2-c");
assert.deepEqual(p2Start.zones.p2.hand, ["p2-a", "p2-b", "p2-c"]);

const p1RoundTwo = applyFourPlayerTurnStartDraw(opening, "p1", 2, "p1");
assert.equal(p1RoundTwo.drew, true);
assert.equal(p1RoundTwo.drawnDefId, "p1-c");

const emptyStart = applyFourPlayerTurnStartDraw(empty, "p2", 1, "p1");
assert.equal(emptyStart.drew, false);
assert.equal(emptyStart.deckOut, true);

assert.throws(() => createFourPlayerCardZones(decks, -1), /non-negative integer/);
assert.throws(() => shouldDrawAtFourPlayerTurnStart("p1", 0, "p1"), /positive integer/);

console.log("FOUR PLAYER AUTHORITATIVE CARD ZONES + TURN-START DRAW POLICY: PASS");
