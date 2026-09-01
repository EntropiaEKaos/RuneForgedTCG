import { sanitizeMechanicCondition } from "./card-authoring";
import type { GameState, MechanicCondition, PlayerId, UnitInstance } from "./types";

export const AURA_CONDITION_KINDS = [
  "always",
  "allyRace",
  "allyClass",
  "enemyRace",
  "enemyClass",
  "allyUnitsAtLeast",
  "enemyUnitsAtLeast",
  "allyPermanentsAtLeast",
  "enemyPermanentsAtLeast",
  "allySentinelasAtLeast",
  "enemySentinelasAtLeast",
  "nexusBelow",
  "opponentNexusBelow",
  "manaAtLeast",
  "opponentManaAtLeast",
  "spellManaAtLeast",
  "opponentSpellManaAtLeast",
  "spellsCastAtLeast",
  "opponentSpellsCastAtLeast",
  "alliesSummonedAtLeast",
  "opponentAlliesSummonedAtLeast",
  "nexusDamageDealtAtLeast",
  "opponentNexusDamageDealtAtLeast",
  "handAtLeast",
  "opponentHandAtLeast",
  "roundAtLeast",
  "and",
  "or",
  "not",
] as const;

export const UNIT_SOURCE_AURA_CONDITION_KINDS = [
  ...AURA_CONDITION_KINDS,
  "selfDamaged",
] as const;

/** Aura 2.5 compatibility contract, extended by Condition 2.x with controller/opponent and match public state. */
export const CONDITIONAL_AURA_CONTRACT = {
  rule: "conditionalAura",
  conditions: AURA_CONDITION_KINDS,
  controllerScoped: true,
  matchScopedConditions: ["roundAtLeast"],
  unsupportedConditions: ["selfDamaged"],
  composition: ["and", "or", "not"],
  lifecycle: "recomputeWhenAuthoritativeStateChanges",
  malformedRuntime: "inactiveFailClosed",
  support: "supported",
} as const;

/** Aura 2.7: only a living Unit source has an unambiguous self for selfDamaged. */
export const UNIT_SOURCE_SELF_DAMAGED_AURA_CONTRACT = {
  rule: "unitSourceSelfDamagedAuraCondition",
  sources: ["Unit"],
  sourceZone: "bench",
  condition: "selfDamaged",
  predicate: "sourceUnit.health < sourceUnit.maxHealth",
  composition: ["and", "or", "not"],
  permanentSources: "unsupportedFailClosed",
  sentinelaSources: "unsupportedFailClosed",
  lifecycle: "recomputeWhenAuthoritativeStateChanges",
  support: "supported",
} as const;

function auraConditionTreeSupportedInternal(condition: MechanicCondition, allowSelfDamaged: boolean): boolean {
  if (condition.kind === "selfDamaged") return allowSelfDamaged;
  if (condition.kind === "and" || condition.kind === "or") {
    return condition.children.every((child) => auraConditionTreeSupportedInternal(child, allowSelfDamaged));
  }
  if (condition.kind === "not") return auraConditionTreeSupportedInternal(condition.child, allowSelfDamaged);
  return (AURA_CONDITION_KINDS as readonly string[]).includes(condition.kind);
}

/** Aura 2.5 compatibility boundary: controller/match-scoped conditions only. */
export function auraConditionTreeSupported(condition: MechanicCondition): boolean {
  return auraConditionTreeSupportedInternal(condition, false);
}

/** Aura 2.7 boundary: Unit sources additionally support selfDamaged at any valid tree depth. */
export function unitSourceAuraConditionTreeSupported(condition: MechanicCondition): boolean {
  return auraConditionTreeSupportedInternal(condition, true);
}

/** Strict authoring boundary: unlike the generic sanitizer, explicit malformed/null input is rejected. */
export function sanitizeAuraCondition(raw: unknown, allowUnitSourceSelfDamaged = false): MechanicCondition | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const condition = sanitizeMechanicCondition(raw);
  if (!condition) return null;
  const supported = allowUnitSourceSelfDamaged
    ? unitSourceAuraConditionTreeSupported(condition)
    : auraConditionTreeSupported(condition);
  return supported ? condition : null;
}

/**
 * Evaluate the certified Aura condition slice. `selfDamaged` is source-relative
 * and therefore only receives meaning when the caller supplies the live Unit source.
 */
export function auraConditionMatches(
  state: GameState,
  sourceOwner: PlayerId,
  condition: MechanicCondition | undefined,
  sourceUnit?: UnitInstance,
): boolean {
  if (!condition || condition.kind === "always") return true;
  const supported = sourceUnit
    ? unitSourceAuraConditionTreeSupported(condition)
    : auraConditionTreeSupported(condition);
  if (!supported) return false;

  if (condition.kind === "selfDamaged") {
    return Boolean(
      sourceUnit &&
      sourceUnit.owner === sourceOwner &&
      sourceUnit.health > 0 &&
      sourceUnit.health < sourceUnit.maxHealth,
    );
  }
  if (condition.kind === "and") {
    return condition.children.every((child) => auraConditionMatches(state, sourceOwner, child, sourceUnit));
  }
  if (condition.kind === "or") {
    return condition.children.some((child) => auraConditionMatches(state, sourceOwner, child, sourceUnit));
  }
  if (condition.kind === "not") return !auraConditionMatches(state, sourceOwner, condition.child, sourceUnit);

  const player = state.players[sourceOwner];
  const opponent: PlayerId = sourceOwner === "player" ? "ai" : "player";
  const enemy = state.players[opponent];
  if (condition.kind === "allyRace") {
    return player.bench.filter((unit) => unit.race === condition.race || unit.races.includes(condition.race)).length >= condition.min;
  }
  if (condition.kind === "allyClass") {
    return player.bench.filter((unit) => (unit.classes ?? []).includes(condition.classKey)).length >= condition.min;
  }
  if (condition.kind === "enemyRace") {
    return enemy.bench.filter((unit) => unit.health > 0 && (unit.race === condition.race || unit.races.includes(condition.race))).length >= condition.min;
  }
  if (condition.kind === "enemyClass") {
    return enemy.bench.filter((unit) => unit.health > 0 && (unit.classes ?? []).includes(condition.classKey)).length >= condition.min;
  }
  if (condition.kind === "allyUnitsAtLeast") return player.bench.filter((unit) => unit.health > 0).length >= condition.min;
  if (condition.kind === "enemyUnitsAtLeast") return enemy.bench.filter((unit) => unit.health > 0).length >= condition.min;
  if (condition.kind === "allyPermanentsAtLeast") return player.permanents.filter((permanent) => permanent.health > 0).length >= condition.min;
  if (condition.kind === "enemyPermanentsAtLeast") return enemy.permanents.filter((permanent) => permanent.health > 0).length >= condition.min;
  if (condition.kind === "allySentinelasAtLeast") return player.sentinelas.filter((sentinela) => sentinela.loyalty > 0).length >= condition.min;
  if (condition.kind === "enemySentinelasAtLeast") return enemy.sentinelas.filter((sentinela) => sentinela.loyalty > 0).length >= condition.min;
  if (condition.kind === "nexusBelow") return player.nexusHealth <= condition.amount;
  if (condition.kind === "opponentNexusBelow") return enemy.nexusHealth <= condition.amount;
  if (condition.kind === "manaAtLeast") return player.mana >= condition.amount;
  if (condition.kind === "opponentManaAtLeast") return enemy.mana >= condition.amount;
  if (condition.kind === "spellManaAtLeast") return player.spellMana >= condition.amount;
  if (condition.kind === "opponentSpellManaAtLeast") return enemy.spellMana >= condition.amount;
  if (condition.kind === "spellsCastAtLeast") return player.stats.spellsCast >= condition.amount;
  if (condition.kind === "opponentSpellsCastAtLeast") return enemy.stats.spellsCast >= condition.amount;
  if (condition.kind === "alliesSummonedAtLeast") return player.stats.alliesSummoned >= condition.amount;
  if (condition.kind === "opponentAlliesSummonedAtLeast") return enemy.stats.alliesSummoned >= condition.amount;
  if (condition.kind === "nexusDamageDealtAtLeast") return player.stats.nexusDamageDealt >= condition.amount;
  if (condition.kind === "opponentNexusDamageDealtAtLeast") return enemy.stats.nexusDamageDealt >= condition.amount;
  if (condition.kind === "handAtLeast") return player.hand.length >= condition.amount;
  if (condition.kind === "opponentHandAtLeast") return enemy.hand.length >= condition.amount;
  if (condition.kind === "roundAtLeast") return state.round >= condition.amount;
  return false;
}
