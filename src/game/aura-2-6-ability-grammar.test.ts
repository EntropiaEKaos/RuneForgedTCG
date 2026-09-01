import assert from "node:assert/strict";
import "./aura-2-types";
import {
  ABILITY_GRAMMAR_CATALOG,
  ABILITY_KIND_SUPPORT,
  abilityBlueprintsForCard,
  blueprintFromPermanentStatAura,
} from "./ability-system";
import { CONDITIONAL_AURA_CONTRACT } from "./aura-condition-contract";
import type { CardDef, MechanicCondition, PermanentStatAura } from "./types";

function auraCard(aura: PermanentStatAura, defId: string): CardDef {
  return {
    defId,
    name: defId,
    region: "Ironwood",
    type: "Enchantment",
    cost: 3,
    aura,
    description: "Aura 2.6 grammar probe.",
    rarity: "Rare",
    emoji: "🜁",
  };
}

assert.deepEqual(
  ABILITY_GRAMMAR_CATALOG.conditionalAuraContract,
  CONDITIONAL_AURA_CONTRACT,
  "Ability Grammar publishes the same conditional Aura contract used by runtime/authoring",
);

const sourceCondition: MechanicCondition = {
  kind: "and",
  children: [
    { kind: "allyRace", race: "Beast", min: 2 },
    { kind: "not", child: { kind: "manaAtLeast", amount: 8 } },
  ],
};
const conditionalCard = auraCard({
  buffPower: 1,
  buffHealth: 1,
  keywords: ["Flying"],
  races: ["Beast"],
  condition: sourceCondition,
}, "aura26_conditional_ally");
const conditionalBlueprint = blueprintFromPermanentStatAura(conditionalCard);
assert.ok(conditionalBlueprint);
assert.equal(conditionalBlueprint.kind, "aura");
assert.equal(conditionalBlueprint.timing, "static");
assert.equal(conditionalBlueprint.target, "allyUnit");
assert.deepEqual(conditionalBlueprint.features, ["conditional"]);
assert.deepEqual(conditionalBlueprint.condition, sourceCondition, "source condition is projected into the canonical blueprint field");
assert.notEqual(conditionalBlueprint.condition, sourceCondition, "blueprint condition is defensively cloned from CardDef");
assert.equal(conditionalBlueprint.rule?.kind, "permanentStatAura");
if (conditionalBlueprint.rule?.kind !== "permanentStatAura") throw new Error("expected Aura rule");
assert.deepEqual(conditionalBlueprint.rule.aura, {
  buffPower: 1,
  buffHealth: 1,
  keywords: ["Flying"],
  races: ["Beast"],
  condition: sourceCondition,
});
assert.notEqual(conditionalBlueprint.rule.aura.condition, sourceCondition, "rule payload owns an independent condition tree");
assert.notEqual(conditionalBlueprint.rule.aura.condition, conditionalBlueprint.condition, "blueprint metadata and rule payload do not alias each other");

// Mutation isolation is part of the read-only introspection guarantee.
if (conditionalBlueprint.condition.kind !== "and") throw new Error("expected AND condition");
conditionalBlueprint.condition.children[0] = { kind: "always" };
assert.equal(sourceCondition.kind, "and");
assert.equal(sourceCondition.children[0].kind, "allyRace", "mutating a blueprint cannot mutate the source CardDef condition");
if (conditionalBlueprint.rule.aura.condition?.kind !== "and") throw new Error("expected cloned AND rule condition");
assert.equal(conditionalBlueprint.rule.aura.condition.children[0].kind, "allyRace", "metadata mutation cannot mutate the separately cloned rule condition");

// Legacy unconditioned Auras preserve the historical always-active projection.
const legacyCard = auraCard({ buffPower: 1, buffHealth: 0 }, "aura26_legacy");
const legacyBlueprint = blueprintFromPermanentStatAura(legacyCard);
assert.ok(legacyBlueprint);
assert.deepEqual(legacyBlueprint.condition, { kind: "always" });
assert.deepEqual(legacyBlueprint.features, []);
assert.equal(legacyBlueprint.rule?.kind, "permanentStatAura");
if (legacyBlueprint.rule?.kind !== "permanentStatAura") throw new Error("expected legacy Aura rule");
assert.equal("condition" in legacyBlueprint.rule.aura, false, "legacy rule payload does not invent an explicit condition");

// Target filters remain a conditional feature even when the source itself is always active.
const filteredCard = auraCard({ buffPower: 0, buffHealth: 2, classes: ["guardian"] }, "aura26_filtered");
const filteredBlueprint = blueprintFromPermanentStatAura(filteredCard);
assert.ok(filteredBlueprint);
assert.deepEqual(filteredBlueprint.condition, { kind: "always" });
assert.deepEqual(filteredBlueprint.features, ["conditional"], "target eligibility filters keep the existing conditional feature marker");

// Hostile conditional Auras preserve target direction and suppression payload.
const hostileCondition: MechanicCondition = { kind: "nexusBelow", amount: 10 };
const hostileCard = auraCard({
  buffPower: -1,
  buffHealth: 0,
  affects: "enemies",
  suppressKeywords: ["Hexproof"],
  condition: hostileCondition,
}, "aura26_hostile");
const hostileBlueprint = blueprintFromPermanentStatAura(hostileCard);
assert.ok(hostileBlueprint);
assert.equal(hostileBlueprint.target, "enemyUnit");
assert.deepEqual(hostileBlueprint.condition, hostileCondition);
assert.deepEqual(hostileBlueprint.features, ["conditional"]);
assert.equal(hostileBlueprint.rule?.kind, "permanentStatAura");
if (hostileBlueprint.rule?.kind !== "permanentStatAura") throw new Error("expected hostile Aura rule");
assert.deepEqual(hostileBlueprint.rule.aura, {
  buffPower: -1,
  buffHealth: 0,
  affects: "enemies",
  suppressKeywords: ["Hexproof"],
  condition: hostileCondition,
});

const projected = abilityBlueprintsForCard(hostileCard).find((blueprint) => blueprint.origin === "aura");
assert.ok(projected, "card-level grammar enumeration exposes the conditional Aura blueprint");
assert.deepEqual(projected.condition, hostileCondition);

assert.equal(
  ABILITY_KIND_SUPPORT.aura,
  "partial",
  "conditional introspection does not claim a generic cross-family continuous layer engine",
);

console.log("AURA 2.6 ABILITY GRAMMAR: PASS — condition catalog, projection, isolation, legacy compatibility and hostile direction certified");
