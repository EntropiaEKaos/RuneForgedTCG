import assert from "node:assert/strict";
import { buildVanillaContentAudit } from "./vanilla-content-audit";
import { VANILLA_EXPERIMENTAL_DECKS } from "./vanilla-experimental-decks";

const expectedDuplicateIds: Record<string, readonly string[]> = {
  vanilla_ember_2: ["van_ember_u01", "van_ember_u02", "van_ember_u03", "van_ember_u04", "van_ember_u05", "van_ember_u06", "van_ember_u08", "van_ember_u11", "van_ember_u13", "van_ember_u14"],
  vanilla_tide_2: ["van_tide_u01", "van_tide_u02", "van_tide_u03", "van_tide_u04", "van_tide_u05", "van_tide_u06", "van_tide_u09", "van_tide_u10", "van_tide_e01", "van_tide_e02"],
  vanilla_wood_2: ["van_wood_u01", "van_wood_u02", "van_wood_u03", "van_wood_u04", "van_wood_u05", "van_wood_u06", "van_wood_u08", "van_wood_u11", "van_wood_u13", "van_wood_u14"],
  vanilla_void_2: ["van_void_u01", "van_void_u02", "van_void_u03", "van_void_u04", "van_void_u05", "van_void_u06", "van_void_u08", "van_void_u11", "van_void_u13", "van_void_u14"],
  vanilla_forest_2: ["van_forest_u01", "van_forest_u02", "van_forest_u03", "van_forest_u04", "van_forest_u05", "van_forest_u06", "van_forest_u08", "van_forest_u11", "van_forest_u13", "van_forest_u14"],
  vanilla_storm_2: ["van_storm_u01", "van_storm_u02", "van_storm_u03", "van_storm_u04", "van_storm_u05", "van_storm_u06", "van_storm_u08", "van_storm_u11", "van_storm_u13", "van_storm_u14"],
};

const report = buildVanillaContentAudit();
assert.equal(report.gate, "pass", report.errors.join("\n"));
assert.equal(report.experimentalDecks, 12);
assert.equal(report.experimentalUniqueCards, 180);
assert.deepEqual(report.uncoveredExperimentalCardIds, []);

const vanguards = report.decks.filter((deck) => deck.id.endsWith("_1"));
const historicalVanguards = vanguards.filter((deck) => !["vanilla_tide_1", "vanilla_storm_1"].includes(deck.id));
const ascendants = report.decks.filter((deck) => deck.id.endsWith("_2"));
assert.equal(vanguards.length, 6);
assert.equal(historicalVanguards.length, 4, "Vanilla 1.4 historical Vanguard contract must own exactly four decks after the 1.5 Tidecall and 1.6 Tempestade exceptions");
assert.equal(ascendants.length, 6);

for (const deck of historicalVanguards) {
  assert.equal(deck.cards, 40, `${deck.name}: Vanguard size drifted`);
  assert.equal(deck.uniqueCards, 20, `${deck.name}: Vanguard unique-card contract drifted`);
  assert.equal(deck.types.Unit, 36, `${deck.name}: Vanguard Unit count drifted`);
  assert.equal(deck.types.Spell, 4, `${deck.name}: Vanguard Spell count drifted`);
  assert.equal(deck.averageCost, 3.7, `${deck.name}: Vanguard historical curve drifted`);
}

for (const deck of ascendants) {
  assert.equal(deck.cards, 40, `${deck.name}: Ascendant size drifted`);
  assert.equal(deck.uniqueCards, 30, `${deck.name}: each regional van_* card must remain represented`);
  assert.ok(deck.types.Unit >= 26, `${deck.name}: Ascendant must keep enough board density`);
  assert.ok((deck.manaCurve["0-1"] ?? 0) >= 5, `${deck.name}: Ascendant needs at least five early plays`);
  assert.ok((deck.manaCurve["7+"] ?? 0) <= 3, `${deck.name}: Ascendant top-end density regressed`);
  assert.ok(deck.averageCost <= 3.65, `${deck.name}: Ascendant average cost regressed above the certified envelope`);

  const duplicates = Object.entries(deck.duplicateCopies)
    .filter(([, count]) => count === 2)
    .map(([defId]) => defId)
    .sort();
  assert.equal(duplicates.length, 10, `${deck.name}: expected exactly ten duplicated regional cards`);
  assert.deepEqual(duplicates, [...expectedDuplicateIds[deck.id]].sort(), `${deck.name}: evidence-selected duplicate policy drifted`);
  assert.ok(Object.values(deck.duplicateCopies).every((count) => count === 2), `${deck.name}: no Ascendant card may exceed two copies`);
}

const sourceDecks = new Map(VANILLA_EXPERIMENTAL_DECKS.map((deck) => [deck.id, deck] as const));
for (const deck of ascendants) {
  const source = sourceDecks.get(deck.id);
  assert.ok(source, `${deck.id}: missing source recipe`);
  assert.equal(new Set(source.cards).size, 30);
  assert.equal(source.cards.length, 40);
}

console.log("Vanilla 1.4 Ascendant recipe reconstruction: PASS");
