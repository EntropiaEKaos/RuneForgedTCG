import { getCard } from "./cards";
import type { GameState, PermanentStatAura, UnitInstance } from "./types";

/**
 * Supported concrete slice of the broader Aura family.
 *
 * This contract intentionally covers only continuous allied-Unit stat bonuses
 * emitted by Enchantments/Artifacts. Keyword auras, enemy debuffs and generic
 * layer ordering remain outside this boundary, so Ability System `aura` stays
 * honestly marked as partial.
 */
export const PERMANENT_STAT_AURA_CONTRACT = {
  rule: "permanentStatAura",
  sources: ["Enchantment", "Artifact"],
  target: "allyUnit",
  stats: ["power", "health"],
  lifecycle: "whileSourceInPlay",
  stacking: "additive",
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

/** Derive the live Aura contribution from authoritative battlefield state. */
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
  return result;
}
