import assert from "node:assert/strict";
import { ABILITY_KIND_SUPPORT, ABILITY_RULE_KINDS } from "./ability-system";
import { withRegisteredCardSnapshot } from "./custom-registry";
import {
  canAttachEquipment,
  EQUIPMENT_LINK_CONTRACT,
  equipmentSlotsRemaining,
  equipmentSlotsUsed,
  MAX_EQUIPMENT_PER_UNIT,
  unitsWithEquipmentCapacity,
} from "./equipment-link-contract";
import {
  applyCardEffectForSandbox,
  canPlayCard,
  cleanupDead,
  createCustomGame,
  makeUnit,
  playUnit,
} from "./engine";
import type { CardDef, DeckInput, EquipmentSlot, UnitInstance } from "./types";

assert.equal(ABILITY_KIND_SUPPORT.linked, "partial", "generic linked abilities must not be overclaimed");
assert.ok(ABILITY_RULE_KINDS.includes("equipmentAttachment"));
assert.equal(EQUIPMENT_LINK_CONTRACT.rule, "equipmentAttachment");
assert.equal(EQUIPMENT_LINK_CONTRACT.target, "allyUnit");
assert.equal(EQUIPMENT_LINK_CONTRACT.maxPerUnit, 2);
assert.equal(EQUIPMENT_LINK_CONTRACT.lifecycle, "leavesWithHost");
assert.equal(EQUIPMENT_LINK_CONTRACT.support, "supported");
assert.equal(MAX_EQUIPMENT_PER_UNIT, 2);

const emptySlots = { equipment: [] as EquipmentSlot[] };
const oneSlot = { equipment: [{ instanceId: "eq_1", defId: "probe" }] as EquipmentSlot[] };
const fullSlots = {
  equipment: [
    { instanceId: "eq_1", defId: "probe" },
    { instanceId: "eq_2", defId: "probe" },
  ] as EquipmentSlot[],
};
assert.equal(equipmentSlotsUsed(emptySlots), 0);
assert.equal(equipmentSlotsRemaining(emptySlots), 2);
assert.equal(canAttachEquipment(emptySlots), true);
assert.equal(equipmentSlotsUsed(oneSlot), 1);
assert.equal(equipmentSlotsRemaining(oneSlot), 1);
assert.equal(canAttachEquipment(oneSlot), true);
assert.equal(equipmentSlotsUsed(fullSlots), 2);
assert.equal(equipmentSlotsRemaining(fullSlots), 0);
assert.equal(canAttachEquipment(fullSlots), false);
assert.equal(unitsWithEquipmentCapacity([emptySlots, oneSlot, fullSlots]).length, 2);

const strongHost: CardDef = {
  defId: "equipment_link_strong",
  name: "Equipment Link Strong Host",
  region: "Ironwood",
  type: "Unit",
  cost: 1,
  power: 5,
  health: 5,
  description: "Equipment link contract fixture.",
  rarity: "Common",
  emoji: "🛡️",
};
const weakHost: CardDef = {
  ...strongHost,
  defId: "equipment_link_weak",
  name: "Equipment Link Weak Host",
  power: 2,
  health: 3,
};
const aegis: CardDef = {
  defId: "equipment_link_aegis",
  name: "Equipment Link Aegis",
  region: "Ironwood",
  type: "Equipment",
  cost: 1,
  description: "Linked equipment fixture.",
  rarity: "Common",
  emoji: "🛡️",
  equipment: { buffPower: 1, buffHealth: 2, keywords: ["Tough"] },
};
const blade: CardDef = {
  ...aegis,
  defId: "equipment_link_blade",
  name: "Equipment Link Blade",
  equipment: { buffPower: 2, buffHealth: 0, keywords: ["Reach"] },
};
const charm: CardDef = {
  ...aegis,
  defId: "equipment_link_charm",
  name: "Equipment Link Charm",
  equipment: { buffPower: 0, buffHealth: 1, keywords: [] },
};

const deck: DeckInput = {
  id: "equipment-link-contract",
  name: "Equipment Link Contract",
  cards: Array(20).fill("ember_whelp"),
};

function freshGame() {
  return createCustomGame("Equipment Link", deck, deck, {
    skipMulligan: true,
    playerGoesFirst: true,
    playerStartingHand: 0,
    aiStartingHand: 0,
    playerStartingMana: 10,
  });
}

function addHost(state: ReturnType<typeof freshGame>, defId: string): UnitInstance {
  const unit = makeUnit(state, defId, "player");
  unit.summonedThisTurn = false;
  state.players.player.bench.push(unit);
  return unit;
}

function addEquipmentToHand(state: ReturnType<typeof freshGame>, instanceId: string, defId: string) {
  state.players.player.hand.push({ instanceId, defId });
}

withRegisteredCardSnapshot([strongHost, weakHost, aegis, blade, charm], () => {
  // Direct Equipment play: attachment, stat derivation and granted keywords.
  let state = freshGame();
  const host = addHost(state, strongHost.defId);
  addEquipmentToHand(state, "aegis_hand", aegis.defId);
  assert.equal(canPlayCard(state, "player", "aegis_hand"), true);
  state = playUnit(state, "player", "aegis_hand", host.instanceId);
  let linked = state.players.player.bench.find((unit) => unit.instanceId === host.instanceId)!;
  assert.equal(linked.equipment.length, 1);
  assert.equal(linked.equipment[0]?.defId, aegis.defId);
  assert.equal(linked.power, 6);
  assert.equal(linked.maxHealth, 7);
  assert.equal(linked.health, 7);
  assert.ok(linked.keywords.includes("Tough"));

  addEquipmentToHand(state, "blade_hand", blade.defId);
  state = playUnit(state, "player", "blade_hand", host.instanceId);
  linked = state.players.player.bench.find((unit) => unit.instanceId === host.instanceId)!;
  assert.equal(linked.equipment.length, MAX_EQUIPMENT_PER_UNIT);
  assert.equal(linked.power, 8);
  assert.equal(linked.maxHealth, 7);
  assert.ok(linked.keywords.includes("Reach"));

  // With every host full, Equipment is not playable and consumes no resource.
  addEquipmentToHand(state, "charm_blocked", charm.defId);
  assert.equal(canPlayCard(state, "player", "charm_blocked"), false);
  const blockedMana = state.players.player.mana;
  const blockedHand = state.players.player.hand.length;
  const blocked = playUnit(state, "player", "charm_blocked", host.instanceId);
  assert.equal(blocked, state, "an impossible Equipment play must fail closed with the original state");
  assert.equal(blocked.players.player.mana, blockedMana);
  assert.equal(blocked.players.player.hand.length, blockedHand);
  assert.equal(linked.equipment.length, MAX_EQUIPMENT_PER_UNIT);

  // Explicit targeting must never silently retarget from a full host to another unit.
  const freeHost = addHost(state, weakHost.defId);
  assert.equal(canPlayCard(state, "player", "charm_blocked"), true, "a second host with capacity makes Equipment playable");
  const explicitMana = state.players.player.mana;
  const explicitHand = state.players.player.hand.length;
  const explicitRejected = playUnit(state, "player", "charm_blocked", host.instanceId);
  assert.equal(explicitRejected, state);
  assert.equal(explicitRejected.players.player.mana, explicitMana);
  assert.equal(explicitRejected.players.player.hand.length, explicitHand);
  assert.equal(freeHost.equipment.length, 0, "invalid explicit targets must not be replaced by auto-targeting");

  // Auto-targeted attachment effects filter capacity BEFORE choosing the strongest host.
  const autoAttached = applyCardEffectForSandbox(state, "player", {
    kind: "attachEquipment",
    amount: 0,
    target: "allyUnit",
    equipmentDefId: charm.defId,
  });
  const autoStrong = autoAttached.players.player.bench.find((unit) => unit.instanceId === host.instanceId)!;
  const autoWeak = autoAttached.players.player.bench.find((unit) => unit.instanceId === freeHost.instanceId)!;
  assert.equal(autoStrong.equipment.length, MAX_EQUIPMENT_PER_UNIT);
  assert.equal(autoWeak.equipment.length, 1, "the strongest full host must not suppress a legal weaker attachment target");
  assert.equal(autoWeak.equipment[0]?.defId, charm.defId);
  assert.equal(autoWeak.maxHealth, 4);
  assert.equal(autoWeak.health, 4);

  // The same effect with an explicit full host fails closed instead of retargeting.
  const explicitEffectRejected = applyCardEffectForSandbox(state, "player", {
    kind: "attachEquipment",
    amount: 0,
    target: "allyUnit",
    equipmentDefId: charm.defId,
  }, host.instanceId);
  const explicitEffectWeak = explicitEffectRejected.players.player.bench.find((unit) => unit.instanceId === freeHost.instanceId)!;
  assert.equal(explicitEffectWeak.equipment.length, 0);

  // Linked Equipment leaves the battlefield together with a dead host.
  const deathState = structuredClone(state);
  const doomed = deathState.players.player.bench.find((unit) => unit.instanceId === host.instanceId)!;
  doomed.health = 0;
  cleanupDead(deathState);
  assert.equal(deathState.players.player.bench.some((unit) => unit.instanceId === host.instanceId), false);
  assert.ok(deathState.log.some((line) => line.includes(aegis.name) && line.includes("falls with")));
  assert.ok(deathState.log.some((line) => line.includes(blade.name) && line.includes("falls with")));

  // Recall also removes the linked Equipment because the host no longer exists on board.
  const recallState = applyCardEffectForSandbox(state, "player", {
    kind: "recall",
    amount: 0,
    target: "allyUnit",
  }, host.instanceId);
  assert.equal(recallState.players.player.bench.some((unit) => unit.instanceId === host.instanceId), false);
  assert.ok(recallState.players.player.hand.some((card) => card.defId === strongHost.defId));
  assert.equal(recallState.players.player.hand.some((card) => card.defId === aegis.defId), false);
  assert.equal(recallState.players.player.hand.some((card) => card.defId === blade.defId), false);
});

console.log("EQUIPMENT LINK CONTRACT: PASS — 2-slot capacity, authoritative targeting, derived stats/keywords and host lifecycle certified");
