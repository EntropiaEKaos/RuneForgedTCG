import assert from "node:assert/strict";
import { normalizeCardForRoundTrip, sanitizePermanentStatAura, validateAuthorableCard } from "./card-authoring";
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
}, "Aura sanitizer preserves canonical stats and deduplicates filters");

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
  assert.equal(sanitizePermanentStatAura(invalid), null, `invalid Aura must fail closed: ${JSON.stringify(invalid)}`);
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
  assert.equal(result.ok, true, `${type} must author the supported continuous Aura slice`);
  assert.ok(result.ok);
  assert.deepEqual(result.card.aura, source.aura, `${type} Aura survives server-side validation`);
  const roundTrip = normalizeCardForRoundTrip(source);
  assert.deepEqual(roundTrip.aura, source.aura, `${type} Aura survives semantic round-trip`);
}

for (const type of ["Unit", "Spell", "Equipment", "Sentinela"] as CardType[]) {
  const result = validateAuthorableCard(makeSource(type));
  assert.equal(result.ok, false, `${type} must reject a Permanent-only Aura contract`);
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

console.log("PERMANENT AURA AUTHORING: PASS — Studio/server validation, source restrictions, filters and round-trip certified");
