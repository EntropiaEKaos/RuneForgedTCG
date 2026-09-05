import assert from "node:assert/strict";
import type { CardDef } from "@/game/types";
import { countPublicCardsByCollection, queryPublicCardCatalog, toPublicCardDto, type PublicCardDto } from "./public-card-catalog";

const collection = { key: "vanilla", code: "VAN", name: "Vanilla", symbol: "/vanilla.png" };

const source: CardDef = {
  defId: "public_fixture",
  name: "Public Fixture",
  region: "Emberhold",
  regions: ["Emberhold", "Tempestade"],
  type: "Spell",
  archetypeKey: "ritual",
  archetypeName: "Ritual",
  cost: 3,
  description: "Deal damage after a deliberate setup.",
  flavor: "The forge remembers.",
  rarity: "Epic",
  race: "Dragon",
  secondaryRaces: ["Elemental"],
  classes: ["Mage"],
  keywords: ["Barrier"],
  customKeywords: ["Overcharge"],
  isLegend: true,
  isChampion: false,
  art: "/fixture.png",
  emoji: "🔥",
  strategicRole: "removal",
  doctrineAffinities: ["ember-control"],
  spell: { kind: "damageNexus", amount: 3, target: "none" },
  trigger: { when: "onRoundStart", effect: { kind: "draw", amount: 1, target: "none" } },
  mechanics: [{ key: "internal", trigger: "onRoundStart", effect: { kind: "draw", amount: 1, target: "none" } }],
};

const dto = toPublicCardDto(source, collection);
assert.ok(dto);
assert.equal(dto.type, "Ritual");
assert.equal(dto.structuralType, "Spell");
assert.deepEqual(dto.regions, ["Emberhold", "Tempestade"]);
assert.deepEqual(dto.races, ["Dragon", "Elemental"]);
assert.equal(dto.collection.code, "VAN");
assert.equal("spell" in dto, false);
assert.equal("trigger" in dto, false);
assert.equal("mechanics" in dto, false);
assert.equal(toPublicCardDto(source, null), null, "cards without a public collection identity must fail closed");

const second: PublicCardDto = {
  ...dto,
  defId: "second",
  name: "Second Card",
  region: "Tidecall",
  regions: ["Tidecall"],
  type: "Unit",
  structuralType: "Unit",
  rarity: "Common",
  cost: 1,
  keywords: [],
  customKeywords: [],
  description: "A calm unit.",
  flavor: "Still waters remember.",
  races: ["Sprite"],
  classes: [],
  isLegend: false,
  isChampion: false,
  emoji: "💧",
  doctrineAffinities: [],
};

const result = queryPublicCardCatalog([second, dto], { q: "forge", pageSize: 1, page: 1 });
assert.equal(result.total, 1);
assert.equal(result.items[0]?.defId, "public_fixture");
assert.equal(result.pageSize, 1);
assert.equal(result.totalPages, 1);
assert.ok(result.facets.regions.some((facet) => facet.value === "Emberhold"));
assert.ok(result.facets.types.some((facet) => facet.value === "Ritual"));
assert.ok(result.facets.collections.some((facet) => facet.value === "vanilla" && facet.count === 2));

const filtered = queryPublicCardCatalog([second, dto], {
  region: "tempestade",
  type: "ritual",
  rarity: "epic",
  collection: "VAN",
});
assert.deepEqual(filtered.items.map((card) => card.defId), ["public_fixture"]);

const bounded = queryPublicCardCatalog([second, dto], { pageSize: 1000, page: 99 });
assert.equal(bounded.pageSize, 100);
assert.equal(bounded.page, 1);

const collectionCounts = countPublicCardsByCollection(
  [source, { ...source, defId: "public_fixture_2", name: "Second Public Fixture" }],
  (defId) => defId === "public_fixture_2" ? null : collection,
);
assert.equal(collectionCounts.get("vanilla"), 1, "collection counts must use the same fail-closed public identity boundary");
assert.equal(collectionCounts.size, 1);

console.log("PUBLIC CARD CATALOG: PASS — safe DTO · semantic type · fail-closed collection · filters · facets · pagination · collection counts");
