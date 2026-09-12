import assert from "node:assert/strict";
import type { CardDef } from "@/game/types";
import { baseCardsOnly } from "@/game/cards";
import { SEMANTIC_ALPHA_CARDS } from "@/game/cards/semantic-alpha";
import { ECOS_DO_ABISMO_CARDS } from "@/game/cards/ecos-do-abismo";
import { getCardCollection } from "@/game/card-collections";
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
  power: 2,
  health: 2,
  keywords: [],
  customKeywords: [],
  description: "A calm unit.",
  flavor: "Still waters remember.",
  races: ["Sprite"],
  classes: ["Scout"],
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
assert.ok(result.facets.keywords.some((facet) => facet.value === "Barrier" && facet.count === 1));
assert.ok(result.facets.keywords.some((facet) => facet.value === "Overcharge" && facet.count === 1));
assert.ok(result.facets.races.some((facet) => facet.value === "Dragon" && facet.count === 1));
assert.ok(result.facets.classes.some((facet) => facet.value === "Mage" && facet.count === 1));
assert.ok(result.facets.costs.some((facet) => facet.value === "3" && facet.count === 1));
assert.deepEqual(result.breakdown.rarities, [{ value: "Epic", count: 1 }]);
assert.deepEqual(result.breakdown.classes, [{ value: "Mage", count: 1 }]);

const filtered = queryPublicCardCatalog([second, dto], {
  region: "tempestade",
  type: "ritual",
  rarity: "epic",
  collection: "VAN",
  keyword: "barrier",
  race: "dragon",
  class: "mage",
  minCost: 3,
  maxCost: 3,
});
assert.deepEqual(filtered.items.map((card) => card.defId), ["public_fixture"]);
assert.deepEqual(filtered.breakdown.costs, [{ value: "3", count: 1 }]);
assert.ok(filtered.breakdown.regions.some((facet) => facet.value === "Tempestade" && facet.count === 1));

const customKeywordFiltered = queryPublicCardCatalog([second, dto], { keyword: "overcharge" });
assert.deepEqual(customKeywordFiltered.items.map((card) => card.defId), ["public_fixture"]);

const raceFiltered = queryPublicCardCatalog([second, dto], { race: "sprite" });
assert.deepEqual(raceFiltered.items.map((card) => card.defId), ["second"]);

const classFiltered = queryPublicCardCatalog([second, dto], { class: "scout" });
assert.deepEqual(classFiltered.items.map((card) => card.defId), ["second"]);

const costFiltered = queryPublicCardCatalog([second, dto], { minCost: 2, maxCost: 4 });
assert.deepEqual(costFiltered.items.map((card) => card.defId), ["public_fixture"]);

const sortedByCost = queryPublicCardCatalog([dto, second], { sort: "cost-desc" });
assert.deepEqual(sortedByCost.items.map((card) => card.defId), ["public_fixture", "second"]);
const sortedByNameDesc = queryPublicCardCatalog([second, dto], { sort: "name-desc" });
assert.deepEqual(sortedByNameDesc.items.map((card) => card.defId), ["second", "public_fixture"]);

const bounded = queryPublicCardCatalog([second, dto], { pageSize: 1000, page: 99 });
assert.equal(bounded.pageSize, 100);
assert.equal(bounded.page, 1);

const collectionCounts = countPublicCardsByCollection(
  [source, { ...source, defId: "public_fixture_2", name: "Second Public Fixture" }],
  (defId) => defId === "public_fixture_2" ? null : collection,
);
assert.equal(collectionCounts.get("vanilla"), 1, "collection counts must use the same fail-closed public identity boundary");
assert.equal(collectionCounts.size, 1);

const collectibleBase = baseCardsOnly().filter((card) => card.collectible !== false);
const baseCounts = countPublicCardsByCollection(collectibleBase, getCardCollection);
assert.ok(baseCardsOnly().length >= 457, "current code-authored definitions must retain the 429-card 2.96 floor plus later waves");
assert.equal(
  Object.values(SEMANTIC_ALPHA_CARDS).filter((card) => card.collectible !== false).length,
  18,
  "all 18 Semantic Alpha cards must remain public collectible definitions",
);
assert.equal(
  Object.values(ECOS_DO_ABISMO_CARDS).filter((card) => card.collectible !== false).length,
  10,
  "all 10 Ecos do Abismo cards must remain public collectible definitions",
);
assert.equal(
  baseCounts.get("vanilla"),
  collectibleBase.length,
  "canonical Vanilla count must equal the complete currently public collectible base catalog",
);

console.log("PUBLIC CARD CATALOG: PASS — safe DTO · semantic type · advanced explorer filters/facets/sort/breakdown · fail-closed collection · pagination · collection counts");
