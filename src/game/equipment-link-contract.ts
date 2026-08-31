import type { UnitInstance } from "./types";

/**
 * Canonical linked-equipment boundary.
 *
 * Equipment in RuneForge is not an independent battlefield permanent after it
 * resolves: it is stored on exactly one allied UnitInstance and its stats /
 * keywords are derived through that host. The link ends when the host leaves
 * the battlefield. Generic linked-object authoring remains broader than this
 * concrete Equipment sub-contract.
 */
export const MAX_EQUIPMENT_PER_UNIT = 2;

export const EQUIPMENT_LINK_CONTRACT = {
  rule: "equipmentAttachment",
  target: "allyUnit",
  maxPerUnit: MAX_EQUIPMENT_PER_UNIT,
  lifecycle: "destroyedWithHost",
  support: "supported",
} as const;

export function equipmentSlotsUsed(unit: Pick<UnitInstance, "equipment">): number {
  return unit.equipment.length;
}

export function equipmentSlotsRemaining(unit: Pick<UnitInstance, "equipment">): number {
  return Math.max(0, MAX_EQUIPMENT_PER_UNIT - equipmentSlotsUsed(unit));
}

export function canAttachEquipment(unit: Pick<UnitInstance, "equipment">): boolean {
  return equipmentSlotsRemaining(unit) > 0;
}

export function unitsWithEquipmentCapacity<T extends Pick<UnitInstance, "equipment">>(units: readonly T[]): T[] {
  return units.filter(canAttachEquipment);
}
