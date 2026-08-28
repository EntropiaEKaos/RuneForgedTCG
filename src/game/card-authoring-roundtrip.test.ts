import { baseCardsOnly } from "./cards";
import {
  CARD_EFFECT_KINDS, CARD_KEYWORDS, CARD_RACES, CARD_REGIONS,
  normalizeCardForRoundTrip, sanitizeCardEffect,
} from "./card-authoring";
import type { CardDef, CardEffect } from "./types";

let passed = 0;
const failures: string[] = [];
function check(ok: unknown, message: string) { if (ok) passed++; else failures.push(message); }
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function same(a: unknown, b: unknown): boolean { return stable(a) === stable(b); }

check(CARD_REGIONS.includes("Florestia"), "Florestia missing from canonical authoring catalog");
check(CARD_REGIONS.includes("Tempestade"), "Tempestade missing from canonical authoring catalog");
check(CARD_RACES.includes("Besta"), "Besta missing from canonical authoring catalog");
check(CARD_RACES.includes("Tempesteiro"), "Tempesteiro missing from canonical authoring catalog");
check(CARD_RACES.includes("Anjo"), "Anjo missing from canonical authoring catalog");
check(CARD_KEYWORDS.includes("Flying"), "Flying missing from canonical authoring catalog");
check(CARD_EFFECT_KINDS.includes("mill"), "mill missing from canonical authoring catalog");

const composite: CardEffect = {
  kind: "damageUnit", amount: 2, target: "enemyUnit", race: "Anjo", races: ["Besta", "Tempesteiro"],
  classKey: "mage", classKeys: ["mage", "arcane"], keyword: "Flying",
  also: { kind: "mill", amount: 3, target: "none", also: { kind: "draw", amount: 1, target: "none" } },
};
check(same(sanitizeCardEffect(composite), composite), "recursive CardEffect round-trip lost fields");


const typeSamples: CardDef[] = [
  { defId:"rt_unit", name:"Unit", region:"Florestia", type:"Unit", cost:1, power:1, health:1, race:"Besta", keywords:["Reach"], description:"x", rarity:"Common", emoji:"U" },
  { defId:"rt_spell", name:"Spell", region:"Tempestade", type:"Spell", cost:1, spell:{kind:"mill",amount:2,target:"none",also:{kind:"draw",amount:1,target:"none"}}, speed:"Burst", description:"x", rarity:"Rare", emoji:"S" },
  { defId:"rt_ench", name:"Ench", region:"Tidecall", type:"Enchantment", cost:2, maxHealth:3, trigger:{when:"onRoundStart",effect:{kind:"draw",amount:1,target:"none"}}, description:"x", rarity:"Epic", emoji:"E" },
  { defId:"rt_art", name:"Artifact", region:"Ironwood", type:"Artifact", cost:2, maxHealth:4, description:"x", rarity:"Rare", emoji:"A" },
  { defId:"rt_equip", name:"Equip", region:"Emberhold", type:"Equipment", cost:2, equipment:{buffPower:1,buffHealth:2,keywords:["Flying"]}, description:"x", rarity:"Epic", emoji:"Q" },
  { defId:"rt_sentinel", name:"Sent", region:"Tempestade", type:"Sentinela", cost:5, sentinela:{startingLoyalty:4,abilities:[{cost:-1,description:"x",effect:{kind:"grantKeyword",amount:0,target:"allyUnit",keyword:"Flying",also:{kind:"buffUnit",amount:0,target:"allyUnit",buffPower:1,buffHealth:1}}}]}, description:"x", rarity:"Legend", emoji:"P" },
];
for (const sample of typeSamples) { const r = normalizeCardForRoundTrip(sample); check(r.type === sample.type, `type sample failed: ${sample.type}`); }
const effectSamples: Partial<Record<(typeof CARD_EFFECT_KINDS)[number], Partial<CardEffect>>> = {
  damageUnit: { target: "enemyUnit" }, healUnit: { target: "allyUnit" }, buffUnit: { target: "allyUnit", buffPower: 1 },
  buffSelf: { target: "self", buffPower: 1 }, buffAllies: { target: "none", buffPower: 1 }, buffRace: { target: "none", buffPower: 1, race: "Dragon" },
  buffClass: { target: "none", buffPower: 1, classKey: "mage" }, grantBarrier: { target: "allyUnit" }, grantKeyword: { target: "allyUnit", keyword: "Barrier" },
  summonToken: { target: "none", tokenDefId: "ember_whelp" }, attachEquipment: { target: "allyUnit", equipmentDefId: "ember_soulblade" },
  destroyPermanent: { target: "enemyPermanent" }, damagePermanent: { target: "enemyPermanent" }, negateSpell: { target: "spellOnStack" },
  frostbite: { target: "enemyUnit" }, stun: { target: "enemyUnit" }, recall: { target: "enemyUnit" }, killUnit: { target: "enemyUnit" },
};
for (const kind of CARD_EFFECT_KINDS) {
  const sample = { kind, amount: 1, target: "none", ...(effectSamples[kind] || {}) };
  check(!!sanitizeCardEffect(sample), `effect kind not authorable: ${kind}`);
}
for (const original of baseCardsOnly()) {
  try {
    const rebuilt = normalizeCardForRoundTrip(original);
    const keys = Object.keys(original) as (keyof CardDef)[];
    for (const key of keys) {
      const a = original[key];
      const b = rebuilt[key];
      // collectible is intentionally implicit=true in legacy base definitions.
      if (key === "collectible" && original.collectible === undefined && rebuilt.collectible === true) continue;
      check(same(a, b), `${original.defId}.${String(key)} changed: ${stable(a)} -> ${stable(b)}`);
    }
  } catch (e) { failures.push(`${original.defId}: ${e instanceof Error ? e.message : String(e)}`); }
}

if (failures.length) {
  console.error(`CARD AUTHORING ROUND-TRIP FAILED: ${failures.length} failures / ${passed} passed`);
  for (const f of failures.slice(0, 100)) console.error(" -", f);
  process.exit(1);
}
console.log(`CARD AUTHORING ROUND-TRIP PASS: ${passed} checks across ${baseCardsOnly().length} cards`);
