import assert from "node:assert/strict";
import type { PackDef } from "@/lib/packs";
import {
  applyPackLiveOpsModifiers,
  extractPackLiveOpsSources,
  normalizePackLiveOpsRule,
  validatePackLiveOpsConfig,
  validatePackLiveOpsRule,
  type PackLiveOpsSource,
} from "@/lib/pack-live-ops";

const base: PackDef = {
  id: "basic",
  name: "Pacote Comum",
  price: 100,
  icon: "📦",
  cardsCount: 5,
  dropRates: { Common: 0.7, Rare: 0.25, Epic: 0.04, Legend: 0.01 },
  description: "5 cartas.",
  color: "from-slate-500 to-slate-700",
  collectionKey: "vanilla",
};

const sources: PackLiveOpsSource[] = [
  {
    key: "forge-week",
    name: "Semana da Forja",
    kind: "event",
    rule: { packIds: ["basic"], discountPercent: 20, bonusCards: 1, guaranteedRarity: "Rare" },
  },
  {
    key: "weekend",
    name: "Fim de Semana",
    kind: "promotion",
    rule: { packIds: ["*"], discountPercent: 25, bonusCards: 2, guaranteedRarity: "Epic" },
  },
];

const effective = applyPackLiveOpsModifiers(base, sources);
assert.equal(effective.price, 75, "active discounts must use the strongest rule instead of stacking");
assert.equal(effective.cardsCount, 7, "bonus cards must use the strongest rule instead of stacking");
assert.equal(effective.guaranteedRarity, "Epic", "rarity guarantees must resolve to the highest active floor");
assert.deepEqual(effective.dropRates, base.dropRates, "Live Ops must never mutate gameplay rarity weights");
assert.equal(effective.collectionKey, "vanilla", "Live Ops must not silently change the pack collection");
assert.match(effective.description, /Semana da Forja/);
assert.match(effective.description, /Fim de Semana/);
assert.match(effective.description, /25% OFF/);
assert.match(effective.description, /\+2 cartas/);

const legendaryBase = { ...base, guaranteedRarity: "Legend" as const };
assert.equal(
  applyPackLiveOpsModifiers(legendaryBase, sources).guaranteedRarity,
  "Legend",
  "Live Ops must never downgrade an existing guarantee",
);

const unrelated = applyPackLiveOpsModifiers({ ...base, id: "other" }, [sources[0]]);
assert.deepEqual(unrelated, { ...base, id: "other" }, "non-targeted packs must remain unchanged");

assert.deepEqual(
  normalizePackLiveOpsRule({ packIds: ["basic", "basic"], discountPercent: 10 }),
  { packIds: ["basic"], discountPercent: 10 },
);
assert.ok(validatePackLiveOpsRule({ packIds: ["basic"], discountPercent: 76 }).length > 0);
assert.ok(validatePackLiveOpsRule({ packIds: ["basic"], bonusCards: 3 }).length > 0);
assert.ok(validatePackLiveOpsRule({ packIds: ["basic"], guaranteedRarity: "Mythic" }).length > 0);
assert.ok(validatePackLiveOpsRule({ packIds: ["basic"] }).length > 0);

const eventSources = extractPackLiveOpsSources("events", {
  key: "event-one",
  name: "Event One",
  rules: { packEconomy: [{ packIds: ["basic"], bonusCards: 1 }] },
});
assert.equal(eventSources.length, 1);
assert.equal(eventSources[0].kind, "event");

const promoSources = extractPackLiveOpsSources("promotions", {
  key: "promo-one",
  name: "Promo One",
  offers: [
    { type: "other", price: 100 },
    { type: "pack_modifier", packIds: ["*"], discountPercent: 15 },
  ],
});
assert.equal(promoSources.length, 1);
assert.equal(promoSources[0].kind, "promotion");

assert.deepEqual(validatePackLiveOpsConfig("events", {
  rules: { packEconomy: [{ packIds: ["basic"], bonusCards: 1 }] },
}), []);
assert.ok(validatePackLiveOpsConfig("events", {
  rules: { packEconomy: [{ packIds: ["basic"], bonusCards: 5 }] },
}).length > 0);
assert.ok(validatePackLiveOpsConfig("promotions", {
  offers: [{ type: "pack_modifier", packIds: ["*"], discountPercent: -1 }],
}).length > 0);

console.log("PACK ECONOMY + EVENTS: deterministic non-stacking Live Ops modifiers PASS");
