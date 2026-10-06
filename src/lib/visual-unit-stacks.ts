/**
 * Presentation-only grouping for Swarm. Never replace the authoritative units with groups.
 * Group membership is by stable instance ID, so individual modifiers and damage stay intact.
 */
export type StackableUnit = { instanceId: string; defId: string };
export type VisualStack<T extends StackableUnit> = {
  id: string;
  defId: string;
  members: T[];
  expanded: boolean;
};
export type StackPreferences = {
  /** Unit IDs pinned outside automatic stacks. */
  separatedIds?: ReadonlySet<string>;
  /** Visual group IDs pinned open. */
  expandedIds?: ReadonlySet<string>;
};
/** Pure projection; preserves the input ordering and original object references. */
export function groupVisualUnits<T extends StackableUnit>(
  units: readonly T[],
  preferences: StackPreferences = {},
): VisualStack<T>[] {
  const groups: VisualStack<T>[] = [];
  const byDefinition = new Map<string, VisualStack<T>>();
  const seen = new Set<string>();
  for (const unit of units) {
    if (seen.has(unit.instanceId)) {
      throw new Error(`Duplicate unit instanceId in visual stack: ${unit.instanceId}`);
    }
    seen.add(unit.instanceId);
    if (preferences.separatedIds?.has(unit.instanceId)) {
      const id = `unit:${unit.instanceId}`;
      groups.push({ id, defId: unit.defId, members: [unit], expanded: true });
      continue;
    }
    let group = byDefinition.get(unit.defId);
    if (!group) {
      const id = `def:${unit.defId}`;
      group = { id, defId: unit.defId, members: [], expanded: preferences.expandedIds?.has(id) ?? false };
      byDefinition.set(unit.defId, group);
      groups.push(group);
    }
    group.members.push(unit);
  }
  return groups;
}
