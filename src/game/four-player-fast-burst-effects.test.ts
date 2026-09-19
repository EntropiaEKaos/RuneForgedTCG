import assert from "node:assert/strict";
import { collectibleCards } from "./cards";
import { createFourPlayerCardZones } from "./four-player-card-zones";
import { stageFourPlayerCardCast } from "./four-player-card-play";
import { putFourPlayerBattlefieldObject } from "./four-player-battlefield";
import { resolveFourPlayerEffect } from "./four-player-effect-resolution";
import { settleFourPlayerEffectZoneActions } from "./four-player-effect-zones";
import { createFourPlayerMatchState } from "./four-player-match";

const permanent = collectibleCards().find((card) =>
  card.collectible !== false
  && (card.type === "Enchantment" || card.type === "Artifact")
  && card.cost <= 10,
);
assert.ok(permanent, "fixture requires a collectible permanent");
const trap = collectibleCards().find((card) => card.collectible !== false && card.type === "Spell" && card.archetypeKey === "trap");
assert.ok(trap, "fixture requires a collectible semantic Trap");
const trapZones = createFourPlayerCardZones({ p1:[trap.defId], p2:[trap.defId], p3:[trap.defId], p4:[trap.defId] }, 1);
const trapBase = { ...createFourPlayerMatchState("p1", undefined, 10), phase: "main_1" as const };
assert.throws(
  () => stageFourPlayerCardCast(trapBase, trapZones, "p1", trapZones.p1.hand[0]!.instanceId, "e-proactive-trap"),
  /reaction-only/,
  "semantic Trap must remain reaction-only in Commander 4P",
);
const permanentZones = createFourPlayerCardZones({
  p1: [permanent.defId], p2: [permanent.defId], p3: [permanent.defId], p4: [permanent.defId],
}, 1);
const permanentBase = {
  ...createFourPlayerMatchState("p1", undefined, 10),
  phase: "main_1" as const,
};
const stagedPermanent = stageFourPlayerCardCast(
  permanentBase,
  permanentZones,
  "p1",
  permanentZones.p1.hand[0]!.instanceId,
  "e-durable-permanent",
);
const stagedDurability = (stagedPermanent.stackItem.payload as { durability?: { health: number; maxHealth: number } }).durability;
assert.equal(stagedDurability?.maxHealth, permanent.maxHealth ?? 3, "permanent casts must snapshot 1v1-compatible durability");
assert.equal(stagedDurability?.health, permanent.maxHealth ?? 3);

let permanentMatch = createFourPlayerMatchState("p1");
permanentMatch = {
  ...permanentMatch,
  battlefield: putFourPlayerBattlefieldObject(permanentMatch.battlefield!, {
    id: "p2:permanent:1",
    defId: permanent.defId,
    kind: "permanent",
    ownerSeat: "p2",
    controllerSeat: "p2",
    enteredTurn: 0,
    durability: { health: 5, maxHealth: 5 },
  }),
};
const damaged = resolveFourPlayerEffect(
  permanentMatch,
  "p1",
  { kind: "damagePermanent", amount: 3, target: "enemyPermanent" },
  { kind: "battlefield", objectId: "p2:permanent:1" },
);
assert.equal(damaged.match.battlefield?.objects[0]?.durability?.health, 2);
const destroyed = resolveFourPlayerEffect(
  damaged.match,
  "p1",
  { kind: "destroyPermanent", amount: 0, target: "enemyPermanent" },
  { kind: "battlefield", objectId: "p2:permanent:1" },
);
assert.equal(destroyed.match.battlefield?.objects.some((object) => object.id === "p2:permanent:1"), false);
assert.equal(destroyed.destroyed[0]?.destination, "graveyard");

const unit = collectibleCards().find((card) => card.collectible !== false && card.type === "Unit");
assert.ok(unit, "fixture requires a collectible Unit");
let recallZones = createFourPlayerCardZones({
  p1: [unit.defId],
  p2: [unit.defId],
  p3: [unit.defId],
  p4: [unit.defId],
}, 0);
const recalledCard = recallZones.p2.deck[0]!;
recallZones = {
  ...recallZones,
  p2: { ...recallZones.p2, deck: recallZones.p2.deck.slice(1) },
};
let recallMatch = createFourPlayerMatchState("p1");
recallMatch = {
  ...recallMatch,
  battlefield: putFourPlayerBattlefieldObject(recallMatch.battlefield!, {
    id: recalledCard.instanceId,
    defId: recalledCard.defId,
    kind: "unit",
    ownerSeat: "p2",
    controllerSeat: "p2",
    enteredTurn: 0,
  }),
};
const recalled = resolveFourPlayerEffect(
  recallMatch,
  "p1",
  { kind: "recall", amount: 1, target: "enemyUnit" },
  { kind: "battlefield", objectId: recalledCard.instanceId },
);
assert.equal(recalled.match.battlefield?.objects.some((object) => object.id === recalledCard.instanceId), false);
assert.equal(recalled.zoneActions?.[0]?.kind, "return_to_hand");
const recallSettlement = settleFourPlayerEffectZoneActions(recalled.match, recallZones, recalled.zoneActions ?? []);
assert.equal(recallSettlement.zones.p2.hand.some((card) => card.instanceId === recalledCard.instanceId), true);

let millZones = createFourPlayerCardZones({
  p1: [unit.defId, unit.defId, unit.defId],
  p2: [unit.defId, unit.defId, unit.defId],
  p3: [unit.defId, unit.defId, unit.defId],
  p4: [unit.defId, unit.defId, unit.defId],
}, 0);
const millMatch = createFourPlayerMatchState("p1");
const milled = resolveFourPlayerEffect(
  millMatch,
  "p1",
  { kind: "mill", amount: 2, target: "none" },
  { kind: "player", seat: "p2" },
);
const millSettlement = settleFourPlayerEffectZoneActions(milled.match, millZones, milled.zoneActions ?? []);
millZones = millSettlement.zones;
assert.equal(millZones.p2.deck.length, 1);
assert.equal(millZones.p2.graveyard.length, 2);
assert.equal(millSettlement.milledCounts.p2, 2);

console.log("FOUR PLAYER FAST/BURST EFFECTS: PASS — permanent durability, recall zone return and mill settlement");
