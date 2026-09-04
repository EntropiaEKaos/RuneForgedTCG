import assert from "node:assert/strict";
import { getDeck, validateDeck } from "./decks";
import { SEMANTIC_ALPHA_CARDS } from "./cards/semantic-alpha";

/**
 * Historical Balance 1.2 snapshot.
 *
 * Balance 1.3 and later may evolve the active canonical recipes. This test
 * preserves the exact promoted 1.2 recipes as a valid historical artifact
 * while enforcing backward-compatible structural guarantees on the active
 * starters. Exact current recipe order is owned by the newest version gate.
 */
const historicalEmber12 = [
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

const historicalFlorestia12 = [
  "forest_cub", "forest_cub", "forest_cub",
  "forest_canopy_warden", "forest_packrunner", "forest_packrunner",
  "forest_stalker", "forest_stalker",
  "forest_thornfang", "forest_thornfang",
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
  "forest_primal_recall", "forest_primal_recall",
];

for (const [id, cards] of [
  ["ember_aggro@1.2", historicalEmber12],
  ["florestia_tribal@1.2", historicalFlorestia12],
] as const) {
  assert.equal(cards.length, 40, `${id} historical snapshot must contain exactly 40 cards`);
  const legality = validateDeck(cards);
  assert.equal(legality.ok, true, `${id} historical snapshot must remain legal: ${legality.errors.join(" | ")}`);
  assert.equal(
    cards.filter((defId) => defId in SEMANTIC_ALPHA_CARDS).length,
    3,
    `${id} historical snapshot must preserve Structure + Ritual + Trap`,
  );
}

assert.equal(historicalEmber12.filter((id) => id === "ember_rain").length, 1);
assert.equal(historicalEmber12.filter((id) => id === "ember_tide_wyrm").length, 1);
assert.equal(historicalEmber12.filter((id) => id === "ember_stun").length, 3);
assert.equal(historicalFlorestia12.filter((id) => id === "forest_predator_pounce").length, 1);
assert.equal(historicalFlorestia12.filter((id) => id === "forest_moon_snare").length, 1);
assert.equal(historicalFlorestia12.filter((id) => id === "forest_pack_shelter").length, 2);
assert.equal(historicalFlorestia12.filter((id) => id === "wood_webweaver").length, 3);

for (const id of [
  "ember_aggro",
  "tide_control",
  "wood_midrange",
  "void_shadow",
  "florestia_tribal",
  "tempestade_rush",
] as const) {
  const deck = getDeck(id);
  assert.equal(deck.cards.length, 40, `${id} active starter must remain exactly 40 cards`);
  const legality = validateDeck(deck.cards);
  assert.equal(legality.ok, true, `${id} active starter must remain legal: ${legality.errors.join(" | ")}`);
}

for (const id of ["ember_aggro", "florestia_tribal"] as const) {
  const deck = getDeck(id);
  assert.equal(
    deck.cards.filter((defId) => defId in SEMANTIC_ALPHA_CARDS).length,
    3,
    `${id} active starter must preserve Structure + Ritual + Trap teaching cards`,
  );
}

console.log(
  "ALPHA STARTER BALANCE 1.2 HISTORICAL SNAPSHOT: PASS — exact 1.2 recipes archived · active starters remain legal · later version gates may evolve canonical order",
);
