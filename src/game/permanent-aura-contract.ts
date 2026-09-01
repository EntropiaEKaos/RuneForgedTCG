import "./aura-2-types";
import { auraConditionMatches } from "./aura-condition-contract";
import { getCard } from "./cards";
import { AURA_GRANTABLE_KEYWORDS, AURA_SUPPRESSIBLE_KEYWORDS } from "./keywords";
import type { CardDef, GameState, Keyword, PermanentStatAura, PlayerId, UnitInstance } from "./types";

/** Supported continuous allied-Unit stat slice of the broader Aura family. */
export const PERMANENT_STAT_AURA_CONTRACT = {
  rule: "permanentStatAura",
  sources: ["Enchantment", "Artifact"],
  target: "allyUnit",
  stats: ["power", "health"],
  lifecycle: "whileSourceInPlay",
  stacking: "additive",
  support: "supported",
} as const;

/** Aura 2.1 slice: non-positive continuous stat modifiers applied to enemy Units. */
export const PERMANENT_ENEMY_STAT_AURA_CONTRACT = {
  rule: "permanentEnemyStatAura",
  sources: ["Enchantment", "Artifact"],
  target: "enemyUnit",
  stats: ["power", "health"],
  direction: "nonPositive",
  powerFloor: 0,
  lifecycle: "whileSourceInPlay",
  stacking: "additive",
  support: "supported",
} as const;

/** Aura 2.0 slice: source-bound keyword grants with deterministic set-union stacking. */
export const PERMANENT_KEYWORD_AURA_CONTRACT = {
  rule: "permanentKeywordAura",
  sources: ["Enchantment", "Artifact"],
  target: "allyUnit",
  keywords: AURA_GRANTABLE_KEYWORDS,
  lifecycle: "whileSourceInPlay",
  stacking: "setUnion",
  support: "supported",
} as const;

/** Aura 2.2 slice: hostile source-bound keyword suppression applied after all grants. */
export const PERMANENT_KEYWORD_SUPPRESSION_AURA_CONTRACT = {
  rule: "permanentKeywordSuppressionAura",
  sources: ["Enchantment", "Artifact"],
  target: "enemyUnit",
  keywords: AURA_SUPPRESSIBLE_KEYWORDS,
  lifecycle: "whileSourceInPlay",
  stacking: "setUnion",
  precedence: "afterDurableAndAuraGrants",
  restoration: "automaticWhenSourceLeaves",
  support: "supported",
} as const;

/** Aura 2.3 slice: living Unit sources reuse the certified Aura payload but never affect themselves. */
export const UNIT_SOURCE_AURA_CONTRACT = {
  rule: "unitSourceAura",
  sources: ["Unit"],
  sourceZone: "bench",
  targets: ["allyUnit", "enemyUnit"],
  selfExclusion: "sourceInstanceAlwaysExcluded",
  alliedEffects: ["nonNegativeStats", "keywordGrants"],
  enemyEffects: ["nonPositiveStats", "keywordSuppressions"],
  lifecycle: "whileSourceAliveOnBench",
  statStacking: "additive",
  keywordStacking: "setUnion",
  support: "supported",
} as const;

/** Aura 2.4 slice: Sentinelas project command Auras while they have positive loyalty. */
export const SENTINELA_SOURCE_AURA_CONTRACT = {
  rule: "sentinelaSourceAura",
  sources: ["Sentinela"],
  sourceZone: "sentinelas",
  targets: ["allyUnit", "enemyUnit"],
  alliedEffects: ["nonNegativeStats", "keywordGrants"],
  enemyEffects: ["nonPositiveStats", "keywordSuppressions"],
  lifecycle: "whileSourceHasPositiveLoyalty",
  statStacking: "additive",
  keywordStacking: "setUnion",
  support: "supported",
} as const;

const AURA_PLAYERS = ["player", "ai"] as const satisfies readonly PlayerId[];

type AuraSource = {
  owner: PlayerId;
  instanceId: string;
  def: CardDef;
  excludeSelfUnit: boolean;
};

function matchesAny(haystack: readonly string[] | undefined, needles: readonly string[] | undefined): boolean {
  if (!needles?.length) return true;
  if (!haystack?.length) return false;
  return needles.some((needle) => haystack.includes(needle));
}

/**
 * Enumerate authoritative live Aura sources without creating a second runtime.
 * Permanent sources remain exactly as certified by Aura 2.0-2.2; Aura 2.3 adds
 * living Units; Aura 2.4 adds positive-loyalty Sentinelas; Aura 2.5 additionally
 * requires an optional controller-scoped condition to be true.
 */
function auraSources(state: GameState): AuraSource[] {
  const result: AuraSource[] = [];
  for (const owner of AURA_PLAYERS) {
    for (const permanent of state.players[owner].permanents) {
      if (permanent.health <= 0) continue;
      const def = getCard(permanent.defId);
      if ((def.type !== "Enchantment" && def.type !== "Artifact") || !def.aura) continue;
      if (!auraConditionMatches(state, owner, def.aura.condition)) continue;
      result.push({ owner, instanceId: permanent.instanceId, def, excludeSelfUnit: false });
    }
    for (const unit of state.players[owner].bench) {
      if (unit.health <= 0) continue;
      const def = getCard(unit.defId);
      if (def.type !== "Unit" || !def.aura) continue;
      if (!auraConditionMatches(state, owner, def.aura.condition)) continue;
      result.push({ owner, instanceId: unit.instanceId, def, excludeSelfUnit: true });
    }
    for (const sentinela of state.players[owner].sentinelas) {
      if (sentinela.loyalty <= 0) continue;
      const def = getCard(sentinela.defId);
      if (def.type !== "Sentinela" || !def.aura) continue;
      if (!auraConditionMatches(state, owner, def.aura.condition)) continue;
      result.push({ owner, instanceId: sentinela.instanceId, def, excludeSelfUnit: false });
    }
  }
  return result;
}

/** Race-list and class-list are OR internally; when both exist they combine as AND. */
export function permanentAuraAppliesToUnit(aura: PermanentStatAura, unit: UnitInstance): boolean {
  return matchesAny(unit.races, aura.races) && matchesAny(unit.classes, aura.classes);
}

/**
 * Relationship gate between an Aura source and a candidate Unit. Missing
 * audience means legacy allies. Unit-source Auras may additionally exclude the
 * exact source instance; non-Unit sources never need that exclusion.
 */
export function permanentAuraAffectsUnit(
  aura: PermanentStatAura,
  sourceOwner: PlayerId,
  unit: UnitInstance,
  sourceInstanceId?: string,
  excludeSourceInstance = Boolean(sourceInstanceId),
): boolean {
  if (excludeSourceInstance && sourceInstanceId === unit.instanceId) return false;
  const audience = aura.affects ?? "allies";
  const relationshipMatches = audience === "enemies" ? sourceOwner !== unit.owner : sourceOwner === unit.owner;
  return relationshipMatches && permanentAuraAppliesToUnit(aura, unit);
}

export interface PermanentAuraBonus {
  power: number;
  health: number;
  sources: number;
}

/**
 * Capture every known durable source before replacing the previous Aura layer.
 * Printed and Equipment keywords are recovered from CardDefs, so an overlapping
 * Aura or suppression can never erase their provenance. Existing durable entries
 * carry one-shot grants that were explicitly recorded by grantDurableKeyword().
 */
function captureDurableKeywords(unit: UnitInstance): Keyword[] {
  const result = new Set<Keyword>(unit.durableKeywords ?? []);
  const priorAura = new Set(unit.auraKeywords ?? []);
  for (const keyword of unit.keywords) {
    if (!priorAura.has(keyword)) result.add(keyword);
  }
  for (const keyword of getCard(unit.defId).keywords ?? []) result.add(keyword);
  for (const equipment of unit.equipment) {
    const def = getCard(equipment.defId);
    for (const keyword of def.equipment?.keywords ?? []) result.add(keyword);
  }
  return [...result];
}

/** Rebuild the effective keyword view: durable + allied Aura grants, then hostile suppression. */
export function recomputeEffectiveKeywords(unit: UnitInstance): void {
  const durable = [...new Set(unit.durableKeywords ?? [])];
  const aura = [...new Set(unit.auraKeywords ?? [])];
  const suppressed = [...new Set(unit.auraSuppressedKeywords ?? [])];
  const suppressedSet = new Set(suppressed);
  unit.durableKeywords = durable;
  unit.auraKeywords = aura;
  unit.auraSuppressedKeywords = suppressed;
  unit.keywords = [...new Set([...durable, ...aura])].filter((keyword) => !suppressedSet.has(keyword));
}

/** Record a persistent grant even when the same keyword is currently granted or suppressed by an Aura. */
export function grantDurableKeyword(unit: UnitInstance, keyword: Keyword): void {
  const durable = new Set(captureDurableKeywords(unit));
  durable.add(keyword);
  unit.durableKeywords = [...durable];
  recomputeEffectiveKeywords(unit);
}

/** Pure derivation of source-bound keyword grants for an allied Unit. */
export function permanentAuraKeywordsForUnit(state: GameState, unit: UnitInstance): Keyword[] {
  const result = new Set<Keyword>();
  for (const source of auraSources(state)) {
    const aura = source.def.aura!;
    if ((aura.affects ?? "allies") !== "allies") continue;
    if (!permanentAuraAffectsUnit(aura, source.owner, unit, source.instanceId, source.excludeSelfUnit)) continue;
    for (const keyword of aura.keywords ?? []) {
      if (AURA_GRANTABLE_KEYWORDS.includes(keyword)) result.add(keyword);
    }
  }
  return [...result];
}

/** Pure derivation of source-bound hostile keyword suppressions for an enemy Unit. */
export function permanentAuraSuppressedKeywordsForUnit(state: GameState, unit: UnitInstance): Keyword[] {
  const result = new Set<Keyword>();
  for (const source of auraSources(state)) {
    const aura = source.def.aura!;
    if (aura.affects !== "enemies") continue;
    if (!permanentAuraAffectsUnit(aura, source.owner, unit, source.instanceId, source.excludeSelfUnit)) continue;
    for (const keyword of aura.suppressKeywords ?? []) {
      if (AURA_SUPPRESSIBLE_KEYWORDS.includes(keyword)) result.add(keyword);
    }
  }
  return [...result];
}

function durablePowerBeforeAura(unit: UnitInstance): number {
  const def = getCard(unit.defId);
  let equipmentPower = 0;
  for (const equipment of unit.equipment) {
    equipmentPower += getCard(equipment.defId).equipment?.buffPower ?? 0;
  }
  return (def.power ?? 0) + equipmentPower + unit.powerBuffs;
}

function durableHealthBeforeAura(unit: UnitInstance): number {
  const def = getCard(unit.defId);
  let equipmentHealth = 0;
  for (const equipment of unit.equipment) {
    equipmentHealth += getCard(equipment.defId).equipment?.buffHealth ?? 0;
  }
  return (def.health ?? 0) + equipmentHealth + unit.permanentHealthModifier + unit.healthBuffs;
}

/** Derive live Aura contribution from authoritative battlefield state. */
export function permanentAuraBonusForUnit(state: GameState, unit: UnitInstance): PermanentAuraBonus {
  const result: PermanentAuraBonus = { power: 0, health: 0, sources: 0 };
  for (const source of auraSources(state)) {
    const aura = source.def.aura!;
    if (!permanentAuraAffectsUnit(aura, source.owner, unit, source.instanceId, source.excludeSelfUnit)) continue;
    result.power += aura.buffPower;
    result.health += aura.buffHealth;
    result.sources += 1;
  }

  if (result.power < 0) {
    const durablePower = Math.max(0, durablePowerBeforeAura(unit));
    result.power = Math.max(result.power, -durablePower);
  }
  if (result.health < 0) {
    const durableHealth = Math.max(0, durableHealthBeforeAura(unit));
    result.health = Math.max(result.health, -durableHealth);
  }

  unit.durableKeywords = captureDurableKeywords(unit);
  unit.auraKeywords = permanentAuraKeywordsForUnit(state, unit);
  unit.auraSuppressedKeywords = permanentAuraSuppressedKeywordsForUnit(state, unit);
  recomputeEffectiveKeywords(unit);
  return result;
}
