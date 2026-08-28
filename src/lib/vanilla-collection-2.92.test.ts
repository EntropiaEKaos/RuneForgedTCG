import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { baseCardsOnly } from "@/game/cards";
import { VANILLA_ADDITIONAL_CARDS } from "@/game/cards/vanilla";
import { RELEASE_296_CARDS } from "@/game/cards/release-2.96";
import { VANILLA_COLLECTION, getCardCollection } from "@/game/card-collections";
import { validateAuthorableCard } from "@/game/card-authoring";

const all = baseCardsOnly();
const additional = Object.values(VANILLA_ADDITIONAL_CARDS);
const release296 = Object.values(RELEASE_296_CARDS);
const previous = all.filter((card) => !card.defId.startsWith("van_") && !card.defId.startsWith("rf296_"));

assert.equal(previous.length, 216, "2.92 must preserve all 216 pre-Vanilla-expansion cards");
assert.equal(additional.length, 180, "Vanilla expansion must add exactly 180 cards");
assert.equal(release296.length, 33, "2.96 Sentinelas & Convergência must add exactly 33 cards");
assert.equal(all.length, 429, "Vanilla must contain 429 code-authored cards through release 2.96");
assert.equal(new Set(all.map((card) => card.defId)).size, 429, "every Vanilla card defId must be unique");
assert.equal(new Set(additional.map((card) => card.name)).size, 180, "all 180 new cards must have unique names");
const oldNames = new Set(previous.map((card) => card.name));
assert.deepEqual(additional.filter((card) => oldNames.has(card.name)).map((card) => card.name), [], "new cards must not reuse old display names");

const regions = new Map<string, number>();
const types = new Map<string, number>();
const rarities = new Map<string, number>();
for (const card of additional) {
  const validated = validateAuthorableCard(card);
  assert.equal(validated.ok, true, `${card.defId} must round-trip through the Card Studio authoring contract`);
  assert.equal(getCardCollection(card.defId)?.code, "VAN", `${card.defId} must resolve to Vanilla`);
  regions.set(card.region, (regions.get(card.region) ?? 0) + 1);
  types.set(card.type, (types.get(card.type) ?? 0) + 1);
  rarities.set(card.rarity, (rarities.get(card.rarity) ?? 0) + 1);
}
for (const card of previous) assert.equal(getCardCollection(card.defId)?.code, "VAN", `${card.defId} must be migrated from legacy Core/Convergence into Vanilla`);
for (const card of release296) assert.equal(getCardCollection(card.defId)?.code, "VAN", `${card.defId} must resolve to Vanilla in 2.96`);
assert.deepEqual(Object.fromEntries([...regions].sort()), {
  Emberhold: 30, Florestia: 30, Ironwood: 30, Tempestade: 30, Tidecall: 30, Voidborn: 30,
});
assert.deepEqual(Object.fromEntries([...types].sort()), {
  Artifact: 6, Enchantment: 12, Equipment: 6, Spell: 48, Unit: 108,
});
assert.deepEqual(Object.fromEntries([...rarities].sort()), {
  Common: 72, Epic: 36, Legend: 18, Rare: 54,
});
assert.equal(VANILLA_COLLECTION.name, "Vanilla");
assert.equal(VANILLA_COLLECTION.symbol, "/art/collections/vanilla-symbol.png");
assert.ok(fs.existsSync(path.join(process.cwd(), "public/art/collections/vanilla-symbol.png")), "Vanilla symbol asset must ship with the game");

const migration = fs.readFileSync(path.join(process.cwd(), "drizzle/0033_vanilla_collection_2_92.sql"), "utf8");
assert.match(migration, /'vanilla'/);
assert.match(migration, /'VAN'/);
assert.match(migration, /vanilla-symbol\.png/);
const vanilla292Ids = new Set([...previous, ...additional].map((card) => card.defId));
const migratedIds = [...migration.matchAll(/\('([^']+)'\)/g)].map((match) => match[1]).filter((id) => vanilla292Ids.has(id));
assert.equal(new Set(migratedIds).size, 396, "migration 0033 must assign every one of the original 396 cards to Vanilla");

const migration296 = fs.readFileSync(path.join(process.cwd(), "drizzle/0036_sentinelas_convergence_2_96.sql"), "utf8");
const migrated296Ids = [...migration296.matchAll(/\('([^']+)'\)/g)].map((match) => match[1]).filter((id) => release296.some((card) => card.defId === id));
assert.equal(new Set(migrated296Ids).size, 33, "migration 0036 must assign all 33 release 2.96 cards to Vanilla");
assert.match(migration296, /cardCount.*429/s);

console.log("VANILLA COLLECTION: 180-card 2.92 expansion preserved · 33-card 2.96 wave assigned · 429 total · symbol present");
