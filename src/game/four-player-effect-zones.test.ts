import assert from "node:assert/strict";
import { createFourPlayerCardZones } from "./four-player-card-zones";
import { settleFourPlayerEffectDraws } from "./four-player-effect-zones";
import { createFourPlayerMatchState } from "./four-player-match";

const zones = createFourPlayerCardZones({
  p1:["a","b","c"],
  p2:["d","e"],
  p3:["f","g"],
  p4:["h","i"],
},0);
const match = createFourPlayerMatchState("p1");

const drawn = settleFourPlayerEffectDraws(match,zones,{p1:2});
assert.equal(drawn.zones.p1.hand.length,2);
assert.equal(drawn.zones.p1.deck.length,1);
assert.equal(drawn.drawnCounts.p1,2);
assert.deepEqual(drawn.deckOutSeats,[]);
assert.equal(drawn.zones.p2.hand.length,0,"effect draws must not touch other private hands");

const decked = settleFourPlayerEffectDraws(drawn.match,drawn.zones,{p1:2});
assert.equal(decked.zones.p1.hand.length,3,"available cards are drawn before the failed required draw");
assert.equal(decked.zones.p1.deck.length,0);
assert.equal(decked.drawnCounts.p1,1);
assert.deepEqual(decked.deckOutSeats,["p1"]);
assert.equal(decked.match.seats.p1.eliminated,true);

console.log("FOUR PLAYER EFFECT DRAW ZONES: PASS — private draws remain zoned and deckout eliminates authoritatively");
