import assert from "node:assert/strict";
import { getCard } from "./cards";
import { buildVanillaContentAudit } from "./vanilla-content-audit";
import { VANILLA_EXPERIMENTAL_DECKS } from "./vanilla-experimental-decks";

const report = buildVanillaContentAudit();
assert.equal(report.gate, "pass", report.errors.join("\n"));
assert.equal(report.experimentalUniqueCards, 180, "Vanilla 1.9 must preserve the 180-card experimental pool");
assert.deepEqual(report.uncoveredExperimentalCardIds, [], "Vanilla 1.9 must keep all experimental definitions represented");

const audited = new Map(report.decks.map((deck) => [deck.id, deck] as const));
const source = VANILLA_EXPERIMENTAL_DECKS.find((deck) => deck.id === "vanilla_forest_2");
const deck = audited.get("vanilla_forest_2");
assert.ok(source, "missing Florestia Ascendant source recipe");
assert.ok(deck, "missing Florestia Ascendant audit");

assert.equal(source.cards.length, 40, "Florestia Ascendant must remain a 40-card deck");
assert.equal(new Set(source.cards).size, 30, "Florestia Ascendant must retain all 30 regional definitions");
for (const defId of source.cards) getCard(defId);

assert.equal(deck.cards, 40);
assert.equal(deck.uniqueCards, 30);
assert.equal(deck.types.Unit, 28, "five tripled Units must still produce 28 Unit copies total");
assert.equal(deck.types.Spell, 8, "all eight regional Spells remain singletons");
assert.equal(
  (deck.types.Enchantment ?? 0) + (deck.types.Artifact ?? 0) + (deck.types.Equipment ?? 0),
  4,
  "all four regional permanents remain represented",
);
assert.ok(Object.values(deck.duplicateCopies).every((count) => count <= 3), "runtime three-copy ceiling exceeded");

const tripled = Object.entries(deck.duplicateCopies)
  .filter(([, count]) => count === 3)
  .map(([defId]) => defId)
  .sort();
const doubled = Object.entries(deck.duplicateCopies)
  .filter(([, count]) => count === 2)
  .map(([defId]) => defId)
  .sort();

assert.deepEqual(
  tripled,
  [
    "van_forest_u04",
    "van_forest_u05",
    "van_forest_u13",
    "van_forest_u14",
    "van_forest_u16",
  ].sort(),
  "Vanilla 1.9 Florestia five-card pressure/finisher core drifted",
);
assert.deepEqual(doubled, [], "Vanilla 1.9 must use all ten duplicate slots as five tripled Units");

for (const defId of ["van_forest_u11", "van_forest_u17"]) {
  assert.equal(deck.duplicateCopies[defId], undefined, `${defId} must be singleton coverage in Vanilla 1.9`);
  assert.equal(source.cards.filter((id) => id === defId).length, 1, `${defId} must occur exactly once in the active recipe`);
}
for (const defId of ["van_forest_u04", "van_forest_u05", "van_forest_u13", "van_forest_u14", "van_forest_u16"]) {
  assert.equal(source.cards.filter((id) => id === defId).length, 3, `${defId} must occur exactly three times in the active recipe`);
}

console.log(
  "VANILLA 1.9 FLOOR CONVERGENCE: PASS — Florestia wide u04/u05 pressure core · 40 cards · 30/30 coverage · three-copy ceiling preserved",
);
