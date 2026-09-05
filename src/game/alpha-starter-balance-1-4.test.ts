import assert from "node:assert/strict";
import { getDeck, validateDeck } from "./decks";
import { SEMANTIC_ALPHA_CARDS } from "./cards/semantic-alpha";

const expectedTide = [
  "tide_sprite", "tide_sprite", "tide_sprite",
  "tide_oracle", "tide_oracle",
  "tide_guard", "tide_guard",
  "tide_mystic", "tide_mystic",
  "tide_bladedancer", "tide_cloudpiercer",
  "tide_freeze", "tide_freeze",
  "tide_draw", "rfalpha_tide_ritual_memory_tide",
  "tide_heal", "tide_heal",
  "tide_shield", "tide_shield",
  "tide_caller", "tide_caller",
  "tide_wood_chorus", "tide_wood_chorus",
  "tide_anchor", "rfalpha_tide_structure_silent_beacon",
  "tide_mirror",
  "tide_recall", "tide_dispel",
  "tide_tidecaller",
  "tide_guard",
  "tide_champion", "tide_champion",
  "tide_deny", "rfalpha_tide_trap_countercurrent",
  "tide_frostbite", "tide_frostbite",
  "tide_stun", "tide_stun",
  "tide_recall",
  "tide_hexspirit",
];

const tide = getDeck("tide_control");

assert.deepEqual(
  tide.cards,
  expectedTide,
  "Tidecall Control 1.4 must preserve the exact promoted deterministic recipe order",
);
assert.equal(tide.cards.length, 40, "Tidecall 1.4 must remain exactly 40 cards");

const legality = validateDeck(tide.cards);
assert.equal(legality.ok, true, `Tidecall 1.4 must remain legal: ${legality.errors.join(" | ")}`);

assert.equal(
  tide.cards.filter((defId) => defId in SEMANTIC_ALPHA_CARDS).length,
  3,
  "Tidecall 1.4 must preserve exactly Structure + Ritual + Trap teaching cards",
);

assert.equal(tide.cards.filter((id) => id === "tide_dispel").length, 1);
assert.equal(tide.cards.filter((id) => id === "tide_recall").length, 2);
assert.equal(tide.cards.filter((id) => id === "tide_heal").length, 2);
assert.equal(tide.cards.filter((id) => id === "tide_frostbite").length, 2);
assert.equal(tide.cards.filter((id) => id === "tide_stun").length, 2);

for (const id of [
  "ember_aggro",
  "wood_midrange",
  "void_shadow",
  "florestia_tribal",
  "tempestade_rush",
] as const) {
  const deck = getDeck(id);
  assert.equal(deck.cards.length, 40, `${id} must remain a 40-card starter`);
  const activeLegality = validateDeck(deck.cards);
  assert.equal(activeLegality.ok, true, `${id} must remain legal after Tide 1.4 promotion`);
}

console.log(
  "ALPHA STARTER BALANCE 1.4 RECIPE: PASS — Tide Dispel->Recall promoted · exact 40-card order · legal · Structure/Ritual/Trap preserved",
);
