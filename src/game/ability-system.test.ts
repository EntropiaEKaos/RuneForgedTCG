import assert from "node:assert/strict";
import {
  ABILITY_GRAMMAR_CATALOG,
  ABILITY_GRAMMAR_VERSION,
  ABILITY_KIND_SUPPORT,
  abilityBlueprintsForCard,
  blueprintFromActivatedAbility,
  blueprintFromMechanic,
} from "./ability-system";
import { baseCardsOnly } from "./cards";
import type { ActivatedAbility } from "./activated-ability-types";
import type { CardMechanic } from "./types";

assert.equal(ABILITY_GRAMMAR_VERSION, 2);
assert.equal(ABILITY_GRAMMAR_CATALOG.version, 2);
assert.equal(ABILITY_KIND_SUPPORT.keyword, "supported");
assert.equal(ABILITY_KIND_SUPPORT.triggered, "supported");
assert.equal(ABILITY_KIND_SUPPORT.activated, "supported");
assert.equal(ABILITY_KIND_SUPPORT.transformation, "supported");
assert.equal(ABILITY_KIND_SUPPORT.modal, "planned");
assert.equal(ABILITY_KIND_SUPPORT.replacement, "planned");
assert.equal(ABILITY_KIND_SUPPORT.delayed, "planned");

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

const mechanic: CardMechanic = {
  key: "ability_system_probe",
  name: "Probe condicional",
  trigger: "onSummon",
  condition: { kind: "manaAtLeast", amount: 3 },
  effect: { kind: "draw", amount: 1, target: "none" },
};
const mechanicBlueprint = blueprintFromMechanic(mechanic);
assert.equal(mechanicBlueprint.kind, "triggered");
assert.equal(mechanicBlueprint.timing, "automatic");
assert.equal(mechanicBlueprint.trigger, "onSummon");
assert.deepEqual(mechanicBlueprint.features, ["conditional"]);

const cards = baseCardsOnly();
assert.equal(cards.length, 429, "Ability grammar certification covers the complete canonical 429-card catalog");

let blueprintCount = 0;
let cardsWithGrammar = 0;
const origins = new Set<string>();
for (const card of cards) {
  const before = JSON.stringify(card);
  const blueprints = abilityBlueprintsForCard(card);
  const expected =
    (card.keywords?.length ?? 0) +
    (card.trigger ? 1 : 0) +
    (card.mechanics?.length ?? 0) +
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
    origins.add(blueprint.origin);
  }
}

for (const origin of ["keyword", "legacyTrigger", "mechanic", "activated", "sentinela", "levelUp"]) {
  assert.ok(origins.has(origin), `canonical catalog exercises ${origin} compatibility`);
}
assert.ok(blueprintCount > 0);
assert.ok(cardsWithGrammar > 0);

console.log(`ABILITY SYSTEM 2.0 FOUNDATION: PASS — ${blueprintCount} existing abilities projected across ${cardsWithGrammar}/429 cards without gameplay mutation`);
