import { getCard } from "../cards";
import type { ActivatedAbility, ActivatedAbilityUsage } from "../activated-ability-types";
import type {
  BoardEntity,
  CardDef,
  GameState,
  PermanentInstance,
  PlayerId,
  SentinelaInstance,
  TargetKind,
  UnitInstance,
} from "../types";
import { checkWin, clone, findAnyBoardEntity } from "./state";
import { applyEffect, checkLevelUps, cleanupDead } from "./effects";
import { cleanupSentinelas } from "./sentinela-state";
import { isValidTarget } from "./actions";

export type ActivatedAbilitySource =
  | { kind: "unit"; unit: UnitInstance; owner: PlayerId }
  | { kind: "permanent"; perm: PermanentInstance; owner: PlayerId }
  | { kind: "sentinela"; sen: SentinelaInstance; owner: PlayerId };

export interface ActivatedAbilityValidation {
  ok: boolean;
  reason?: string;
  ability?: ActivatedAbility;
  source?: ActivatedAbilitySource;
  legacySentinela?: boolean;
}

function fail(reason: string): ActivatedAbilityValidation {
  return { ok: false, reason };
}

function sourceInstance(source: ActivatedAbilitySource): UnitInstance | PermanentInstance | SentinelaInstance {
  if (source.kind === "unit") return source.unit;
  if (source.kind === "permanent") return source.perm;
  return source.sen;
}

export function findActivatedAbilitySource(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): ActivatedAbilitySource | null {
  const player = state.players[playerId];
  const unit = player.bench.find((candidate) => candidate.instanceId === instanceId);
  if (unit) return { kind: "unit", unit, owner: playerId };
  const perm = player.permanents.find((candidate) => candidate.instanceId === instanceId);
  if (perm) return { kind: "permanent", perm, owner: playerId };
  const sen = player.sentinelas.find((candidate) => candidate.instanceId === instanceId);
  if (sen) return { kind: "sentinela", sen, owner: playerId };
  return null;
}

function legacySentinelaAbilities(def: CardDef): ActivatedAbility[] {
  return (def.sentinela?.abilities ?? []).map((ability) => ({
    description: ability.description,
    effect: ability.effect,
    cost: { loyaltyDelta: ability.cost },
    maxUsesPerRound: 1,
  }));
}

/**
 * Unified ability list. Legacy Sentinela abilities keep their existing indexes;
 * generic abilities, if any, are appended after them.
 */
export function activatedAbilitiesForDef(def: CardDef): ActivatedAbility[] {
  return [...legacySentinelaAbilities(def), ...(def.activatedAbilities ?? [])];
}

export function activatedAbilitiesForInstance(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): ActivatedAbility[] {
  const source = findActivatedAbilitySource(state, playerId, instanceId);
  if (!source) return [];
  return activatedAbilitiesForDef(getCard(sourceInstance(source).defId));
}

function isLegacySentinelaAbility(def: CardDef, abilityIndex: number): boolean {
  return abilityIndex >= 0 && abilityIndex < (def.sentinela?.abilities.length ?? 0);
}

function abilityUsage(
  source: ActivatedAbilitySource,
  abilityIndex: number,
  round: number,
): number {
  const record = sourceInstance(source).activatedAbilityUses?.[String(abilityIndex)];
  return record?.round === round ? record.count : 0;
}

function recordAbilityUsage(
  source: ActivatedAbilitySource,
  abilityIndex: number,
  round: number,
): void {
  const instance = sourceInstance(source);
  if (!instance.activatedAbilityUses) instance.activatedAbilityUses = {};
  const previous = instance.activatedAbilityUses[String(abilityIndex)];
  const next: ActivatedAbilityUsage = previous?.round === round
    ? { round, count: previous.count + 1 }
    : { round, count: 1 };
  instance.activatedAbilityUses[String(abilityIndex)] = next;
}

function validateNonNegativeInteger(value: number | undefined, name: string): string | null {
  if (value === undefined) return null;
  if (!Number.isInteger(value) || value < 0) return `${name} must be a non-negative integer`;
  return null;
}

function requiresBoardTarget(target: TargetKind): boolean {
  return !["none", "self", "spellOnStack"].includes(target);
}

/** Unlimited activations must consume a finite resource or the source itself. */
export function hasConsumingActivatedAbilityCost(ability: ActivatedAbility): boolean {
  const cost = ability.cost;
  return Boolean(
    (cost?.mana ?? 0) > 0 ||
    (cost?.nexusHealth ?? 0) > 0 ||
    cost?.exhaustSelf ||
    cost?.sacrificeSelf ||
    (cost?.loyaltyDelta ?? 0) < 0
  );
}

function boardEntityId(entity: BoardEntity): string {
  if (entity.kind === "unit") return entity.unit.instanceId;
  if (entity.kind === "permanent") return entity.perm.instanceId;
  return entity.sen.instanceId;
}

function boardEntities(state: GameState): BoardEntity[] {
  const entities: BoardEntity[] = [];
  for (const owner of ["player", "ai"] as PlayerId[]) {
    for (const unit of state.players[owner].bench) entities.push({ kind: "unit", unit, owner });
    for (const perm of state.players[owner].permanents) entities.push({ kind: "permanent", perm, owner });
    for (const sen of state.players[owner].sentinelas) entities.push({ kind: "sentinela", sen, owner });
  }
  return entities;
}

export function validateActivatedAbilityActivation(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  abilityIndex: number,
  targetInstanceId?: string,
): ActivatedAbilityValidation {
  if (state.phase !== "main" || state.activePlayer !== playerId) {
    return fail("activated abilities require the owner's main phase");
  }
  if (!Number.isInteger(abilityIndex) || abilityIndex < 0) return fail("invalid activated ability index");

  const source = findActivatedAbilitySource(state, playerId, instanceId);
  if (!source) return fail("activated ability source is not controlled by actor");
  const def = getCard(sourceInstance(source).defId);
  const abilities = activatedAbilitiesForDef(def);
  const ability = abilities[abilityIndex];
  if (!ability) return fail("activated ability index does not exist");
  const legacySentinela = source.kind === "sentinela" && isLegacySentinelaAbility(def, abilityIndex);

  const manaError = validateNonNegativeInteger(ability.cost?.mana, "mana cost");
  if (manaError) return fail(manaError);
  const healthError = validateNonNegativeInteger(ability.cost?.nexusHealth, "Nexus health cost");
  if (healthError) return fail(healthError);
  if (ability.maxUsesPerRound !== undefined && ability.maxUsesPerRound !== null) {
    if (!Number.isInteger(ability.maxUsesPerRound) || ability.maxUsesPerRound <= 0) {
      return fail("maxUsesPerRound must be a positive integer or null");
    }
  }
  if (ability.maxUsesPerRound === null && !hasConsumingActivatedAbilityCost(ability)) {
    return fail("unlimited activated abilities require a consuming cost");
  }

  const player = state.players[playerId];
  const manaCost = ability.cost?.mana ?? 0;
  if (player.mana < manaCost) return fail("not enough regular mana for activated ability");
  const healthCost = ability.cost?.nexusHealth ?? 0;
  if (healthCost > 0 && player.nexusHealth <= healthCost) {
    return fail("Nexus health cost cannot be paid lethally");
  }

  const limit = ability.maxUsesPerRound === undefined ? 1 : ability.maxUsesPerRound;
  // Every Sentinela — legacy or generic — shares the Planeswalker-style
  // one-activation-per-round budget. This prevents a card with both contracts
  // from activating once through each list in the same round.
  if (source.kind === "sentinela" && source.sen.activatedThisTurn) {
    return fail("Sentinela already activated this round");
  }
  if (source.kind !== "sentinela" && limit !== null && abilityUsage(source, abilityIndex, state.round) >= limit) {
    return fail("activated ability reached its per-round use limit");
  }

  if (ability.cost?.loyaltyDelta !== undefined) {
    if (!Number.isInteger(ability.cost.loyaltyDelta)) return fail("loyalty delta must be an integer");
    if (source.kind !== "sentinela") return fail("loyalty cost requires a Sentinela source");
    if (ability.cost.loyaltyDelta < 0 && source.sen.loyalty < -ability.cost.loyaltyDelta) {
      return fail("not enough Sentinela loyalty");
    }
  }

  if (ability.cost?.exhaustSelf) {
    if (source.kind === "unit") {
      if (source.unit.hasAttackedThisTurn) return fail("unit is already exhausted this round");
      if (source.unit.stunned) return fail("stunned unit cannot pay an exhaust cost");
      if (source.unit.summonedThisTurn && !source.unit.keywords.includes("Haste")) {
        return fail("summoning-sick unit cannot pay an exhaust cost");
      }
    } else if (sourceInstance(source).exhaustedRound === state.round) {
      return fail("source is already exhausted this round");
    }
  }

  if (ability.cost?.sacrificeSelf && ability.effect.target === "self") {
    return fail("a sacrificed source cannot also be the effect's self target");
  }

  const targetKind = ability.effect.target;
  if (targetKind === "spellOnStack") {
    return fail("stack-targeted activated abilities require a reaction-context action");
  }
  if (requiresBoardTarget(targetKind)) {
    if (!targetInstanceId) {
      // Legacy engine callers historically allowed Sentinela abilities to omit
      // a target and let applyEffect choose one deterministically. Keep that
      // replay/API behavior; browser/server semantic validation still requires
      // an explicit target for client-supplied actions.
      if (!legacySentinela) return fail("activated ability requires a target");
    } else {
      const target = findAnyBoardEntity(state, targetInstanceId);
      if (!target) return fail("activated ability target does not exist");
      if (!isValidTarget(state, playerId, targetKind, target)) return fail("invalid activated ability target");
    }
  } else if (targetInstanceId) {
    return fail("activated ability does not accept an explicit target");
  }

  return { ok: true, ability, source, legacySentinela };
}

/**
 * UI/preflight availability check. Targeted abilities are considered usable if
 * at least one legal board target exists; the actual target is still validated
 * authoritatively when the action is submitted.
 */
export function canBeginActivateAbility(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  abilityIndex: number,
): boolean {
  const source = findActivatedAbilitySource(state, playerId, instanceId);
  if (!source) return false;
  const ability = activatedAbilitiesForDef(getCard(sourceInstance(source).defId))[abilityIndex];
  if (!ability || ability.effect.target === "spellOnStack") return false;
  if (!requiresBoardTarget(ability.effect.target)) {
    return validateActivatedAbilityActivation(state, playerId, instanceId, abilityIndex).ok;
  }
  return boardEntities(state).some((entity) =>
    isValidTarget(state, playerId, ability.effect.target, entity) &&
    validateActivatedAbilityActivation(
      state,
      playerId,
      instanceId,
      abilityIndex,
      boardEntityId(entity),
    ).ok,
  );
}

export function canActivateAbility(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  abilityIndex: number,
  targetInstanceId?: string,
): boolean {
  return validateActivatedAbilityActivation(
    state,
    playerId,
    instanceId,
    abilityIndex,
    targetInstanceId,
  ).ok;
}

function paySourceCosts(
  state: GameState,
  source: ActivatedAbilitySource,
  ability: ActivatedAbility,
): void {
  const player = state.players[source.owner];
  player.mana -= ability.cost?.mana ?? 0;
  player.nexusHealth -= ability.cost?.nexusHealth ?? 0;

  if (ability.cost?.loyaltyDelta !== undefined && source.kind === "sentinela") {
    source.sen.loyalty += ability.cost.loyaltyDelta;
  }

  if (ability.cost?.exhaustSelf) {
    if (source.kind === "unit") source.unit.hasAttackedThisTurn = true;
    else sourceInstance(source).exhaustedRound = state.round;
  }

  if (ability.cost?.sacrificeSelf) {
    if (source.kind === "unit") source.unit.health = 0;
    else if (source.kind === "permanent") source.perm.health = 0;
    else source.sen.loyalty = 0;
  }
}

/**
 * Resolve one generic activated ability. Invalid attempts are strict no-ops,
 * matching the rest of the deterministic engine surface.
 */
export function activateAbility(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  abilityIndex: number,
  targetInstanceId?: string,
): GameState {
  const validation = validateActivatedAbilityActivation(
    state,
    playerId,
    instanceId,
    abilityIndex,
    targetInstanceId,
  );
  if (!validation.ok || !validation.ability || !validation.source) return state;

  const next = clone(state);
  const source = findActivatedAbilitySource(next, playerId, instanceId);
  if (!source) return state;
  const def = getCard(sourceInstance(source).defId);
  const ability = activatedAbilitiesForDef(def)[abilityIndex];
  if (!ability) return state;
  const legacySentinela = source.kind === "sentinela" && isLegacySentinelaAbility(def, abilityIndex);

  if (source.kind === "sentinela") source.sen.activatedThisTurn = true;
  if (!legacySentinela) recordAbilityUsage(source, abilityIndex, next.round);

  paySourceCosts(next, source, ability);
  next.log.push(`${def.name} ativa "${ability.description}".`);

  // Sacrifice is a real cost: the source leaves play before its effect resolves.
  if (ability.cost?.sacrificeSelf) {
    cleanupDead(next);
    cleanupSentinelas(next);
  }

  const self = source.kind === "unit" ? source.unit : undefined;
  const explicitTarget = requiresBoardTarget(ability.effect.target) ? targetInstanceId : undefined;
  applyEffect(next, playerId, ability.effect, explicitTarget, self);

  cleanupDead(next);
  cleanupSentinelas(next);
  checkLevelUps(next);
  checkWin(next);
  return next;
}
