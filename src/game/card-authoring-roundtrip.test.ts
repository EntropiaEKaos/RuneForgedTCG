import { baseCardsOnly, getCard } from "./cards";
import {
  CARD_EFFECT_KINDS, CARD_KEYWORDS, CARD_RACES, CARD_REGIONS, CARD_TRIGGERS,
  normalizeCardForRoundTrip, sanitizeCardEffect, sanitizeCardMechanic, validateAuthorableCard,
} from "./card-authoring";
import {
  CANONICAL_KEYWORDS,
  KEYWORD_INFO,
  keywordCardContractError,
  keywordIsGrantable,
} from "./keywords";
import {
  cardTriggerIsExecutable,
  isTriggerSupported,
  supportedTriggerEvents,
  triggerContractError,
} from "./trigger-contract";
import type { CardDef, CardEffect, CardType, TriggerWhen } from "./types";

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
check(same(CARD_KEYWORDS, CANONICAL_KEYWORDS), "Card Studio keyword vocabulary drifted from canonical Keyword Contract");
check(CARD_EFFECT_KINDS.includes("mill"), "mill missing from canonical authoring catalog");
for (const keyword of CANONICAL_KEYWORDS) {
  const contract = KEYWORD_INFO[keyword];
  check(contract.support === "supported", `${keyword} is not certified as runtime-supported`);
  check(contract.runtimeDomains.length > 0, `${keyword} has no authoritative runtime domain`);
}
check(!keywordIsGrantable("LastBreath"), "LastBreath must not be generically grantable without a death ability contract");
check(keywordIsGrantable("Barrier"), "ordinary runtime keyword Barrier should remain grantable");
check(keywordIsGrantable("Haste"), "ordinary runtime keyword Haste should remain grantable");

const composite: CardEffect = {
  kind: "damageUnit", amount: 2, target: "enemyUnit", race: "Anjo", races: ["Besta", "Tempesteiro"],
  classKey: "mage", classKeys: ["mage", "arcane"], keyword: "Flying",
  also: { kind: "mill", amount: 3, target: "none", also: { kind: "draw", amount: 1, target: "none" } },
};
check(same(sanitizeCardEffect(composite), composite), "recursive CardEffect round-trip lost fields");
check(
  sanitizeCardEffect({ kind:"grantKeyword", amount:0, target:"allyUnit", keyword:"LastBreath" }) === null,
  "grantKeyword must reject LastBreath because the granted marker has no portable death effect",
);
check(
  !!sanitizeCardEffect({ kind:"grantKeyword", amount:0, target:"allyUnit", keyword:"Haste" }),
  "grantKeyword must continue accepting ordinary grantable runtime keywords",
);

const typeSamples: CardDef[] = [
  { defId:"rt_unit", name:"Unit", region:"Florestia", type:"Unit", cost:1, power:1, health:1, race:"Besta", keywords:["Reach"], description:"x", rarity:"Common", emoji:"U" },
  { defId:"rt_spell", name:"Spell", region:"Tempestade", type:"Spell", cost:1, spell:{kind:"mill",amount:2,target:"none",also:{kind:"draw",amount:1,target:"none"}}, speed:"Burst", description:"x", rarity:"Rare", emoji:"S" },
  { defId:"rt_ench", name:"Ench", region:"Tidecall", type:"Enchantment", cost:2, maxHealth:3, trigger:{when:"onRoundStart",effect:{kind:"draw",amount:1,target:"none"}}, description:"x", rarity:"Epic", emoji:"E" },
  { defId:"rt_art", name:"Artifact", region:"Ironwood", type:"Artifact", cost:2, maxHealth:4, description:"x", rarity:"Rare", emoji:"A" },
  { defId:"rt_equip", name:"Equip", region:"Emberhold", type:"Equipment", cost:2, equipment:{buffPower:1,buffHealth:2,keywords:["Flying"]}, description:"x", rarity:"Epic", emoji:"Q" },
  { defId:"rt_sentinel", name:"Sent", region:"Tempestade", type:"Sentinela", cost:5, sentinela:{startingLoyalty:4,abilities:[{cost:-1,description:"x",effect:{kind:"grantKeyword",amount:0,target:"allyUnit",keyword:"Flying",also:{kind:"buffUnit",amount:0,target:"allyUnit",buffPower:1,buffHealth:1}}}]}, description:"x", rarity:"Legend", emoji:"P" },
];
for (const sample of typeSamples) { const r = normalizeCardForRoundTrip(sample); check(r.type === sample.type, `type sample failed: ${sample.type}`); }

const inertLastBreath: CardDef = {
  defId:"rt_inert_last_breath", name:"Inert Last Breath", region:"Emberhold", type:"Unit", cost:1,
  power:1, health:1, keywords:["LastBreath"], description:"x", rarity:"Common", emoji:"D",
};
const inertLastBreathResult = validateAuthorableCard(inertLastBreath);
check(!inertLastBreathResult.ok, "printed LastBreath without onDeath must fail closed instead of publishing inert content");
check(
  keywordCardContractError(inertLastBreath)?.includes("onDeath") === true,
  "LastBreath contract error must explain its required onDeath trigger",
);
const executableLastBreath: CardDef = {
  ...inertLastBreath,
  defId:"rt_executable_last_breath",
  trigger:{ when:"onDeath", effect:{kind:"draw",amount:1,target:"none"} },
};
check(validateAuthorableCard(executableLastBreath).ok, "printed LastBreath with executable onDeath must remain authorable");
check(keywordCardContractError(executableLastBreath) === null, "executable LastBreath should satisfy Keyword Contract");
const mechanicLastBreath: CardDef = {
  ...inertLastBreath,
  defId:"rt_mechanic_last_breath",
  mechanics:[{ key:"last_breath_probe", trigger:"onDeath", condition:{kind:"always"}, effect:{kind:"draw",amount:1,target:"none"} }],
};
check(validateAuthorableCard(mechanicLastBreath).ok, "LastBreath may be backed by an embedded executable onDeath mechanic");
const invalidLastBreathEquipment: CardDef = {
  defId:"rt_last_breath_equipment", name:"Invalid Equipment", region:"Emberhold", type:"Equipment", cost:1,
  equipment:{buffPower:1,buffHealth:0,keywords:["LastBreath"]}, description:"x", rarity:"Common", emoji:"Q",
};
check(!validateAuthorableCard(invalidLastBreathEquipment).ok, "Equipment must reject non-grantable LastBreath");
const validFlyingEquipment: CardDef = {
  ...invalidLastBreathEquipment,
  defId:"rt_flying_equipment",
  equipment:{buffPower:1,buffHealth:0,keywords:["Flying"]},
};
check(validateAuthorableCard(validFlyingEquipment).ok, "Equipment must continue accepting ordinary grantable keywords");
const canonicalMagmaEgg = getCard("ember_lastbreath");
check(keywordCardContractError(canonicalMagmaEgg) === null, "canonical Magma Egg must satisfy LastBreath/onDeath contract");

const triggerEffect: CardEffect = { kind: "draw", amount: 1, target: "none" };
const expectedTriggerEvents: Record<CardType, readonly TriggerWhen[]> = {
  Unit: ["onSummon", "onStrike", "onNexusStrike", "onRoundStart", "onLevelUp", "onKill", "onAttack", "onBlock", "onAllyDeath", "onDeath"],
  Spell: [],
  Enchantment: ["onRoundStart", "onPermanentSummon"],
  Artifact: ["onRoundStart", "onPermanentSummon"],
  Equipment: ["onStrike", "onNexusStrike", "onKill", "onAllyDeath"],
  Sentinela: [],
};
for (const sample of typeSamples) {
  check(same(supportedTriggerEvents(sample.type), expectedTriggerEvents[sample.type]), `${sample.type} trigger matrix drifted from certified runtime dispatch`);
  for (const when of CARD_TRIGGERS) {
    const candidate = structuredClone(sample);
    candidate.trigger = { when, effect: structuredClone(triggerEffect) };
    const result = validateAuthorableCard(candidate);
    const expected = isTriggerSupported(sample.type, when);
    check(result.ok === expected, `${sample.type}.${when} authoring support does not match Trigger Source Contract`);
    check((triggerContractError(sample.type, when) === null) === expected, `${sample.type}.${when} contract error mismatch`);
  }
}

check(!!sanitizeCardMechanic({ key:"unit_attack", trigger:"onAttack", condition:{kind:"always"}, effect:triggerEffect }), "Unit mechanic should accept executable onAttack trigger");
check(!sanitizeCardMechanic({ key:"unit_perm", trigger:"onPermanentSummon", condition:{kind:"always"}, effect:triggerEffect }), "Unit mechanic must reject permanent-only trigger");

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
    check(keywordCardContractError(original) === null, `${original.defId} violates canonical Keyword Contract`);
    for (const keyword of original.keywords ?? []) {
      check(KEYWORD_INFO[keyword].support === "supported", `${original.defId}.${keyword} lacks runtime keyword support`);
      check(KEYWORD_INFO[keyword].runtimeDomains.length > 0, `${original.defId}.${keyword} has no runtime domain`);
    }
    for (const keyword of original.equipment?.keywords ?? []) {
      check(keywordIsGrantable(keyword), `${original.defId} Equipment grants non-grantable keyword ${keyword}`);
    }
    if (original.trigger) {
      check(cardTriggerIsExecutable(original), `${original.defId} contains a trigger the runtime source contract cannot execute`);
    }
    for (const mechanic of original.mechanics ?? []) {
      check(isTriggerSupported("Unit", mechanic.trigger), `${original.defId}.${mechanic.key} contains a mechanic trigger Unit runtime cannot execute`);
    }
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
console.log(`CARD AUTHORING ROUND-TRIP PASS: ${passed} checks across ${baseCardsOnly().length} cards · Trigger Source + Keyword Contracts certified`);
