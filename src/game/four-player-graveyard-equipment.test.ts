import assert from "node:assert/strict";
import { collectibleCards } from "./cards";
import {
  createFourPlayerCardZones,
  millFourPlayerCards,
} from "./four-player-card-zones";
import { resolveFourPlayerCardCast, stageFourPlayerCardCast } from "./four-player-card-play";
import { putFourPlayerBattlefieldObject } from "./four-player-battlefield";
import { createFourPlayerCombatBodySnapshot } from "./four-player-combat-body";
import { resolveFourPlayerEffect } from "./four-player-effect-resolution";
import { settleFourPlayerEffectZoneActions } from "./four-player-effect-zones";
import { createFourPlayerMatchState } from "./four-player-match";

const unit = collectibleCards().find((card) =>
  card.collectible !== false
  && card.type === "Unit"
  && card.cost <= 10
  && !card.keywords?.includes("Hexproof")
  && createFourPlayerCombatBodySnapshot(card),
);
assert.ok(unit, "fixture requires a collectible Unit");

const equipment = collectibleCards().find((card) =>
  card.collectible !== false
  && card.type === "Equipment"
  && card.cost <= 10
  && Boolean(card.equipment),
);
assert.ok(equipment?.equipment, "fixture requires a collectible Equipment");

const recover = collectibleCards().find((card) =>
  card.collectible !== false
  && card.type === "Spell"
  && card.cost <= 10
  && card.spell?.kind === "returnGraveyardToHand",
);
assert.ok(recover?.spell, "fixture requires a graveyard recovery Spell");

const base = { ...createFourPlayerMatchState("p1", undefined, 10), phase: "main_1" as const };

// Graveyard targets are authoritative physical instance ids and are validated before mana is committed.
let recoveryZones = createFourPlayerCardZones({
  p1: [recover.defId, unit.defId],
  p2: [recover.defId, unit.defId],
  p3: [recover.defId, unit.defId],
  p4: [recover.defId, unit.defId],
}, 1);
const milledForRecovery = millFourPlayerCards(recoveryZones, "p1", 1);
recoveryZones = milledForRecovery.zones;
const recoveryTarget = milledForRecovery.milled[0]!;
const recoveryCard = recoveryZones.p1.hand[0]!;
const stagedRecovery = stageFourPlayerCardCast(
  base,
  recoveryZones,
  "p1",
  recoveryCard.instanceId,
  "e-grave-return",
  { kind: "graveyard", seat: "p1", instanceId: recoveryTarget.instanceId },
);
assert.equal(stagedRecovery.stackItem.kind, "spell_cast");
assert.throws(
  () => stageFourPlayerCardCast(
    base,
    recoveryZones,
    "p1",
    recoveryCard.instanceId,
    "e-grave-return-enemy",
    { kind: "graveyard", seat: "p2", instanceId: recoveryTarget.instanceId },
  ),
  /allied graveyard/,
);

const recoveryEffect = resolveFourPlayerEffect(
  base,
  "p1",
  recover.spell,
  { kind: "graveyard", seat: "p1", instanceId: recoveryTarget.instanceId },
);
const recoverySettlement = settleFourPlayerEffectZoneActions(base, recoveryZones, recoveryEffect.zoneActions ?? []);
assert.equal(recoverySettlement.zones.p1.graveyard.some((card) => card.instanceId === recoveryTarget.instanceId), false);
assert.equal(recoverySettlement.zones.p1.hand.some((card) => card.instanceId === recoveryTarget.instanceId), true);

// Self-mill moves only cards that exist and never converts an empty library into draw/fatigue.
let selfMillZones = createFourPlayerCardZones({
  p1: [unit.defId, unit.defId],
  p2: [unit.defId],
  p3: [unit.defId],
  p4: [unit.defId],
}, 0);
const selfMilled = resolveFourPlayerEffect(base, "p1", { kind: "selfMill", amount: 1, target: "none" });
const selfMillSettlement = settleFourPlayerEffectZoneActions(base, selfMillZones, selfMilled.zoneActions ?? []);
selfMillZones = selfMillSettlement.zones;
assert.equal(selfMillZones.p1.deck.length, 1);
assert.equal(selfMillZones.p1.graveyard.length, 1);

// Reanimation consumes the physical graveyard card and materializes that same identity with summoning sickness.
let reanimateZones = createFourPlayerCardZones({
  p1: [unit.defId],
  p2: [unit.defId],
  p3: [unit.defId],
  p4: [unit.defId],
}, 0);
const milledForReanimate = millFourPlayerCards(reanimateZones, "p1", 1);
reanimateZones = milledForReanimate.zones;
const reanimateTarget = milledForReanimate.milled[0]!;
const reanimateEffect = resolveFourPlayerEffect(
  base,
  "p1",
  { kind: "reanimateUnit", amount: 0, target: "allyGraveyardUnit" },
  { kind: "graveyard", seat: "p1", instanceId: reanimateTarget.instanceId },
);
const reanimateSettlement = settleFourPlayerEffectZoneActions(base, reanimateZones, reanimateEffect.zoneActions ?? []);
const reanimated = reanimateSettlement.match.battlefield?.objects.find((object) => object.id === reanimateTarget.instanceId);
assert.equal(reanimateSettlement.zones.p1.graveyard.length, 0);
assert.equal(reanimated?.defId, unit.defId);
assert.equal(reanimated?.ownerSeat, "p1");
assert.equal(reanimated?.controllerSeat, "p1");
assert.equal(reanimated?.enteredTurn, base.turn.turn);

// Banish is a real consume operation: stale follow-up resolution simply fizzles instead of duplicating state.
let banishZones = createFourPlayerCardZones({
  p1: [unit.defId],
  p2: [unit.defId],
  p3: [unit.defId],
  p4: [unit.defId],
}, 0);
const milledForBanish = millFourPlayerCards(banishZones, "p2", 1);
banishZones = milledForBanish.zones;
const banishTarget = milledForBanish.milled[0]!;
const banishEffect = resolveFourPlayerEffect(
  base,
  "p1",
  { kind: "banishGraveyardCard", amount: 0, target: "enemyGraveyardCard" },
  { kind: "graveyard", seat: "p2", instanceId: banishTarget.instanceId },
);
const banishSettlement = settleFourPlayerEffectZoneActions(base, banishZones, banishEffect.zoneActions ?? []);
assert.equal(banishSettlement.zones.p2.graveyard.length, 0);
const staleBanish = settleFourPlayerEffectZoneActions(banishSettlement.match, banishSettlement.zones, banishEffect.zoneActions ?? []);
assert.equal(staleBanish.zones.p2.graveyard.length, 0);

// Physical Equipment keeps provenance, applies its snapshot, and follows a destroyed bearer to the owner's graveyard.
const body = createFourPlayerCombatBodySnapshot(unit)!;
let equipmentMatch = {
  ...base,
  battlefield: putFourPlayerBattlefieldObject(base.battlefield!, {
    id: "physical-bearer",
    defId: unit.defId,
    kind: "unit",
    ownerSeat: "p1",
    controllerSeat: "p1",
    enteredTurn: 0,
    keywords: unit.keywords ?? [],
    combat: body,
  }),
};
const equipmentZones = createFourPlayerCardZones({
  p1: [equipment.defId],
  p2: [unit.defId],
  p3: [unit.defId],
  p4: [unit.defId],
}, 1);
const equipmentCard = equipmentZones.p1.hand[0]!;
const stagedEquipment = stageFourPlayerCardCast(
  equipmentMatch,
  equipmentZones,
  "p1",
  equipmentCard.instanceId,
  "e-equipment",
  { kind: "battlefield", objectId: "physical-bearer" },
);
const equipmentResolved = resolveFourPlayerCardCast(stagedEquipment.match, stagedEquipment.stackItem);
const equippedBearer = equipmentResolved.match.battlefield?.objects.find((object) => object.id === "physical-bearer");
assert.equal(equippedBearer?.equipment?.length, 1);
assert.equal(equippedBearer?.equipment?.[0]?.physical, true);
assert.equal(equippedBearer?.equipment?.[0]?.instanceId, equipmentCard.instanceId);
assert.equal(equippedBearer?.combat?.power, body.power + equipment.equipment.buffPower);
assert.equal(equippedBearer?.combat?.maxHealth, Math.max(0, body.maxHealth + equipment.equipment.buffHealth));

const killedBearer = resolveFourPlayerEffect(
  equipmentResolved.match,
  "p2",
  { kind: "killUnit", amount: 0, target: "enemyUnit" },
  { kind: "battlefield", objectId: "physical-bearer" },
);
const equipmentDeathSettlement = settleFourPlayerEffectZoneActions(
  killedBearer.match,
  stagedEquipment.zones,
  killedBearer.zoneActions ?? [],
);
assert.equal(
  equipmentDeathSettlement.zones.p1.graveyard.some((card) => card.instanceId === equipmentCard.instanceId),
  true,
  "physical Equipment must retain physical-card provenance when the bearer dies",
);

// Generated attachments use a distinct identity and must never manufacture a physical graveyard card.
let generatedMatch = {
  ...base,
  battlefield: putFourPlayerBattlefieldObject(base.battlefield!, {
    id: "generated-bearer",
    defId: unit.defId,
    kind: "unit",
    ownerSeat: "p1",
    controllerSeat: "p1",
    enteredTurn: 0,
    keywords: unit.keywords ?? [],
    combat: body,
  }),
};
const generatedAttachment = resolveFourPlayerEffect(
  generatedMatch,
  "p1",
  { kind: "attachEquipment", amount: 0, target: "allyUnit", equipmentDefId: equipment.defId },
  { kind: "battlefield", objectId: "generated-bearer" },
  { tokenNamespace: "generated-eq" },
);
generatedMatch = generatedAttachment.match;
assert.equal(generatedMatch.battlefield?.objects.find((object) => object.id === "generated-bearer")?.equipment?.[0]?.physical, false);
const killedGenerated = resolveFourPlayerEffect(
  generatedMatch,
  "p2",
  { kind: "killUnit", amount: 0, target: "enemyUnit" },
  { kind: "battlefield", objectId: "generated-bearer" },
);
assert.equal((killedGenerated.zoneActions ?? []).some((action) => action.kind === "put_graveyard"), false);

console.log("FOUR PLAYER GRAVEYARD + EQUIPMENT: PASS — public graveyard identity, self-mill, recursion, reanimation, banish and physical/generated attachment provenance");
