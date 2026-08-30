import assert from "node:assert/strict";
import {
  ABILITY_GRAMMAR_CATALOG,
  ABILITY_GRAMMAR_VERSION,
  ABILITY_KIND_SUPPORT,
  ABILITY_TIMING_SUPPORT,
  abilityBlueprintsForCard,
  blueprintFromActivatedAbility,
  blueprintFromCostReduction,
  blueprintFromEquipment,
  blueprintFromMechanic,
  blueprintFromReactionSpell,
} from "./ability-system";
import { baseCardsOnly, getCard } from "./cards";
import type { ActivatedAbility } from "./activated-ability-types";
import type { CardMechanic } from "./types";

assert.equal(ABILITY_GRAMMAR_VERSION, 2);
assert.equal(ABILITY_GRAMMAR_CATALOG.version, 2);
assert.deepEqual(ABILITY_GRAMMAR_CATALOG.rules, ["costReduction", "equipmentAttachment"]);
assert.equal(ABILITY_KIND_SUPPORT.keyword, "supported");
assert.equal(ABILITY_KIND_SUPPORT.triggered, "supported");
assert.equal(ABILITY_KIND_SUPPORT.activated, "supported");
assert.equal(ABILITY_KIND_SUPPORT.reaction, "supported");
assert.equal(ABILITY_KIND_SUPPORT.transformation, "supported");
assert.equal(ABILITY_KIND_SUPPORT.static, "partial");
assert.equal(ABILITY_KIND_SUPPORT.aura, "partial");
assert.equal(ABILITY_KIND_SUPPORT.linked, "partial");
assert.equal(ABILITY_KIND_SUPPORT.modal, "planned");
assert.equal(ABILITY_KIND_SUPPORT.replacement, "planned");
assert.equal(ABILITY_KIND_SUPPORT.delayed, "planned");
assert.equal(ABILITY_TIMING_SUPPORT.static, "supported");
assert.equal(ABILITY_TIMING_SUPPORT.reaction, "supported");
assert.equal(ABILITY_TIMING_SUPPORT.priority, "planned");

const activated: ActivatedAbility = {
  description: "Canalize o Nexus.",
  cost: {
    mana: 2,
    nexusHealth: 1,
    exhaustSelf: true,
    loyaltyDelta: -1,
  },
  maxUsesPerRound: 2,
  effect: {
    kind: "damageUnit",
    amount: 2,
    target: "enemyUnit",
    also: { kind: "draw", amount: 1, target: "none" },
  },
};
const activatedBlueprint = blueprintFromActivatedAbility(activated);
assert.equal(activatedBlueprint.origin, "activated");
assert.equal(activatedBlueprint.kind, "activated");
assert.equal(activatedBlueprint.timing, "mainPhase");
assert.deepEqual(activatedBlueprint.costs, [
  { kind: "mana", amount: 2 },
  { kind: "nexusHealth", amount: 1 },
  { kind: "exhaustSelf" },
  { kind: "loyalty", delta: -1 },
]);
assert.deepEqual(activatedBlueprint.features.sort(), ["chained", "repeatable", "targeted"]);
assert.equal(activatedBlueprint.target, "enemyUnit");

// Mechanics Studio content is persisted/published dynamically rather than
// embedded in today's 429 base CardDefs, so certify its adapter independently
// instead of pretending the canonical catalog currently contains that origin.
const mechanic: CardMechanic = {
  key: "ability_system_probe",
  name: "Probe condicional",
  trigger: "onSummon",
  condition: { kind: "manaAtLeast", amount: 3 },
  effect: { kind: "draw", amount: 1, target: "none" },
};
const mechanicBlueprint = blueprintFromMechanic(mechanic);
assert.equal(mechanicBlueprint.origin, "mechanic");
assert.equal(mechanicBlueprint.kind, "triggered");
assert.equal(mechanicBlueprint.timing, "automatic");
assert.equal(mechanicBlueprint.trigger, "onSummon");
assert.deepEqual(mechanicBlueprint.features, ["conditional"]);

const swarmlord = getCard("ember_swarmlord");
assert.ok(swarmlord.costReduction, "canonical Swarmlord must retain its Affinity cost reduction");
const affinityBlueprint = blueprintFromCostReduction(swarmlord.costReduction);
assert.equal(affinityBlueprint.origin, "costReduction");
assert.equal(affinityBlueprint.kind, "static");
assert.equal(affinityBlueprint.timing, "static");
assert.deepEqual(affinityBlueprint.features, ["conditional"]);
assert.deepEqual(affinityBlueprint.rule, {
  kind: "costReduction",
  costReduction: { kind: "creatures", per: 1 },
});
const powerReductionBlueprint = blueprintFromCostReduction({ kind: "power", per: 2, threshold: 4, max: 6 });
assert.deepEqual(powerReductionBlueprint.rule, {
  kind: "costReduction",
  costReduction: { kind: "power", per: 2, threshold: 4, max: 6 },
});

const claw = getCard("wood_claw");
const equipmentBlueprint = blueprintFromEquipment(claw);
assert.ok(equipmentBlueprint, "canonical Thornfang Claw must project its persistent attachment contract");
assert.equal(equipmentBlueprint.origin, "equipment");
assert.equal(equipmentBlueprint.kind, "linked");
assert.equal(equipmentBlueprint.timing, "static");
assert.equal(equipmentBlueprint.target, "allyUnit");
assert.deepEqual(equipmentBlueprint.features, ["targeted"]);
assert.deepEqual(equipmentBlueprint.rule, {
  kind: "equipmentAttachment",
  equipment: { buffPower: 1, buffHealth: 1, keywords: [] },
});
assert.equal(
  blueprintFromEquipment({ ...claw, type: "Unit" }),
  null,
  "equipment projection fails closed when the structural card type is not Equipment",
);

const denyBlueprint = blueprintFromReactionSpell(getCard("tide_deny"));
assert.ok(denyBlueprint, "canonical Tide Deny is projected as a reaction ability");
assert.equal(denyBlueprint.origin, "spell");
assert.equal(denyBlueprint.kind, "reaction");
assert.equal(denyBlueprint.timing, "reaction");
assert.equal(denyBlueprint.target, "spellOnStack");
assert.deepEqual(denyBlueprint.costs, [{ kind: "mana", amount: 4 }]);
assert.deepEqual(denyBlueprint.features, ["targeted"]);
assert.equal(blueprintFromReactionSpell(getCard("tide_draw")), null, "ordinary main-phase spells are not mislabeled as reactions");

const cards = baseCardsOnly();
assert.equal(cards.length, 429, "Ability grammar certification covers the complete canonical 429-card catalog");

let blueprintCount = 0;
let cardsWithGrammar = 0;
const origins = new Set<string>();
const ruleKinds = new Set<string>();
for (const card of cards) {
  const before = JSON.stringify(card);
  const blueprints = abilityBlueprintsForCard(card);
  const expected =
    (card.keywords?.length ?? 0) +
    (card.costReduction ? 1 : 0) +
    (card.type === "Equipment" && card.equipment ? 1 : 0) +
    (card.trigger ? 1 : 0) +
    (card.mechanics?.length ?? 0) +
    (card.type === "Spell" && card.speed && card.spell ? 1 : 0) +
    (card.activatedAbilities?.length ?? 0) +
    (card.sentinela?.abilities.length ?? 0) +
    (card.levelUp ? 1 : 0);

  assert.equal(blueprints.length, expected, `${card.defId} preserves every existing ability surface in the compatibility projection`);
  assert.equal(JSON.stringify(card), before, `${card.defId} is not mutated by Ability System 2.0 projection`);

  if (blueprints.length) cardsWithGrammar += 1;
  blueprintCount += blueprints.length;
  for (const blueprint of blueprints) {
    assert.equal(blueprint.version, 2, `${card.defId} blueprint uses grammar v2`);
    assert.ok(ABILITY_GRAMMAR_CATALOG.kinds.includes(blueprint.kind), `${card.defId} uses a canonical ability kind`);
    assert.ok(ABILITY_GRAMMAR_CATALOG.timings.includes(blueprint.timing), `${card.defId} uses a canonical timing`);
    if (blueprint.effect) assert.equal(blueprint.target, blueprint.effect.target, `${card.defId} keeps effect targeting authoritative`);
    if (blueprint.rule) {
      assert.ok(ABILITY_GRAMMAR_CATALOG.rules.includes(blueprint.rule.kind), `${card.defId} uses a canonical persistent rule kind`);
      ruleKinds.add(blueprint.rule.kind);
    }
    origins.add(blueprint.origin);
  }
}

// These origins are genuinely present in the static catalog today. Dynamic
// Mechanics Studio compatibility is proven by the dedicated adapter probe above.
for (const origin of ["keyword", "costReduction", "equipment", "legacyTrigger", "spell", "activated", "sentinela", "levelUp"]) {
  assert.ok(origins.has(origin), `canonical catalog exercises ${origin} compatibility`);
}
assert.deepEqual([...ruleKinds].sort(), ["costReduction", "equipmentAttachment"]);
assert.equal(origins.has("mechanic"), false, "base catalog truthfully records that mechanics are dynamic/published content today");
assert.ok(blueprintCount > 0);
assert.ok(cardsWithGrammar > 0);

console.log(`ABILITY SYSTEM 2.0 FOUNDATION: PASS — ${blueprintCount} existing abilities projected across ${cardsWithGrammar}/429 cards without gameplay mutation`);
