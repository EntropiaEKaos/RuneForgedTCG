import { sanitizeMechanicCondition } from "./card-authoring";
import type { GameState, MechanicCondition, PlayerId } from "./types";

export const AURA_CONDITION_KINDS = [
  "always",
  "allyRace",
  "allyClass",
  "nexusBelow",
  "manaAtLeast",
  "and",
  "or",
  "not",
] as const;

export const CONDITIONAL_AURA_CONTRACT = {
  rule: "conditionalAura",
  conditions: AURA_CONDITION_KINDS,
  controllerScoped: true,
  unsupportedConditions: ["selfDamaged"],
  composition: ["and", "or", "not"],
  lifecycle: "recomputeWhenAuthoritativeStateChanges",
  malformedRuntime: "inactiveFailClosed",
  support: "supported",
} as const;

/** Aura 2.5 intentionally excludes source-relative selfDamaged semantics. */
export function auraConditionTreeSupported(condition: MechanicCondition): boolean {
  if (condition.kind === "selfDamaged") return false;
  if (condition.kind === "and" || condition.kind === "or") {
    return condition.children.every(auraConditionTreeSupported);
  }
  if (condition.kind === "not") return auraConditionTreeSupported(condition.child);
  return (AURA_CONDITION_KINDS as readonly string[]).includes(condition.kind);
}

/** Strict authoring boundary: unlike the generic sanitizer, explicit malformed/null input is rejected. */
export function sanitizeAuraCondition(raw: unknown): MechanicCondition | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const condition = sanitizeMechanicCondition(raw);
  if (!condition || !auraConditionTreeSupported(condition)) return null;
  return condition;
}

/** Evaluate only controller-scoped state; no target stats or other continuous layers participate. */
export function auraConditionMatches(
  state: GameState,
  sourceOwner: PlayerId,
  condition: MechanicCondition | undefined,
): boolean {
  if (!condition || condition.kind === "always") return true;
  if (!auraConditionTreeSupported(condition)) return false;
  if (condition.kind === "and") return condition.children.every((child) => auraConditionMatches(state, sourceOwner, child));
  if (condition.kind === "or") return condition.children.some((child) => auraConditionMatches(state, sourceOwner, child));
  if (condition.kind === "not") return !auraConditionMatches(state, sourceOwner, condition.child);

  const player = state.players[sourceOwner];
  if (condition.kind === "allyRace") {
    return player.bench.filter((unit) => unit.race === condition.race || unit.races.includes(condition.race)).length >= condition.min;
  }
  if (condition.kind === "allyClass") {
    return player.bench.filter((unit) => (unit.classes ?? []).includes(condition.classKey)).length >= condition.min;
  }
  if (condition.kind === "nexusBelow") return player.nexusHealth <= condition.amount;
  if (condition.kind === "manaAtLeast") return player.mana >= condition.amount;
  return false;
}
