import assert from "node:assert/strict";
import { createFourPlayerCardZones } from "./four-player-card-zones";
import { createFourPlayerMatchState, eliminateFourPlayerMatchSeat } from "./four-player-match";
import { settleFourPlayerTurnStart } from "./four-player-turn-start";

const decks = {
  p1: ["p1-a"],
  p2: ["p2-a"],
  p3: ["p3-a"],
  p4: ["p4-a"],
};

const opening = createFourPlayerCardZones(decks);
const initial = createFourPlayerMatchState("p1");

const skipped = settleFourPlayerTurnStart(initial, opening, "p1");
assert.equal(skipped.drew, false);
assert.equal(skipped.deckOut, false);
assert.equal(skipped.match.seats.p1.eliminated, false);

const p2Match = { ...initial, turn: { ...initial.turn, activeSeat: "p2" as const } };
const p2Draw = settleFourPlayerTurnStart(p2Match, opening, "p1");
assert.equal(p2Draw.drew, true);
assert.equal(p2Draw.drawnDefId, "p2-a");
assert.equal(p2Draw.deckOut, false);
assert.equal(p2Draw.zones.p2.deck.length, 0);

const empty = createFourPlayerCardZones({ p1: [], p2: [], p3: [], p4: [] });
const deckOut = settleFourPlayerTurnStart(p2Match, empty, "p1");
assert.equal(deckOut.deckOut, true);
assert.equal(deckOut.eliminatedSeat, "p2");
assert.equal(deckOut.match.seats.p2.eliminated, true);
assert.equal(deckOut.match.status, "active");
assert.equal(deckOut.match.turn.activeSeat, "p3");

let finalMatch = eliminateFourPlayerMatchSeat(initial, "p2");
finalMatch = eliminateFourPlayerMatchSeat(finalMatch, "p3");
const p4Final = { ...finalMatch, turn: { ...finalMatch.turn, activeSeat: "p4" as const } };
const finalDeckOut = settleFourPlayerTurnStart(p4Final, empty, "p1");
assert.equal(finalDeckOut.deckOut, true);
assert.equal(finalDeckOut.match.status, "completed");
assert.equal(finalDeckOut.match.winner, "p1");
assert.equal(finalDeckOut.match.seats.p4.eliminated, true);

console.log("FOUR PLAYER TURN START + DECK-OUT ELIMINATION: PASS");
