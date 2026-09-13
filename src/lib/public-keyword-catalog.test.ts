import assert from "node:assert/strict";
import type { PublicCardDto } from "./public-card-catalog";
import {
  buildPublicKeywordCatalog,
  canonicalPublicKeywords,
  countPublicKeywordUsage,
  toPublicCustomKeyword,
} from "./public-keyword-catalog";

const collection = { key: "vanilla", code: "VAN", name: "Vanilla", symbol: null };

const cards: PublicCardDto[] = [
  {
    defId: "kw_one",
    name: "Sky Fixture",
    region: "Tempestade",
    regions: ["Tempestade"],
    type: "Unit",
    structuralType: "Unit",
    cost: 2,
    power: 2,
    health: 2,
    keywords: ["Flying", "Barrier"],
    customKeywords: ["storm_echo"],
    description: "Fixture.",
    rarity: "Common",
    races: [],
    classes: [],
    isLegend: false,
    isChampion: false,
    emoji: "🦅",
    doctrineAffinities: [],
    collection,
  },
  {
    defId: "kw_two",
    name: "Second Sky Fixture",
    region: "Tempestade",
    regions: ["Tempestade"],
    type: "Unit",
    structuralType: "Unit",
    cost: 3,
    power: 3,
    health: 3,
    keywords: ["Flying"],
    customKeywords: [],
    description: "Fixture.",
    rarity: "Rare",
    races: [],
    classes: [],
    isLegend: false,
    isChampion: false,
    emoji: "⚡",
    doctrineAffinities: [],
    collection,
  },
];

const usage = countPublicKeywordUsage(cards);
assert.equal(usage.get("Flying"), 2);
assert.equal(usage.get("Barrier"), 1);
assert.equal(usage.get("storm_echo"), 1);

const canonical = canonicalPublicKeywords(usage);
assert.equal(canonical.length, 20, "public codex must expose all canonical engine keywords");
const flying = canonical.find((item) => item.key === "Flying");
assert.ok(flying);
assert.equal(flying.source, "canonical");
assert.equal(flying.cardCount, 2);
assert.deepEqual(flying.runtimeDomains, ["blocking"]);
assert.equal(flying.grantable, true);
assert.equal("behavior" in flying, false);
assert.equal("effect" in flying, false);
assert.equal("condition" in flying, false);

const lastBreath = canonical.find((item) => item.key === "LastBreath");
assert.equal(lastBreath?.requiresTrigger, "onDeath");
assert.equal(lastBreath?.timing, "onDeath");
assert.equal(lastBreath?.grantable, false);

const nativeAlias = toPublicCustomKeyword({
  key: "skybound",
  name: "Skybound",
  description: "Public alias for Flying.",
  icon: "🪽",
  engineKeyword: "Flying",
  behavior: {},
  enabled: true,
}, usage);
assert.ok(nativeAlias);
assert.equal(nativeAlias.engineKeyword, "Flying");
assert.deepEqual(nativeAlias.runtimeDomains, ["blocking"]);
assert.equal(nativeAlias.description, "Public alias for Flying.");
assert.equal("behavior" in nativeAlias, false);

const compiled = toPublicCustomKeyword({
  key: "storm_echo",
  name: "Storm Echo",
  description: "Triggers when this unit attacks.",
  icon: null,
  engineKeyword: null,
  behavior: {
    version: 1,
    trigger: "onAttack",
    condition: { kind: "always" },
    effect: { kind: "draw", amount: 1, target: "none" },
  },
  enabled: true,
}, usage);
assert.ok(compiled);
assert.equal(compiled.source, "custom");
assert.equal(compiled.timing, "onAttack");
assert.equal(compiled.cardCount, 1);
assert.equal(compiled.grantable, false);
assert.equal("behavior" in compiled, false);
assert.equal("effect" in compiled, false);
assert.equal("condition" in compiled, false);

assert.equal(toPublicCustomKeyword({
  key: "disabled",
  name: "Disabled",
  description: "",
  icon: null,
  engineKeyword: null,
  behavior: {},
  enabled: false,
}, usage), null);

assert.equal(toPublicCustomKeyword({
  key: "invalid_behavior",
  name: "Invalid",
  description: "",
  icon: null,
  engineKeyword: null,
  behavior: { version: 1, trigger: "not-real" },
  enabled: true,
}, usage), null);

const catalog = buildPublicKeywordCatalog(cards, [
  {
    key: "storm_echo",
    name: "Storm Echo",
    description: "Triggers when this unit attacks.",
    icon: null,
    engineKeyword: null,
    behavior: {
      version: 1,
      trigger: "onAttack",
      condition: { kind: "always" },
      effect: { kind: "draw", amount: 1, target: "none" },
    },
    enabled: true,
  },
]);
assert.equal(catalog.length, 21);
assert.equal(catalog.at(-1)?.key, "storm_echo");

const managedCatalog = buildPublicKeywordCatalog(cards, [
  {
    key: "Flying",
    name: "Flying",
    description: "Managed Studio description for Flying.",
    icon: "🦅",
    engineKeyword: "Flying",
    behavior: {},
    enabled: true,
  },
  {
    key: "storm_echo",
    name: "Storm Echo",
    description: "Triggers when this unit attacks.",
    icon: null,
    engineKeyword: null,
    behavior: {
      version: 1,
      trigger: "onAttack",
      condition: { kind: "always" },
      effect: { kind: "draw", amount: 1, target: "none" },
    },
    enabled: true,
  },
]);
assert.equal(managedCatalog.length, 21, "canonical management rows must not duplicate public codex entries");
assert.equal(managedCatalog.filter((item) => item.key === "Flying").length, 1);
assert.equal(managedCatalog.find((item) => item.key === "Flying")?.description, "Managed Studio description for Flying.");
assert.equal(managedCatalog.find((item) => item.key === "Flying")?.source, "canonical");

console.log("PUBLIC KEYWORD CODEX: PASS — 20 canonical · managed baseline overlays · published custom · usage counts · safe DTO");
