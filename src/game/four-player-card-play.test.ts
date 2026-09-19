import assert from "node:assert/strict";
import { collectibleCards } from "./cards";
import { createFourPlayerCardZones } from "./four-player-card-zones";
import { stageFourPlayerCardCast } from "./four-player-card-play";
import { passFourPlayerFlow, submitFourPlayerAction } from "./four-player-flow";
import { createFourPlayerMatchState } from "./four-player-match";
import { pumpFourPlayerServer } from "./four-player-server-pump";

const physical = collectibleCards().find((card) =>
  card.collectible !== false
  && ["Unit", "Enchantment", "Artifact", "Sentinela"].includes(card.type)
  && card.cost <= 10,
);
assert.ok(physical, "fixture requires a physical card costing at most 10");

const decks = {
  p1: [physical.defId],
  p2: [physical.defId],
  p3: [physical.defId],
  p4: [physical.defId],
};
const zones = createFourPlayerCardZones(decks, 1);
const base = { ...createFourPlayerMatchState("p1", undefined, 10), phase: "main_1" as const };
const p1Card = zones.p1.hand[0]!;
const p2Card = zones.p2.hand[0]!;

assert.throws(
  () => stageFourPlayerCardCast(base, zones, "p1", "forged-instance", "e-forged"),
  /is not in p1's hand/,
);
assert.throws(
  () => stageFourPlayerCardCast(base, zones, "p1", p2Card.instanceId, "e-stolen"),
  /is not in p1's hand/,
);

const poor = {
  ...base,
  seats: { ...base.seats, p1: { ...base.seats.p1, mana: Math.max(0, physical.cost - 1) } },
};
if (physical.cost > 0) {
  assert.throws(
    () => stageFourPlayerCardCast(poor, zones, "p1", p1Card.instanceId, "e-poor"),
    /Insufficient mana/,
  );
}

const staged = stageFourPlayerCardCast(base, zones, "p1", p1Card.instanceId, "e-play");
assert.equal(staged.card.instanceId, p1Card.instanceId);
assert.equal(staged.stackItem.kind, "card_cast");
assert.equal(staged.stackItem.controller, "p1");
assert.equal((staged.stackItem.payload as { instanceId: string }).instanceId, p1Card.instanceId);
assert.equal(staged.zones.p1.hand.length, 0);
assert.equal(staged.match.seats.p1.mana, base.seats.p1.mana - physical.cost);

let onStack = {
  ...staged.match,
  resolution: submitFourPlayerAction(staged.match.resolution, staged.stackItem),
};
assert.equal(onStack.resolution.stack.items[0]?.id, staged.stackItem.id);
for (let index = 0; index < 4; index += 1) {
  onStack = { ...onStack, resolution: passFourPlayerFlow(onStack.resolution) };
}
const pumped = pumpFourPlayerServer(onStack);
assert.deepEqual(pumped.resolved.map((item) => item.id), [staged.stackItem.id]);
const permanent = pumped.match.battlefield?.objects.find((object) => object.id === p1Card.instanceId);
assert.equal(permanent?.defId, physical.defId);
assert.equal(permanent?.ownerSeat, "p1");
assert.equal(permanent?.controllerSeat, "p1");
assert.equal(permanent?.enteredTurn, base.turn.turn);
assert.equal(pumped.match.resolution.stack.items.length, 0);

console.log("FOUR PLAYER CARD PLAY AUTHORITY: PASS — hand identity, mana payment, stack identity and physical pump resolution");
