import assert from "node:assert/strict";
import { CARD_EFFECT_KINDS, CARD_RACES } from "@/game/card-authoring";
import { baseCardsOnly } from "@/game/cards";
import { CANONICAL_KEYWORDS } from "@/game/keywords";
import { buildStudioBaseline } from "./studio-baseline-sync";

const baseline = buildStudioBaseline();
const baseCards = baseCardsOnly();

assert.equal(baseline.collection.key, "vanilla");
assert.equal(baseline.collection.code, "VAN");
assert.equal(baseline.collection.status, "published");

assert.deepEqual(baseline.keywords.map((row) => row.key), [...CANONICAL_KEYWORDS]);
assert.deepEqual(baseline.effects.map((row) => row.kind), [...CARD_EFFECT_KINDS]);
assert.deepEqual(baseline.races.map((row) => row.key), [...CARD_RACES]);
assert.equal(new Set(baseline.classes.map((row) => row.key)).size, baseline.classes.length, "class baseline must be unique");
assert.deepEqual(
  baseline.classes.map((row) => row.key),
  [...new Set(baseCards.flatMap((card) => Array.isArray(card.classes) ? card.classes : []))].sort((a, b) => a.localeCompare(b)),
  "Studio classes must reflect the certified card baseline exactly; no synthetic class vocabulary may be invented",
);

assert.equal(baseline.cards.length, baseCards.length, "Studio baseline must cover every code-authored card");
assert.equal(new Set(baseline.cards.map((card) => card.defId)).size, baseline.cards.length, "base card defIds must be unique");

for (const row of baseline.keywords) {
  assert.equal(row.engineKeyword, row.key, `canonical keyword ${row.key} must map to itself`);
  assert.equal(row.enabled, true);
}
for (const row of baseline.effects) assert.equal(row.enabled, true);
for (const row of baseline.races) assert.equal(row.enabled, true);
for (const row of baseline.classes) assert.equal(row.enabled, true);

console.log(`STUDIO BASELINE CONTRACT: PASS — ${baseline.keywords.length} keywords · ${baseline.effects.length} effects · ${baseline.races.length} races · ${baseline.classes.length} classes · ${baseline.cards.length} base cards`);
