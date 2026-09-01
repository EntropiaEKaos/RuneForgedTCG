import assert from "node:assert/strict";
import { REGION_ORDER } from "./region-identity";
import {
  VANILLA_CODE_AUTHORED_CARD_BASELINE,
  VANILLA_EXPERIMENTAL_DECK_BASELINE,
  VANILLA_EXPERIMENTAL_DECK_SIZE,
  VANILLA_EXPERIMENTAL_WAVE_BASELINE,
  buildVanillaContentAudit,
} from "./vanilla-content-audit";

const report = buildVanillaContentAudit();

assert.equal(report.gate, "pass", report.errors.join("\n"));
assert.equal(report.totalCards, VANILLA_CODE_AUTHORED_CARD_BASELINE);
assert.equal(report.experimentalWaveCards, VANILLA_EXPERIMENTAL_WAVE_BASELINE);
assert.equal(report.experimentalDecks, VANILLA_EXPERIMENTAL_DECK_BASELINE);
assert.equal(report.experimentalUniqueCards, VANILLA_EXPERIMENTAL_WAVE_BASELINE);
assert.deepEqual(report.uncoveredExperimentalCardIds, []);
assert.deepEqual(report.errors, []);

for (const region of REGION_ORDER) {
  assert.equal(report.regionDeckCounts[region], 2, `${region} must expose two Vanilla Balance Lab intake decks`);
}

for (const deck of report.decks) {
  assert.equal(deck.cards, VANILLA_EXPERIMENTAL_DECK_SIZE, `${deck.id} must remain a 40-card deck`);
  assert.equal(deck.errors.length, 0, `${deck.id}: ${deck.errors.join("; ")}`);
  assert.ok(deck.uniqueCards > 0, `${deck.id} must contain cards`);
  assert.ok(deck.averageCost >= 0, `${deck.id} average cost must be finite/non-negative`);
  assert.equal(
    Object.values(deck.manaCurve).reduce((sum, count) => sum + count, 0),
    VANILLA_EXPERIMENTAL_DECK_SIZE,
    `${deck.id} mana curve must account for every card`,
  );
  assert.equal(
    Object.values(deck.types).reduce((sum, count) => sum + count, 0),
    VANILLA_EXPERIMENTAL_DECK_SIZE,
    `${deck.id} type profile must account for every card`,
  );
}

assert.equal(Object.values(report.regionDeckCounts).reduce((sum, count) => sum + count, 0), 12);
assert.ok(Object.keys(report.types).length >= 5, "Vanilla baseline must retain broad structural card-type coverage");
assert.ok(Object.keys(report.rarities).length === 4, "Vanilla baseline must retain all four rarity tiers");

console.log(
  `VANILLA 1.0 CONTENT BASELINE: PASS — ${report.totalCards} cards · ${report.experimentalDecks} decks · ${report.experimentalUniqueCards}/${report.experimentalWaveCards} experimental cards covered · zero intake errors`,
);
