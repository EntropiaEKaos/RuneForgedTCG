import assert from "node:assert/strict";
import { allCards, getCard } from "./cards";
import { createGame, makeUnit } from "./engine";
import { DECKS } from "./decks";
import { inspectRuntimeCard } from "./card-inspection";
import type { Keyword } from "./types";

const unitDef = allCards().find((card) => card.type === "Unit" && Number(card.power ?? 0) > 0 && Number(card.health ?? 0) > 1);
assert.ok(unitDef, "runtime inspection certification needs at least one collectible unit");

const state = createGame("Tooltip Inspector", DECKS[0], DECKS[1] ?? DECKS[0], true, 380038);
const unit = makeUnit(state, unitDef.defId, "player");
const printedPower = Number(unitDef.power ?? 0);
const printedHealth = Number(unitDef.health ?? 0);

unit.powerBuffs = 2;
unit.healthBuffs = 3;
unit.permanentHealthModifier = -1;
unit.power = printedPower + 2;
unit.maxHealth = printedHealth + 2;
unit.health = unit.maxHealth - 2;
unit.stunned = true;
unit.poisonCounters = 2;
unit.hasAttackedThisTurn = true;
unit.hasStruck = true;
unit.strikes = 3;
unit.nexusStrikes = 1;

const gainedKeyword = (["Haste", "Flying", "Barrier", "Tough"] as Keyword[]).find((keyword) => !unit.keywords.includes(keyword));
assert.ok(gainedKeyword, "fixture needs an available gained keyword");
unit.keywords.push(gainedKeyword);
if (gainedKeyword === "Barrier") unit.barrier = true;

const equipmentDef = allCards().find((card) => card.type === "Equipment" && card.equipment && (card.equipment.buffPower !== 0 || card.equipment.buffHealth !== 0));
if (equipmentDef) unit.equipment.push({ instanceId: "inspection-equipment", defId: equipmentDef.defId });

const report = inspectRuntimeCard(unitDef, unit);
assert.ok(report);
assert.equal(report.printedPower, printedPower);
assert.equal(report.currentPower, printedPower + 2);
assert.equal(report.powerDelta, 2);
assert.equal(report.printedHealth, printedHealth);
assert.equal(report.currentMaxHealth, printedHealth + 2);
assert.equal(report.maxHealthDelta, 2);
assert.equal(report.damageTaken, 2);
assert.equal(report.auraPower, 0);
assert.equal(report.auraHealth, 0);
assert.equal(report.otherPowerModifier, 2);
assert.equal(report.otherHealthModifier, 3);
assert.equal(report.permanentHealthModifier, -1);
assert.ok(report.gainedKeywords.includes(gainedKeyword));
assert.ok(report.statuses.some((status) => status.id === "power-modifier" && status.tone === "buff"));
assert.ok(report.statuses.some((status) => status.id === "health-modifier" && status.tone === "buff"));
assert.ok(report.statuses.some((status) => status.id === "permanent-health" && status.tone === "debuff"));
assert.ok(report.statuses.some((status) => status.id === "stunned" && status.tone === "debuff"));
assert.ok(report.statuses.some((status) => status.id === "poison" && status.tone === "debuff"));
assert.ok(report.statuses.some((status) => status.id === "attacked"));
assert.ok(report.statuses.some((status) => status.id === "struck"));
assert.ok(report.statuses.some((status) => status.id === `gained-${gainedKeyword}`));

if (equipmentDef?.equipment) {
  assert.equal(report.equipmentPower, Number(equipmentDef.equipment.buffPower ?? 0));
  assert.equal(report.equipmentHealth, Number(equipmentDef.equipment.buffHealth ?? 0));
  assert.ok(report.statuses.some((status) => status.id === "equipment"));
  assert.equal(getCard(equipmentDef.defId).name, equipmentDef.name);
}

unit.auraPowerBonus = 1;
unit.auraHealthBonus = 2;
unit.power += 1;
unit.maxHealth += 2;
unit.health += 2;
const auraReport = inspectRuntimeCard(unitDef, unit);
assert.ok(auraReport);
assert.equal(auraReport.auraPower, 1);
assert.equal(auraReport.auraHealth, 2);
assert.equal(auraReport.otherPowerModifier, 2, "Aura contribution remains separate from ordinary power modifiers");
assert.equal(auraReport.otherHealthModifier, 3, "Aura contribution remains separate from ordinary health modifiers");
assert.equal(auraReport.damageTaken, 2, "tooltip preserves marked damage while reporting Aura max-health contribution");
assert.ok(auraReport.statuses.some((status) => status.id === "continuous-aura" && status.tone === "buff"));

unit.frostbitten = true;
unit.power = 0;
const frozen = inspectRuntimeCard(unitDef, unit);
assert.ok(frozen);
assert.equal(frozen.currentPower, 0);
assert.equal(frozen.auraPower, 1, "Frostbite hides effective power without losing Aura source intelligence");
assert.ok(frozen.statuses.some((status) => status.id === "frostbitten" && status.tone === "debuff"));
assert.ok(frozen.statuses.some((status) => status.id === "continuous-aura"));

console.log("CARD INSPECTION: PASS — printed/current stats, Equipment, continuous Aura, modifiers, damage and runtime buffs/debuffs");
