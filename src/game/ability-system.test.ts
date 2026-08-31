import assert from "node:assert/strict";
import {
  ABILITY_FEATURE_SUPPORT,
  ABILITY_GRAMMAR_CATALOG,
  ABILITY_GRAMMAR_VERSION,
  ABILITY_KIND_SUPPORT,
  ABILITY_TIMING_SUPPORT,
  abilityBlueprintsForCard,
  blueprintFromActivatedAbility,
  blueprintFromCostReduction,
  blueprintFromEquipment,
  blueprintFromKeyword,
  blueprintFromLegacyTrigger,
  blueprintFromMechanic,
  blueprintFromPermanentStatAura,
  blueprintFromReactionSpell,
} from "./ability-system";
import { baseCardsOnly, getCard } from "./cards";
import {
  CONDITION_AUTHORING_CONTRACT,
  CONDITION_RUNTIME_SUPPORT,
} from "./condition-contract";
import { CANONICAL_KEYWORDS, KEYWORD_INFO } from "./keywords";
import { PERMANENT_STAT_AURA_CONTRACT } from "./permanent-aura-contract";
import {
  COMBAT_TRIGGER_EVENTS,
  TRIGGER_TIMING_BY_EVENT,
  triggerTiming,
} from "./trigger-contract";
import type { ActivatedAbility } from "./activated-ability-types";
import type { CardDef, CardMechanic } from "./types";

assert.equal(ABILITY_GRAMMAR_VERSION, 2);
assert.equal(ABILITY_GRAMMAR_CATALOG.version, 2);
assert.deepEqual(ABILITY_GRAMMAR_CATALOG.rules, ["costReduction", "equipmentAttachment", "permanentStatAura"]);
assert.deepEqual(ABILITY_GRAMMAR_CATALOG.permanentStatAuraContract, PERMANENT_STAT_AURA_CONTRACT);
assert.deepEqual(ABILITY_GRAMMAR_CATALOG.triggerTiming, TRIGGER_TIMING_BY_EVENT);
assert.deepEqual(ABILITY_GRAMMAR_CATALOG.keywords, CANONICAL_KEYWORDS);
assert.deepEqual(ABILITY_GRAMMAR_CATALOG.keywordContracts, KEYWORD_INFO);
assert.deepEqual(ABILITY_GRAMMAR_CATALOG.conditionContracts, CONDITION_RUNTIME_SUPPORT);
assert.deepEqual(ABILITY_GRAMMAR_CATALOG.conditionAuthoring, CONDITION_AUTHORING_CONTRACT);
assert.equal(ABILITY_KIND_SUPPORT.keyword, "supported");
assert.equal(ABILITY_KIND_SUPPORT.triggered, "supported");
assert.equal(ABILITY_KIND_SUPPORT.activated, "supported");
assert.equal(ABILITY_KIND_SUPPORT.reaction, "supported");
assert.equal(ABILITY_KIND_SUPPORT.transformation, "supported");
assert.equal(ABILITY_KIND_SUPPORT.static, "partial");
assert.equal(ABILITY_KIND_SUPPORT.aura, "partial", "stat Aura is a supported slice; generic continuous Aura layering remains partial");
assert.equal(ABILITY_KIND_SUPPORT.linked, "partial");
assert.equal(ABILITY_KIND_SUPPORT.modal, "planned");
assert.equal(ABILITY_KIND_SUPPORT.replacement, "planned");
assert.equal(ABILITY_KIND_SUPPORT.delayed, "planned");
assert.equal(ABILITY_FEATURE_SUPPORT.conditional, "supported");
assert.equal(ABILITY_FEATURE_SUPPORT.chained, "supported");
assert.equal(ABILITY_FEATURE_SUPPORT.repeatable, "supported");
assert.equal(ABILITY_FEATURE_SUPPORT.targeted, "supported");
assert.equal(ABILITY_TIMING_SUPPORT.static, "supported");
assert.equal(ABILITY_TIMING_SUPPORT.combat, "partial", "generic combat timing remains partial beyond the supported trigger subset");
assert.equal(ABILITY_TIMING_SUPPORT.reaction, "supported");
assert.equal(ABILITY_TIMING_SUPPORT.priority, "planned");
assert.deepEqual(COMBAT_TRIGGER_EVENTS, ["onAttack", "onBlock", "onStrike", "onNexusStrike"]);
for (const when of ABILITY_GRAMMAR_CATALOG.triggers) {
  const expectedTiming: "automatic" | "combat" = (COMBAT_TRIGGER_EVENTS as readonly string[]).includes(when) ? "combat" : "automatic";
  assert.equal(triggerTiming(when), expectedTiming, `${when} uses the canonical semantic trigger timing`);
}
for (const condition of ABILITY_GRAMMAR_CATALOG.conditions) {
  assert.equal(ABILITY_GRAMMAR_CATALOG.conditionContracts[condition], "supported", `${condition} is backed by the runtime condition evaluator`);
}

for (const keyword of CANONICAL_KEYWORDS) {
  const blueprint = blueprintFromKeyword(keyword);
  const contract = KEYWORD_INFO[keyword];
  assert.equal(blueprint.origin, "keyword");
  assert.equal(blueprint.kind, "keyword");
  assert.equal(blueprint.timing, "static");
  assert.equal(blueprint.keyword, keyword);
  assert.equal(blueprint.description, contract.desc);
  assert.deepEqual(blueprint.keywordContract, {
    support: "supported",
    runtimeDomains: [...contract.runtimeDomains],
    grantable: contract.grantable,
    ...(contract.requiresTrigger ? { requiresTrigger: contract.requiresTrigger } : {}),
  });
}
const lastBreathBlueprint = blueprintFromKeyword("LastBreath");
assert.deepEqual(lastBreathBlueprint.keywordContract, {
  support: "supported",
  runtimeDomains: ["death"],
  grantable: false,
  requiresTrigger: "onDeath",
});
assert.deepEqual(blueprintFromKeyword("Hexproof").keywordContract?.runtimeDomains, ["targeting"]);
assert.deepEqual(blueprintFromKeyword("Challenger").keywordContract?.runtimeDomains, ["attack", "blocking"]);
assert.deepEqual(blueprintFromKeyword("Ephemeral").keywordContract?.runtimeDomains, ["strike", "round"]);

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
const combatMechanicBlueprint = blueprintFromMechanic({ ...mechanic, key: "ability_system_combat_probe", trigger: "onAttack" });
assert.equal(combatMechanicBlueprint.timing, "combat", "Mechanics Studio combat triggers use the same timing contract as legacy triggers");

const pyra = getCard("ember_champion_2");
assert.ok(pyra.trigger, "canonical Pyra stage 2 must retain Nexus Strike");
assert.equal(blueprintFromLegacyTrigger(pyra.trigger).timing, "combat", "Nexus Strike is projected inside combat timing");
const magmaEgg = getCard("ember_lastbreath");
assert.ok(magmaEgg.trigger, "canonical Magma Egg must retain Last Breath");
assert.equal(blueprintFromLegacyTrigger(magmaEgg.trigger).timing, "automatic", "death triggers remain automatic because they can resolve outside combat");
const soulbrand = getCard("ember_soulblade");
assert.ok(soulbrand.trigger, "canonical Soulbrand must retain Kill trigger");
assert.equal(blueprintFromLegacyTrigger(soulbrand.trigger).timing, "automatic", "kill triggers remain automatic because cleanup provenance is not combat-only");

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

const authoredAura: CardDef = {
  defId: "ability_aura_probe",
  name: "Aura Probe",
  region: "Ironwood",
  type: "Enchantment",
  cost: 3,
  maxHealth: 3,
  aura: { buffPower: 1, buffHealth: 2, races: ["Beast", "Spirit"], classes: ["guardian"] },
  description: "Allied guardian Beasts and Spirits get +1/+2 while this remains in play.",
  rarity: "Rare",
  emoji: "◉",
};
const auraBlueprint = blueprintFromPermanentStatAura(authoredAura);
assert.ok(auraBlueprint, "authorable permanent stat Aura projects into Ability Grammar 2.0");
assert.equal(auraBlueprint.origin, "aura");
assert.equal(auraBlueprint.kind, "aura");
assert.equal(auraBlueprint.timing, "static");
assert.equal(auraBlueprint.target, "allyUnit");
assert.deepEqual(auraBlueprint.features, ["conditional"]);
assert.deepEqual(auraBlueprint.rule, {
  kind: "permanentStatAura",
  aura: { buffPower: 1, buffHealth: 2, races: ["Beast", "Spirit"], classes: ["guardian"] },
});
assert.equal(blueprintFromPermanentStatAura({ ...authoredAura, type: "Unit" }), null, "Aura projection fails closed on unsupported source types");
assert.equal(blueprintFromPermanentStatAura({ ...authoredAura, aura: undefined }), null, "Aura projection requires an explicit Aura contract");

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
assert.equal(cards.filter((card) => card.aura).length, 0, "existing Round Start buffs remain triggers instead of being silently reinterpreted as continuous Auras");

let blueprintCount = 0;
let cardsWithGrammar = 0;
let combatTimedTriggers = 0;
let keywordBlueprints = 0;
const origins = new Set<string>();
const ruleKinds = new Set<string>();
for (const card of cards) {
  const before = JSON.stringify(card);
  const blueprints = abilityBlueprintsForCard(card);
  const expected =
    (card.keywords?.length ?? 0) +
    (card.costReduction ? 1 : 0) +
    (card.type === "Equipment" && card.equipment ? 1 : 0) +
    ((card.type === "Enchantment" || card.type === "Artifact") && card.aura ? 1 : 0) +
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
    for (const feature of blueprint.features) {
      assert.equal(ABILITY_GRAMMAR_CATALOG.featureSupport[feature], "supported", `${card.defId} only projects certified ability features`);
    }
    if (blueprint.effect) assert.equal(blueprint.target, blueprint.effect.target, `${card.defId} keeps effect targeting authoritative`);
    if (blueprint.keyword) {
      const contract = KEYWORD_INFO[blueprint.keyword];
      assert.ok(blueprint.keywordContract, `${card.defId} keyword exposes its runtime contract`);
      assert.equal(blueprint.keywordContract?.support, "supported");
      assert.deepEqual(blueprint.keywordContract?.runtimeDomains, [...contract.runtimeDomains]);
      assert.equal(blueprint.keywordContract?.grantable, contract.grantable);
      assert.equal(blueprint.keywordContract?.requiresTrigger, contract.requiresTrigger);
      keywordBlueprints += 1;
    }
    if (blueprint.trigger) {
      assert.equal(blueprint.timing, triggerTiming(blueprint.trigger), `${card.defId} trigger timing matches the authoritative trigger timing contract`);
      if (blueprint.timing === "combat") combatTimedTriggers += 1;
    }
    if (blueprint.rule) {
      assert.ok(ABILITY_GRAMMAR_CATALOG.rules.includes(blueprint.rule.kind), `${card.defId} uses a canonical persistent rule kind`);
      ruleKinds.add(blueprint.rule.kind);
    }
    origins.add(blueprint.origin);
  }
}

// These origins are genuinely present in the static catalog today. Dynamic
// Mechanics Studio and Aura compatibility are proven by dedicated probes above.
for (const origin of ["keyword", "costReduction", "equipment", "legacyTrigger", "spell", "activated", "sentinela", "levelUp"]) {
  assert.ok(origins.has(origin), `canonical catalog exercises ${origin} compatibility`);
}
assert.deepEqual([...ruleKinds].sort(), ["costReduction", "equipmentAttachment"]);
assert.equal(origins.has("mechanic"), false, "base catalog truthfully records that mechanics are dynamic/published content today");
assert.equal(origins.has("aura"), false, "base catalog truthfully records that continuous Aura is authored/published content today");
assert.ok(blueprintCount > 0);
assert.ok(cardsWithGrammar > 0);
assert.ok(keywordBlueprints > 0, "canonical catalog exercises keyword runtime contracts");
assert.ok(combatTimedTriggers > 0, "canonical catalog contains combat-timed trigger abilities");

console.log(`ABILITY SYSTEM 2.0 FOUNDATION: PASS — ${blueprintCount} existing abilities projected across ${cardsWithGrammar}/429 cards without gameplay mutation · ${keywordBlueprints} keyword contracts · ${combatTimedTriggers} combat-timed triggers · permanent stat Aura contract certified`);
