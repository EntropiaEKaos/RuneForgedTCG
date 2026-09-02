import assert from "node:assert/strict";
import { buildVanillaContentAudit } from "./vanilla-content-audit";
import { VANILLA_EXPERIMENTAL_DECKS } from "./vanilla-experimental-decks";

const report = buildVanillaContentAudit();
assert.equal(report.gate, "pass", report.errors.join("\n"));
assert.equal(report.experimentalUniqueCards, 180);
assert.deepEqual(report.uncoveredExperimentalCardIds, []);

const audited = new Map(report.decks.map((deck) => [deck.id, deck] as const));
const source = VANILLA_EXPERIMENTAL_DECKS.find((deck) => deck.id === "vanilla_forest_2");
const deck = audited.get("vanilla_forest_2");
assert.ok(deck, "missing Florestia Ascendant audit");
assert.ok(source, "missing Florestia Ascendant source recipe");

assert.equal(deck.cards, 40, "Florestia Ascendant must remain a 40-card deck");
assert.equal(deck.uniqueCards, 30, "all 30 regional cards must remain represented");
assert.equal(deck.types.Unit, 28, "five tripled Units must produce 28 Unit copies total");
assert.equal(deck.types.Spell, 8, "all eight regional Spells remain singletons");
assert.equal((deck.types.Enchantment ?? 0) + (deck.types.Artifact ?? 0) + (deck.types.Equipment ?? 0), 4, "all four regional permanents remain represented");
assert.equal(source.cards.length, 40);
assert.equal(new Set(source.cards).size, 30);
assert.ok(Object.values(deck.duplicateCopies).every((count) => count <= 3), "runtime three-copy ceiling exceeded");

const tripled = Object.entries(deck.duplicateCopies)
  .filter(([, count]) => count === 3)
  .map(([defId]) => defId)
  .sort();
const doubled = Object.entries(deck.duplicateCopies)
  .filter(([, count]) => count === 2)
  .map(([defId]) => defId)
  .sort();

assert.deepEqual(tripled, [
  "van_forest_u11",
  "van_forest_u13",
  "van_forest_u14",
  "van_forest_u16",
  "van_forest_u17",
].sort(), "Florestia 1.8 five-card finisher core drifted");
assert.deepEqual(doubled, [], "Florestia 1.8 should use all ten duplicate slots as five tripled Units");

for (const defId of ["van_forest_u03", "van_forest_u05", "van_forest_u08", "van_forest_u18"]) {
  assert.equal(deck.duplicateCopies[defId], undefined, `${defId} must return to singleton coverage in Vanilla 1.8`);
}

console.log("Vanilla 1.8 Florestia Ascendant floor recipe: PASS");
