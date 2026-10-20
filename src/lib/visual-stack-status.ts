import type { UnitInstance } from "@/game/types";

/** Read-only projection of real 1v1 engine fields. Never mutates combat state. */
export type VisualStackStatus = {
  total: number;
  attacking: number;
  spentAttack: number;
  damaged: number;
  buffed: number;
  impaired: number;
};

export function summarizeVisualStackStatus(units: readonly UnitInstance[]): VisualStackStatus {
  return {
    total: units.length,
    attacking: units.filter(unit => unit.isAttacking).length,
    spentAttack: units.filter(unit => unit.hasAttackedThisTurn).length,
    damaged: units.filter(unit => unit.health < unit.maxHealth).length,
    buffed: units.filter(unit => unit.powerBuffs > 0 || unit.healthBuffs > 0 || (unit.auraPowerBonus ?? 0) > 0 || (unit.auraHealthBonus ?? 0) > 0).length,
    impaired: units.filter(unit => unit.stunned || unit.frostbitten || unit.poisonCounters > 0).length,
  };
}
