import assert from "node:assert/strict";
import { buildVanillaContentAudit } from "./vanilla-content-audit";
import { VANILLA_EXPERIMENTAL_DECKS } from "./vanilla-experimental-decks";

const report = buildVanillaContentAudit();
assert.equal(report.gate, "pass", report.errors.join("\n"));
assert.equal(report.experimentalUniqueCards, 180);
assert.deepEqual(report.uncoveredExperimentalCardIds, []);

const audited = new Map(report.decks.map((deck) => [deck.id, deck] as const));
const source = new Map(VANILLA_EXPERIMENTAL_DECKS.map((deck) => [deck.id, deck] as const));

const ember = audited.get("vanilla_ember_1");
assert.ok(ember, "missing Emberhold Vanguard audit");
assert.equal(ember.cards, 40);
assert.equal(ember.uniqueCards, 21);
assert.equal(ember.types.Unit, 35);
assert.equal(ember.types.Spell, 5);
assert.equal(ember.duplicateCopies.van_ember_u13, undefined, "u13 must be a singleton in Vanilla 1.7");
assert.equal(ember.duplicateCopies.van_ember_s04, undefined, "s04 must be the singleton interaction replacement");
assert.equal(ember.duplicateCopies.van_ember_s01, 2);
assert.equal(ember.duplicateCopies.van_ember_s02, 2);

const evolved = {
  vanilla_wood_2: {
    tripled: ["van_wood_u03", "van_wood_u08", "van_wood_u11", "van_wood_u13", "van_wood_u18"],
    doubled: [],
  },
  vanilla_void_2: {
    tripled: ["van_void_u03", "van_void_u08", "van_void_u11", "van_void_u13", "van_void_u18"],
    doubled: [],
  },
  vanilla_forest_2: {
    tripled: ["van_forest_u08", "van_forest_u11", "van_forest_u13"],
    doubled: ["van_forest_u03", "van_forest_u05", "van_forest_u14", "van_forest_u18"],
  },
} as const;

for (const [deckId, policy] of Object.entries(evolved)) {
  const deck = audited.get(deckId);
  assert.ok(deck, `${deckId}: missing audit`);
  assert.equal(deck.cards, 40, `${deckId}: size drifted`);
  assert.equal(deck.uniqueCards, 30, `${deckId}: all regional cards must remain represented`);
  assert.equal(deck.types.Unit, 28, `${deckId}: evolved recipe must keep 28 Units`);
  assert.equal(deck.types.Spell, 8, `${deckId}: evolved recipe must keep all eight Spells represented`);
  assert.equal((deck.types.Enchantment ?? 0) + (deck.types.Artifact ?? 0) + (deck.types.Equipment ?? 0), 4, `${deckId}: permanent coverage drifted`);
  assert.ok(Object.values(deck.duplicateCopies).every((count) => count <= 3), `${deckId}: runtime three-copy ceiling exceeded`);

  const tripled = Object.entries(deck.duplicateCopies)
    .filter(([, count]) => count === 3)
    .map(([defId]) => defId)
    .sort();
  const doubled = Object.entries(deck.duplicateCopies)
    .filter(([, count]) => count === 2)
    .map(([defId]) => defId)
    .sort();
  assert.deepEqual(tripled, [...policy.tripled].sort(), `${deckId}: evidence-selected three-copy core drifted`);
  assert.deepEqual(doubled, [...policy.doubled].sort(), `${deckId}: evidence-selected two-copy support drifted`);

  const recipe = source.get(deckId);
  assert.ok(recipe, `${deckId}: missing source recipe`);
  assert.equal(recipe.cards.length, 40);
  assert.equal(new Set(recipe.cards).size, 30);
}

console.log("Vanilla 1.7 regional recipe ceiling/floor contract: PASS");
