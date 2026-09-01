import assert from "node:assert/strict";
import "./aura-2-types";
import { normalizeCardForRoundTrip, sanitizePermanentStatAura, validateAuthorableCard } from "./card-authoring";
import { applyCertifiedSemanticCardType, validateAuthorableCardWithSemanticTypes } from "./semantic-card-type-authoring";
import type { CardDef, CardType } from "./types";

const canonicalAura = { buffPower: 2, buffHealth: 3, races: ["Beast", "Spirit"] as const, classes: ["guardian", "mage"] };
const sanitized = sanitizePermanentStatAura({
  buffPower: 2,
  buffHealth: 3,
  races: ["Beast", "Spirit", "Beast"],
  classes: ["guardian", "mage", "guardian"],
});
assert.deepEqual(sanitized, {
  buffPower: 2,
  buffHealth: 3,
  races: ["Beast", "Spirit"],
  classes: ["guardian", "mage"],
}, "legacy stat-Aura sanitizer preserves canonical stats and deduplicates filters");

for (const invalid of [
  null,
  {},
  { buffPower: 0, buffHealth: 0 },
  { buffPower: -1, buffHealth: 1 },
  { buffPower: 1, buffHealth: -1 },
  { buffPower: 1.5, buffHealth: 1 },
  { buffPower: Number.POSITIVE_INFINITY, buffHealth: 1 },
  { buffPower: 21, buffHealth: 0 },
  { buffPower: 0, buffHealth: 21 },
  { buffPower: 1, buffHealth: 1, races: ["NotARegionRace"] },
  { buffPower: 1, buffHealth: 1, classes: ["Invalid Class Name"] },
]) {
  assert.equal(sanitizePermanentStatAura(invalid), null, `invalid legacy stat Aura must fail closed: ${JSON.stringify(invalid)}`);
}

const makeSource = (type: CardType): CardDef => ({
  defId: `rt_aura_${type.toLowerCase()}`,
  name: `Aura ${type}`,
  region: "Ironwood",
  type,
  cost: 3,
  maxHealth: type === "Enchantment" || type === "Artifact" ? 4 : undefined,
  aura: {
    buffPower: canonicalAura.buffPower,
    buffHealth: canonicalAura.buffHealth,
    races: [...canonicalAura.races],
    classes: [...canonicalAura.classes],
  },
  ...(type === "Unit" ? { power: 2, health: 2 } : {}),
  ...(type === "Spell" ? { spell: { kind: "draw" as const, amount: 1, target: "none" as const } } : {}),
  ...(type === "Equipment" ? { equipment: { buffPower: 1, buffHealth: 0, keywords: [] } } : {}),
  ...(type === "Sentinela" ? { sentinela: { startingLoyalty: 3, abilities: [{ cost: 1, description: "+1", effect: { kind: "draw" as const, amount: 1, target: "none" as const } }] } } : {}),
  description: "Continuous authoring probe.",
  rarity: "Rare",
  emoji: "◉",
});

for (const type of ["Enchantment", "Artifact"] as CardType[]) {
  const source = makeSource(type);
  const result = validateAuthorableCard(source);
  assert.equal(result.ok, true, `${type} must author the supported continuous stat-Aura slice`);
  assert.ok(result.ok);
  assert.deepEqual(result.card.aura, source.aura, `${type} stat Aura survives server-side validation`);
  const roundTrip = normalizeCardForRoundTrip(source);
  assert.deepEqual(roundTrip.aura, source.aura, `${type} stat Aura survives legacy semantic round-trip`);
}

for (const type of ["Unit", "Spell", "Equipment", "Sentinela"] as CardType[]) {
  const result = validateAuthorableCard(makeSource(type));
  assert.equal(result.ok, false, `${type} must reject a Permanent-only Aura contract in the legacy validator`);
  if (!result.ok) assert.match(result.error, /Aura|Enchantment|Artifact/i);
}

const hybrid: CardDef = {
  ...makeSource("Enchantment"),
  defId: "rt_aura_with_trigger",
  trigger: { when: "onRoundStart", effect: { kind: "draw", amount: 1, target: "none" } },
};
const hybridResult = validateAuthorableCard(hybrid);
assert.equal(hybridResult.ok, true, "continuous Aura and an executable Permanent trigger may coexist");
assert.ok(hybridResult.ok);
assert.deepEqual(hybridResult.card.aura, hybrid.aura);
assert.deepEqual(hybridResult.card.trigger, hybrid.trigger);

const keywordOnly: CardDef = {
  ...makeSource("Enchantment"),
  defId: "rt_keyword_aura",
  aura: { buffPower: 0, buffHealth: 0, keywords: ["Flying", "Hexproof", "Flying"] },
};
const keywordOnlyResult = validateAuthorableCardWithSemanticTypes(keywordOnly);
assert.equal(keywordOnlyResult.ok, true, "keyword-only Aura is accepted at the canonical Studio/API validator");
assert.ok(keywordOnlyResult.ok);
assert.deepEqual(keywordOnlyResult.card.aura, {
  buffPower: 0,
  buffHealth: 0,
  keywords: ["Flying", "Hexproof"],
});
const keywordRoundTrip = validateAuthorableCardWithSemanticTypes(keywordOnlyResult.card);
assert.equal(keywordRoundTrip.ok, true, "Aura 2.0 survives its canonical semantic round-trip");
assert.ok(keywordRoundTrip.ok);
assert.deepEqual(keywordRoundTrip.card.aura, keywordOnlyResult.card.aura);

const mixedKeywordAura: CardDef = {
  ...makeSource("Artifact"),
  defId: "rt_mixed_keyword_aura",
  aura: { buffPower: 2, buffHealth: 1, keywords: ["Tough", "Reach"], races: ["Beast"], classes: ["guardian"] },
};
const mixedResult = validateAuthorableCardWithSemanticTypes(mixedKeywordAura);
assert.equal(mixedResult.ok, true, "stat + keyword Aura with filters is authorable");
assert.ok(mixedResult.ok);
assert.deepEqual(mixedResult.card.aura, mixedKeywordAura.aura);

for (const unsafe of ["Barrier", "LastBreath"] as const) {
  const result = validateAuthorableCardWithSemanticTypes({
    ...keywordOnly,
    defId: `rt_unsafe_aura_${unsafe.toLowerCase()}`,
    aura: { buffPower: 0, buffHealth: 0, keywords: [unsafe] },
  });
  assert.equal(result.ok, false, `${unsafe} must fail closed as a continuous Aura grant`);
  if (!result.ok) assert.match(result.error, /cannot be granted|Aura/i);
}

const unknownKeyword = validateAuthorableCardWithSemanticTypes({
  ...keywordOnly,
  defId: "rt_unknown_keyword_aura",
  aura: { buffPower: 0, buffHealth: 0, keywords: ["NotAKeyword" as never] },
});
assert.equal(unknownKeyword.ok, false, "unknown Aura keyword fails closed");

const semanticUnitAura = validateAuthorableCardWithSemanticTypes({
  ...makeSource("Unit"),
  defId: "rt_keyword_source_unit",
  aura: { buffPower: 0, buffHealth: 0, keywords: ["Flying" as const] },
});
assert.equal(semanticUnitAura.ok, true, "Aura 2.3 extends only the canonical semantic boundary to Unit-source lord effects");
assert.ok(semanticUnitAura.ok);
assert.deepEqual(semanticUnitAura.card.aura, { buffPower: 0, buffHealth: 0, keywords: ["Flying"] });

const semanticSentinelaAura = validateAuthorableCardWithSemanticTypes({
  ...makeSource("Sentinela"),
  defId: "rt_keyword_source_sentinela",
  aura: { buffPower: 0, buffHealth: 0, keywords: ["Flying" as const] },
});
assert.equal(semanticSentinelaAura.ok, true, "Aura 2.4 extends only the canonical semantic boundary to Sentinela command Auras");
assert.ok(semanticSentinelaAura.ok);
assert.deepEqual(semanticSentinelaAura.card.aura, { buffPower: 0, buffHealth: 0, keywords: ["Flying"] });

for (const type of ["Spell", "Equipment"] as CardType[]) {
  const source = {
    ...makeSource(type),
    defId: `rt_keyword_source_${type.toLowerCase()}`,
    aura: { buffPower: 0, buffHealth: 0, keywords: ["Flying" as const] },
  };
  const result = validateAuthorableCardWithSemanticTypes(source);
  assert.equal(result.ok, false, `${type} remains an unsupported continuous Aura source at the semantic boundary`);
}

const structureDraft = applyCertifiedSemanticCardType({
  defId: "rt_structure_keyword_aura",
  name: "Structure Aura",
  region: "Ironwood",
  type: "Artifact",
  cost: 4,
  description: "Structure Aura 2.0 probe.",
  rarity: "Epic",
  emoji: "🏰",
}, "structure");
const structureResult = validateAuthorableCardWithSemanticTypes({
  ...structureDraft,
  aura: { buffPower: 0, buffHealth: 0, keywords: ["Tough"] },
});
assert.equal(structureResult.ok, true, "certified Structure inherits the Artifact Aura 2.0 contract without a second runtime path");

console.log("PERMANENT AURA AUTHORING: PASS — legacy source restrictions preserved; Aura 2.x semantic Unit/Sentinela extensions, filters, keywords and round-trip certified");