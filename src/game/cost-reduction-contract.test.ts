import assert from "node:assert/strict";
import { ABILITY_GRAMMAR_CATALOG, ABILITY_KIND_SUPPORT } from "./ability-system";
import {
  COST_REDUCTION_CONTRACTS,
  COST_REDUCTION_KINDS,
  sanitizeCostReduction,
  validateAuthorableCard,
} from "./card-authoring";
import { createCustomGame, effectiveCost } from "./engine";
import type { CardDef, DeckInput } from "./types";

assert.deepEqual(COST_REDUCTION_KINDS, ["creatures", "power"]);
assert.deepEqual(COST_REDUCTION_CONTRACTS.creatures.fields, ["per", "max"]);
assert.deepEqual(COST_REDUCTION_CONTRACTS.power.fields, ["per", "threshold", "max"]);
assert.equal(COST_REDUCTION_CONTRACTS.creatures.defaults.per, 1);
assert.equal(COST_REDUCTION_CONTRACTS.power.defaults.per, 1);
assert.equal(COST_REDUCTION_CONTRACTS.power.defaults.threshold, 4);
assert.deepEqual(ABILITY_GRAMMAR_CATALOG.costReductionKinds, COST_REDUCTION_KINDS);
assert.deepEqual(ABILITY_GRAMMAR_CATALOG.costReductionContracts, COST_REDUCTION_CONTRACTS);
assert.equal(ABILITY_KIND_SUPPORT.static, "partial", "cost reduction is certified without falsely claiming every static family is generic");

assert.deepEqual(
  sanitizeCostReduction({ kind: "creatures", per: 2, max: 5 }),
  { kind: "creatures", per: 2, max: 5 },
);
assert.deepEqual(
  sanitizeCostReduction({ kind: "power", per: 2, threshold: 5, max: 6 }),
  { kind: "power", per: 2, threshold: 5, max: 6 },
);
assert.equal(
  sanitizeCostReduction({ kind: "creatures", per: 1, threshold: 4 }),
  null,
  "creatures must reject threshold because effectiveCost never consumes it",
);
assert.equal(sanitizeCostReduction({ kind: "creatures", per: 0 }), null);
assert.equal(sanitizeCostReduction({ kind: "power", threshold: -1 }), null);
assert.equal(sanitizeCostReduction({ kind: "power", max: -1 }), null);
assert.equal(sanitizeCostReduction({ kind: "unknown" }), null);

const authorableBase: CardDef = {
  defId: "cost_contract_probe",
  name: "Cost Contract Probe",
  region: "Emberhold",
  type: "Unit",
  cost: 10,
  power: 1,
  health: 1,
  description: "Static cost reduction test card.",
  rarity: "Common",
  emoji: "🧪",
};
const validCreatures = validateAuthorableCard({
  ...authorableBase,
  costReduction: { kind: "creatures", per: 2, max: 4 },
});
assert.equal(validCreatures.ok, true, "creature-count cost reduction is authorable");
const validPower = validateAuthorableCard({
  ...authorableBase,
  costReduction: { kind: "power", per: 2, threshold: 4, max: 3 },
});
assert.equal(validPower.ok, true, "power-gated cost reduction is authorable");
const invalidDeadThreshold = validateAuthorableCard({
  ...authorableBase,
  costReduction: { kind: "creatures", per: 1, threshold: 4 } as CardDef["costReduction"],
});
assert.equal(invalidDeadThreshold.ok, false, "authoring fails closed on a semantically dead creatures.threshold");

const deck: DeckInput = { id: "cost-contract", name: "Cost Contract", cards: Array(20).fill("ember_whelp") };
const state = createCustomGame("Cost Contract", deck, deck, {
  skipMulligan: true,
  playerGoesFirst: true,
  playerBench: ["wood_ent", "ember_whelp", "wood_ent"],
});

const creatureRuleCard: CardDef = {
  ...authorableBase,
  costReduction: { kind: "creatures", per: 2, max: 4 },
};
assert.equal(
  effectiveCost(state, "player", creatureRuleCard),
  6,
  "three creatures reduce by 6 but max caps the static reduction at 4",
);

const powerRuleCard: CardDef = {
  ...authorableBase,
  costReduction: { kind: "power", per: 2, threshold: 4, max: 3 },
};
assert.equal(
  effectiveCost(state, "player", powerRuleCard),
  7,
  "only the two power-qualified allies count and max caps their reduction at 3",
);

const floorCard: CardDef = {
  ...authorableBase,
  cost: 3,
  costReduction: { kind: "creatures", per: 5 },
};
assert.equal(effectiveCost(state, "player", floorCard), 0, "effective cost never becomes negative");

console.log("STATIC COST REDUCTION CONTRACT: PASS — creatures/power authoring, dead-field rejection, grammar catalog, per/threshold/max and runtime effectiveCost certified");
