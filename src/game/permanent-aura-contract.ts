import "./aura-2-types";
import { getCard } from "./cards";
import { AURA_GRANTABLE_KEYWORDS } from "./keywords";
import type { GameState, Keyword, PermanentStatAura, PlayerId, UnitInstance } from "./types";

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

const AURA_PLAYERS = ["player", "ai"] as const satisfies readonly PlayerId[];

function matchesAny(haystack: readonly string[] | undefined, needles: readonly string[] | undefined): boolean {
  if (!needles?.length) return true;
  if (!haystack?.length) return false;
  return needles.some((needle) => haystack.includes(needle));
}

/** Race-list and class-list are OR internally; when both exist they combine as AND. */
export function permanentAuraAppliesToUnit(aura: PermanentStatAura, unit: UnitInstance): boolean {
  return matchesAny(unit.races, aura.races) && matchesAny(unit.classes, aura.classes);
}

/** Relationship gate between an Aura source and a candidate Unit. Missing audience means legacy allies. */
export function permanentAuraAffectsUnit(
  aura: PermanentStatAura,
  sourceOwner: PlayerId,
  unit: UnitInstance,
): boolean {
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
 * Aura can never hide their provenance. Existing durable entries carry one-shot
 * grants that were explicitly recorded by grantDurableKeyword().
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

/** Rebuild the effective keyword view from explicit durable state plus current Aura contribution. */
export function recomputeEffectiveKeywords(unit: UnitInstance): void {
  const durable = [...new Set(unit.durableKeywords ?? [])];
  const aura = [...new Set(unit.auraKeywords ?? [])];
  unit.durableKeywords = durable;
  unit.auraKeywords = aura;
  unit.keywords = [...new Set([...durable, ...aura])];
}

/** Record a persistent grant even when the same keyword is currently supplied by an Aura. */
export function grantDurableKeyword(unit: UnitInstance, keyword: Keyword): void {
  const durable = new Set(captureDurableKeywords(unit));
  durable.add(keyword);
  unit.durableKeywords = [...durable];
  recomputeEffectiveKeywords(unit);
}

/** Pure derivation of source-bound keyword grants for an allied Unit. */
export function permanentAuraKeywordsForUnit(state: GameState, unit: UnitInstance): Keyword[] {
  const result = new Set<Keyword>();
  for (const sourceOwner of AURA_PLAYERS) {
    for (const permanent of state.players[sourceOwner].permanents) {
      if (permanent.health <= 0) continue;
      const def = getCard(permanent.defId);
      if ((def.type !== "Enchantment" && def.type !== "Artifact") || !def.aura) continue;
      // Aura 2.1 intentionally does not grant/remove keywords across enemy lines.
      if ((def.aura.affects ?? "allies") !== "allies") continue;
      if (!permanentAuraAffectsUnit(def.aura, sourceOwner, unit)) continue;
      for (const keyword of def.aura.keywords ?? []) {
        if (AURA_GRANTABLE_KEYWORDS.includes(keyword)) result.add(keyword);
      }
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

/**
 * Derive the live Aura contribution from authoritative battlefield state.
 *
 * Aura 2.1 scans both sides because an enemy-facing source contributes to the
 * opposing bench. Stat modifiers remain additive, but the Aura layer alone is
 * clamped so it can never drive an otherwise non-negative Unit below 0 Power;
 * this prevents negative combat damage from becoming accidental healing.
 */
export function permanentAuraBonusForUnit(state: GameState, unit: UnitInstance): PermanentAuraBonus {
  const result: PermanentAuraBonus = { power: 0, health: 0, sources: 0 };
  for (const sourceOwner of AURA_PLAYERS) {
    for (const permanent of state.players[sourceOwner].permanents) {
      if (permanent.health <= 0) continue;
      const def = getCard(permanent.defId);
      if ((def.type !== "Enchantment" && def.type !== "Artifact") || !def.aura) continue;
      if (!permanentAuraAffectsUnit(def.aura, sourceOwner, unit)) continue;
      result.power += def.aura.buffPower;
      result.health += def.aura.buffHealth;
      result.sources += 1;
    }
  }

  if (result.power < 0) {
    const durablePower = Math.max(0, durablePowerBeforeAura(unit));
    result.power = Math.max(result.power, -durablePower);
  }

  unit.durableKeywords = captureDurableKeywords(unit);
  unit.auraKeywords = permanentAuraKeywordsForUnit(state, unit);
  recomputeEffectiveKeywords(unit);
  return result;
}
