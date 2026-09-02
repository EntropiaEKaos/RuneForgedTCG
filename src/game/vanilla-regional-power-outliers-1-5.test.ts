import assert from "node:assert/strict";
import { getCard } from "./cards";
import { buildVanillaContentAudit } from "./vanilla-content-audit";
import { VANILLA_EXPERIMENTAL_DECKS } from "./vanilla-experimental-decks";

const report = buildVanillaContentAudit();
assert.equal(report.gate, "pass", report.errors.join("\n"));
assert.equal(report.experimentalDecks, 12);
assert.equal(report.experimentalUniqueCards, 180);
assert.deepEqual(report.uncoveredExperimentalCardIds, []);

const sourceDeck = VANILLA_EXPERIMENTAL_DECKS.find((deck) => deck.id === "vanilla_tide_1");
assert.ok(sourceDeck, "Vanilla 1.5 requires Tidecall Vanguard");
assert.equal(sourceDeck.cards.length, 40);

const auditedDeck = report.decks.find((deck) => deck.id === "vanilla_tide_1");
assert.ok(auditedDeck, "Tidecall Vanguard must remain visible to the Vanilla content audit");
assert.equal(auditedDeck.cards, 40);
assert.equal(auditedDeck.types.Unit, 32);
assert.equal(auditedDeck.types.Spell, 8);
assert.equal(auditedDeck.uniqueCards, 22);
assert.equal(auditedDeck.averageCost, 3.43);
assert.equal(auditedDeck.manaCurve["7+"] ?? 0, 2, "Tidecall Vanguard top-end must remain deconcentrated");
assert.ok(Object.values(auditedDeck.duplicateCopies).every((count) => count <= 2), "Tidecall Vanguard may not exceed two copies per card");

const copies = new Map<string, number>();
for (const defId of sourceDeck.cards) copies.set(defId, (copies.get(defId) ?? 0) + 1);

for (let index = 1; index <= 14; index += 1) {
  const defId = `van_tide_u${String(index).padStart(2, "0")}`;
  assert.equal(copies.get(defId), 2, `${defId} must remain a two-copy Vanguard core card`);
}
for (let index = 15; index <= 18; index += 1) {
  const defId = `van_tide_u${String(index).padStart(2, "0")}`;
  assert.equal(copies.get(defId), 1, `${defId} must remain a singleton top-end card`);
}
for (const suffix of ["s01", "s02", "s05", "s06"] as const) {
  const defId = `van_tide_${suffix}`;
  assert.equal(copies.get(defId), 2, `${defId} must remain a two-copy control tool`);
}
for (const suffix of ["s03", "s04", "s07", "s08", "e01", "e02", "a01", "q01"] as const) {
  const defId = `van_tide_${suffix}`;
  assert.equal(copies.get(defId) ?? 0, 0, `${defId} is intentionally outside Tidecall Vanguard 1.5`);
}

for (const defId of sourceDeck.cards) {
  const card = getCard(defId);
  assert.equal(card.region, "Tidecall", `${defId}: Tidecall Vanguard must remain mono-region`);
  assert.ok(card.type === "Unit" || card.type === "Spell", `${defId}: Tidecall Vanguard 1.5 only admits Units and Spells`);
}

const tideAscendant = VANILLA_EXPERIMENTAL_DECKS.find((deck) => deck.id === "vanilla_tide_2");
assert.ok(tideAscendant, "Tidecall Ascendant must remain independently authored");
assert.equal(tideAscendant.cards.length, 40);
assert.equal(new Set(tideAscendant.cards).size, 30, "Vanilla 1.5 must not collapse the Tidecall Ascendant coverage contract");
assert.notDeepEqual(tideAscendant.cards, sourceDeck.cards, "Vanguard correction must not leak into Tidecall Ascendant");

console.log("Vanilla 1.5 Regional Power Outliers — Tidecall Vanguard recipe: PASS");
