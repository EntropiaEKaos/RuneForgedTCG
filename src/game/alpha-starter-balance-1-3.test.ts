import assert from "node:assert/strict";
import { getDeck, validateDeck } from "./decks";
import { SEMANTIC_ALPHA_CARDS } from "./cards/semantic-alpha";

const expectedEmber = [
  "ember_ashguard", "ember_whelp", "ember_whelp",
  "ember_drake", "ember_drake", "ember_drake",
  "ember_herald", "ember_herald",
  "ember_raider", "ember_raider",
  "ember_duelist", "ember_duelist",
  "ember_zealot", "ember_zealot",
  "ember_sire", "ember_ashguard",
  "ember_rain", "ember_tide_wyrm",
  "ember_stun", "ember_bolt", "ember_bolt",
  "ember_face", "rfalpha_ember_ritual_red_rite",
  "ember_blade", "ember_blade",
  "ember_soulblade",
  "ember_stun", "ember_flare_line",
  "ember_hearth",
  "rfalpha_ember_structure_forge_bastion",
  "ember_phantom", "ember_phantom",
  "ember_lastbreath", "rfalpha_ember_trap_ash_snare",
  "ember_stun",
  "ember_sprinter", "ember_sprinter",
  "ember_swarmlord",
  "ember_champion", "ember_champion",
];

const expectedFlorestia = [
  "forest_cub", "forest_cub", "forest_cub",
  "forest_canopy_warden", "forest_packrunner", "forest_packrunner",
  "forest_stalker", "forest_stalker",
  "forest_spirit_guide", "forest_thornfang",
  "wood_webweaver", "forest_alpha",
  "forest_champion", "forest_champion",
  "forest_pack_howl", "rfalpha_forest_ritual_green_moon",
  "forest_summon_pack", "forest_summon_pack",
  "forest_entangle", "forest_entangle", "rfalpha_forest_trap_pack_ambush",
  "forest_enchantment", "rfalpha_forest_structure_ancestral_den",
  "wood_growth", "wood_growth",
  "wood_mend", "wood_mend",
  "wood_ward", "wood_ward",
  "forest_ambush",
  "forest_canopy_warden", "wood_webweaver",
  "forest_dawn_alpha",
  "forest_pack_shelter",
  "forest_pack_shelter", "forest_moon_snare",
  "wood_webweaver", "forest_predator_pounce",
  "forest_canopy_warden", "forest_primal_recall",
];

const ember = getDeck("ember_aggro");
const florestia = getDeck("florestia_tribal");

assert.deepEqual(
  ember.cards,
  expectedEmber,
  "Emberhold Blitz 1.3 must preserve the exact certified 1.2 recipe",
);
assert.deepEqual(
  florestia.cards,
  expectedFlorestia,
  "Matilha da Florestia 1.3 must preserve the exact promoted deterministic recipe order",
);

for (const deck of [ember, florestia]) {
  assert.equal(deck.cards.length, 40, `${deck.id} must remain exactly 40 cards`);
  const legality = validateDeck(deck.cards);
  assert.equal(legality.ok, true, `${deck.id} must remain legal: ${legality.errors.join(" | ")}`);
  assert.equal(
    deck.cards.filter((defId) => defId in SEMANTIC_ALPHA_CARDS).length,
    3,
    `${deck.id} must preserve exactly Structure + Ritual + Trap teaching cards`,
  );
}

assert.equal(florestia.cards.filter((id) => id === "forest_canopy_warden").length, 3);
assert.equal(florestia.cards.filter((id) => id === "forest_spirit_guide").length, 1);
assert.equal(florestia.cards.filter((id) => id === "forest_thornfang").length, 1);
assert.equal(florestia.cards.filter((id) => id === "forest_primal_recall").length, 1);
assert.equal(florestia.cards.filter((id) => id === "forest_predator_pounce").length, 1);
assert.equal(florestia.cards.filter((id) => id === "forest_moon_snare").length, 1);
assert.equal(florestia.cards.filter((id) => id === "forest_pack_shelter").length, 2);
assert.equal(florestia.cards.filter((id) => id === "wood_webweaver").length, 3);

for (const id of ["tide_control", "wood_midrange", "void_shadow", "tempestade_rush"] as const) {
  const deck = getDeck(id);
  assert.equal(deck.cards.length, 40, `${id} must remain a 40-card starter`);
  assert.equal(validateDeck(deck.cards).ok, true, `${id} must remain legal after recipe 1.3 promotion`);
}

console.log(
  "ALPHA STARTER BALANCE 1.3 RECIPE: PASS — exact Florestia promotion · Ember 1.2 preserved · 40 cards · legal regions/copies · Structure/Ritual/Trap preserved",
);
