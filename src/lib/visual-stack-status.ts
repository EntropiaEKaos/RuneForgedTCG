import type { StackableUnit } from "./visual-unit-stacks";

/**
 * Read-only visual summary for a group of authoritative units.
 * This module must never determine combat legality or change game state.
 */
export type VisualCombatUnit = StackableUnit & {
  damage?: number;
  isAttacking?: boolean;
  isBlocking?: boolean;
  exhausted?: boolean;
  buffs?: readonly unknown[];
  debuffs?: readonly unknown[];
};

export type VisualStackStatus = {
  total: number;
  attacking: number;
  blocking: number;
  exhausted: number;
  damaged: number;
  buffed: number;
  debuffed: number;
};

export function summarizeVisualStackStatus<T extends VisualCombatUnit>(
  units: readonly T[],
): VisualStackStatus {
  return {
    total: units.length,
    attacking: units.filter(unit => unit.isAttacking === true).length,
    blocking: units.filter(unit => unit.isBlocking === true).length,
    exhausted: units.filter(unit => unit.exhausted === true).length,
    damaged: units.filter(unit => typeof unit.damage === "number" && unit.damage > 0).length,
    buffed: units.filter(unit => (unit.buffs?.length ?? 0) > 0).length,
    debuffed: units.filter(unit => (unit.debuffs?.length ?? 0) > 0).length,
  };
}
