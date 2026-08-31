import assert from "node:assert/strict";
import "./aura-2-types";
import {
  ABILITY_GRAMMAR_CATALOG,
  ABILITY_KIND_SUPPORT,
  blueprintFromPermanentStatAura,
} from "./ability-system";
import { PERMANENT_KEYWORD_AURA_CONTRACT } from "./permanent-aura-contract";
import type { CardDef } from "./types";

assert.deepEqual(
  ABILITY_GRAMMAR_CATALOG.permanentKeywordAuraContract,
  PERMANENT_KEYWORD_AURA_CONTRACT,
  "Ability Grammar exposes the same keyword Aura contract consumed by runtime/Studio",
);
assert.equal(
  ABILITY_KIND_SUPPORT.aura,
  "partial",
  "stats + keyword Auras are certified while enemy debuffs and generic layer ordering remain outside the boundary",
);

const card: CardDef = {
  defId: "aura2_grammar_probe",
  name: "Aura 2 Grammar Probe",
  region: "Ironwood",
  type: "Enchantment",
  cost: 3,
  maxHealth: 3,
  aura: {
    buffPower: 1,
    buffHealth: 2,
    keywords: ["Flying", "Hexproof"],
    races: ["Beast", "Spirit"],
    classes: ["guardian"],
  },
  description: "Allied guardian Beasts and Spirits gain stats and continuous keywords.",
  rarity: "Rare",
  emoji: "◉",
};

const blueprint = blueprintFromPermanentStatAura(card);
assert.ok(blueprint);
assert.equal(blueprint.kind, "aura");
assert.equal(blueprint.timing, "static");
assert.equal(blueprint.target, "allyUnit");
assert.deepEqual(blueprint.features, ["conditional"]);
assert.deepEqual(blueprint.rule, {
  kind: "permanentStatAura",
  aura: {
    buffPower: 1,
    buffHealth: 2,
    keywords: ["Flying", "Hexproof"],
    races: ["Beast", "Spirit"],
    classes: ["guardian"],
  },
});

console.log("AURA 2 ABILITY GRAMMAR: PASS — runtime contract and semantic projection certified");
