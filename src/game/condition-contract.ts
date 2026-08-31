import { MECHANIC_CONDITION_KINDS, sanitizeMechanicCondition } from "./card-authoring";
import type { MechanicCondition } from "./types";

export type MechanicConditionKind = (typeof MECHANIC_CONDITION_KINDS)[number];
export type ConditionRuntimeSupport = "supported";

export const CONDITION_COMPOSITE_KINDS = ["and", "or", "not"] as const satisfies readonly MechanicConditionKind[];

const CONDITION_PROBES: Record<MechanicConditionKind, MechanicCondition> = {
  always: { kind: "always" },
  selfDamaged: { kind: "selfDamaged" },
  allyRace: { kind: "allyRace", race: "Dragon", min: 1 },
  allyClass: { kind: "allyClass", classKey: "mage", min: 1 },
  nexusBelow: { kind: "nexusBelow", amount: 1 },
  manaAtLeast: { kind: "manaAtLeast", amount: 1 },
  and: { kind: "and", children: [{ kind: "always" }] },
  or: { kind: "or", children: [{ kind: "always" }] },
  not: { kind: "not", child: { kind: "always" } },
};

/**
 * This contract deliberately derives authoring capacity from the authoritative
 * sanitizer instead of duplicating its numeric limits in Studio code. If the
 * backend contract changes, these values and helpers change with it.
 */
export const CONDITION_RUNTIME_SUPPORT = Object.fromEntries(
  MECHANIC_CONDITION_KINDS.map((kind) => [kind, "supported"]),
) as Record<MechanicConditionKind, ConditionRuntimeSupport>;

export function conditionKindSupportedAtDepth(kind: MechanicConditionKind, depth = 0): boolean {
  return sanitizeMechanicCondition(CONDITION_PROBES[kind], depth) !== null;
}

export function conditionKindsAtDepth(depth = 0): MechanicConditionKind[] {
  return MECHANIC_CONDITION_KINDS.filter((kind) => conditionKindSupportedAtDepth(kind, depth));
}

export function conditionTreeSupported(condition: MechanicCondition, depth = 0): boolean {
  return sanitizeMechanicCondition(condition, depth) !== null;
}

export function conditionCanAddChild(
  condition: Extract<MechanicCondition, { kind: "and" | "or" }>,
  depth = 0,
): boolean {
  return sanitizeMechanicCondition(
    { kind: condition.kind, children: [...condition.children, { kind: "always" }] },
    depth,
  ) !== null;
}

function detectMaxSupportedDepth(): number {
  let depth = 0;
  while (depth < 64 && conditionKindSupportedAtDepth("always", depth)) depth += 1;
  return Math.max(0, depth - 1);
}

function detectMaxGroupChildren(): number {
  let count = 0;
  while (count < 64) {
    const candidate: MechanicCondition = {
      kind: "and",
      children: Array.from({ length: count + 1 }, () => ({ kind: "always" } as MechanicCondition)),
    };
    if (!conditionTreeSupported(candidate)) break;
    count += 1;
  }
  return count;
}

export const CONDITION_MAX_SUPPORTED_DEPTH = detectMaxSupportedDepth();
export const CONDITION_MAX_GROUP_CHILDREN = detectMaxGroupChildren();

export const CONDITION_AUTHORING_CONTRACT = {
  kinds: MECHANIC_CONDITION_KINDS,
  support: CONDITION_RUNTIME_SUPPORT,
  compositeKinds: CONDITION_COMPOSITE_KINDS,
  maxDepth: CONDITION_MAX_SUPPORTED_DEPTH,
  maxGroupChildren: CONDITION_MAX_GROUP_CHILDREN,
} as const;
