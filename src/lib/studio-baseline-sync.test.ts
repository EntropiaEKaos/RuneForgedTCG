import assert from "node:assert/strict";
import fs from "node:fs";
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
assert.ok(baseline.classes.length > 0, "certified base cards must project at least one class into Studio");

assert.equal(baseline.cards.length, baseCards.length, "Studio baseline must cover every code-authored card");
assert.equal(new Set(baseline.cards.map((card) => card.defId)).size, baseline.cards.length, "base card defIds must be unique");

for (const row of baseline.keywords) {
  assert.equal(row.engineKeyword, row.key, `canonical keyword ${row.key} must map to itself`);
  assert.equal(row.enabled, true);
}
for (const row of baseline.effects) assert.equal(row.enabled, true);
for (const row of baseline.races) assert.equal(row.enabled, true);
for (const row of baseline.classes) assert.equal(row.enabled, true);

const bootstrap = fs.readFileSync("scripts/database-bootstrap.ts", "utf8");
const migrate = fs.readFileSync("scripts/database-migrate.ts", "utf8");
assert.match(bootstrap, /studio-content-sync\.ts/, "fresh database bootstrap must populate the Studio baseline");
assert.match(migrate, /studio-content-sync\.ts/, "existing production databases must receive the Studio baseline during db:migrate");

console.log(`STUDIO BASELINE CONTRACT: PASS — ${baseline.keywords.length} keywords · ${baseline.effects.length} effects · ${baseline.races.length} races · ${baseline.classes.length} classes · ${baseline.cards.length} base cards`);
