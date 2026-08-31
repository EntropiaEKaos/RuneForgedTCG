import { getCard } from "./cards";
import { AURA_GRANTABLE_KEYWORDS } from "./keywords";
import type { GameState, Keyword, PermanentStatAura, UnitInstance } from "./types";

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

function matchesAny(haystack: readonly string[] | undefined, needles: readonly string[] | undefined): boolean {
  if (!needles?.length) return true;
  if (!haystack?.length) return false;
  return needles.some((needle) => haystack.includes(needle));
}

/** Race-list and class-list are OR internally; when both exist they combine as AND. */
export function permanentAuraAppliesToUnit(aura: PermanentStatAura, unit: UnitInstance): boolean {
  return matchesAny(unit.races, aura.races) && matchesAny(unit.classes, aura.classes);
}

export interface PermanentAuraBonus {
  power: number;
  health: number;
  sources: number;
}

function inferredDurableKeywords(unit: UnitInstance): Keyword[] {
  const priorAura = new Set(unit.auraKeywords ?? []);
  return unit.keywords.filter((keyword) => !priorAura.has(keyword));
}

/** Rebuild the effective keyword view from durable state plus current Aura contribution. */
export function recomputeEffectiveKeywords(unit: UnitInstance): void {
  const durable = [...new Set(unit.durableKeywords ?? inferredDurableKeywords(unit))];
  const aura = [...new Set(unit.auraKeywords ?? [])];
  unit.durableKeywords = durable;
  unit.auraKeywords = aura;
  unit.keywords = [...new Set([...durable, ...aura])];
}

/** Record a persistent grant even when the same keyword is currently supplied by an Aura. */
export function grantDurableKeyword(unit: UnitInstance, keyword: Keyword): void {
  const durable = new Set(unit.durableKeywords ?? inferredDurableKeywords(unit));
  durable.add(keyword);
  unit.durableKeywords = [...durable];
  recomputeEffectiveKeywords(unit);
}

/** Pure derivation of source-bound keyword grants for an allied Unit. */
export function permanentAuraKeywordsForUnit(state: GameState, unit: UnitInstance): Keyword[] {
  const result = new Set<Keyword>();
  for (const permanent of state.players[unit.owner].permanents) {
    if (permanent.health <= 0) continue;
    const def = getCard(permanent.defId);
    if ((def.type !== "Enchantment" && def.type !== "Artifact") || !def.aura) continue;
    if (!permanentAuraAppliesToUnit(def.aura, unit)) continue;
    for (const keyword of def.aura.keywords ?? []) {
      if (AURA_GRANTABLE_KEYWORDS.includes(keyword)) result.add(keyword);
    }
  }
  return [...result];
}

/**
 * Derive the live Aura contribution from authoritative battlefield state.
 *
 * `engine/state.ts` already calls this function whenever a Unit is created or
 * continuous Auras are recomputed. Aura 2.0 deliberately piggybacks on that
 * certified lifecycle so stat and keyword grants cannot drift into different
 * refresh paths. The returned object remains stat-only for compatibility.
 */
export function permanentAuraBonusForUnit(state: GameState, unit: UnitInstance): PermanentAuraBonus {
  const result: PermanentAuraBonus = { power: 0, health: 0, sources: 0 };
  for (const permanent of state.players[unit.owner].permanents) {
    if (permanent.health <= 0) continue;
    const def = getCard(permanent.defId);
    if ((def.type !== "Enchantment" && def.type !== "Artifact") || !def.aura) continue;
    if (!permanentAuraAppliesToUnit(def.aura, unit)) continue;
    result.power += def.aura.buffPower;
    result.health += def.aura.buffHealth;
    result.sources += 1;
  }

  unit.auraKeywords = permanentAuraKeywordsForUnit(state, unit);
  recomputeEffectiveKeywords(unit);
  return result;
}
