import assert from "node:assert/strict";
import { getCard } from "./cards";
import { buildVanillaContentAudit } from "./vanilla-content-audit";
import { VANILLA_EXPERIMENTAL_DECKS } from "./vanilla-experimental-decks";

const report = buildVanillaContentAudit();
assert.equal(report.gate, "pass", report.errors.join("\n"));
assert.equal(report.experimentalDecks, 12);
assert.equal(report.experimentalUniqueCards, 180);
assert.deepEqual(report.uncoveredExperimentalCardIds, []);

const audited = report.decks.find((deck) => deck.id === "vanilla_storm_1");
assert.ok(audited, "Tempestade Vanguard must remain in the experimental pool");
assert.equal(audited.cards, 40);
assert.equal(audited.types.Unit, 32);
assert.equal(audited.types.Spell, 8);
assert.equal(audited.uniqueCards, 22);
assert.equal(audited.averageCost, 3.8);
assert.equal(audited.manaCurve["7+"], 4);
assert.ok(Object.values(audited.duplicateCopies).every((count) => count <= 2));

const source = VANILLA_EXPERIMENTAL_DECKS.find((deck) => deck.id === "vanilla_storm_1");
assert.ok(source, "Tempestade Vanguard source recipe missing");
assert.equal(source.cards.length, 40);
assert.equal(new Set(source.cards).size, 22);

const copies = new Map<string, number>();
for (const defId of source.cards) copies.set(defId, (copies.get(defId) ?? 0) + 1);

const singletonUnits = new Set([
  "van_storm_u03",
  "van_storm_u05",
  "van_storm_u08",
  "van_storm_u11",
]);
for (let index = 1; index <= 18; index += 1) {
  const defId = `van_storm_u${String(index).padStart(2, "0")}`;
  assert.equal(copies.get(defId), singletonUnits.has(defId) ? 1 : 2, `${defId}: certified copy count drifted`);
}

for (const defId of ["van_storm_s01", "van_storm_s02", "van_storm_s05", "van_storm_s06"]) {
  assert.equal(copies.get(defId), 2, `${defId}: certified control package drifted`);
}
for (const defId of [
  "van_storm_s03",
  "van_storm_s04",
  "van_storm_s07",
  "van_storm_s08",
  "van_storm_e01",
  "van_storm_e02",
  "van_storm_a01",
  "van_storm_q01",
]) {
  assert.equal(copies.get(defId) ?? 0, 0, `${defId}: non-certified card entered Tempestade Vanguard`);
}

for (const defId of source.cards) {
  const card = getCard(defId);
  assert.equal(card.region, "Tempestade", `${defId}: Tempestade Vanguard must remain mono-region`);
  assert.ok(card.type === "Unit" || card.type === "Spell", `${defId}: only Unit/Spell are certified in Vanguard`);
}

const ascendant = VANILLA_EXPERIMENTAL_DECKS.find((deck) => deck.id === "vanilla_storm_2");
assert.ok(ascendant, "Tempestade Ascendant must remain independent");
assert.equal(ascendant.cards.length, 40);
assert.equal(new Set(ascendant.cards).size, 30);
assert.notDeepEqual(source.cards, ascendant.cards, "Tempestade Vanguard and Ascendant recipes must remain independent");

console.log("Vanilla 1.6 Tempestade Vanguard ceiling recipe: PASS");
