import { activatedAbilityChoices, findActivatedAbilitySource, hasConsumingActivatedAbilityCost, resolveActivatedAbilityChoice, type ActivatedAbilitySource } from "./engine/activated-actions";
import { isValidTarget } from "./engine/actions";
import { applyEffect, checkLevelUps, cleanupDead } from "./engine/effects";
import { cleanupSentinelas } from "./engine/sentinela-state";
import { checkWin, clone, findAnyBoardEntity } from "./engine/state";
import { getCard } from "./cards";
import { cannotBeCountered, type ReactionActionKind } from "./counter-rules";
import { discardHandInstancesToGraveyard } from "./graveyard";
import type { ReactionActivatedAbility, ActivatedAbilityUsage } from "./activated-ability-types";
import type { BoardEntity, CardEffect, GameState, PermanentInstance, PlayerId, SentinelaInstance, TargetKind, UnitInstance } from "./types";

export interface PendingReactionActionContext {
  kind: ReactionActionKind;
  instanceId?: string;
  defId?: string;
  player?: PlayerId;
}

export interface ReactionActivatedAbilityValidation {
  ok: boolean;
  reason?: string;
  ability?: ReactionActivatedAbility;
  source?: ActivatedAbilitySource;
  effect?: CardEffect;
  modeId?: string;
}

export interface ReactionActivatedAbilityOption {
  sourceInstanceId: string;
  defId: string;
  abilityIndex: number;
  description: string;
  modeId?: string;
  modeDescription?: string;
  targetKind: TargetKind;
}

export interface ReactionActivatedAbilityAction {
  kind: "sentinela";
  responseKind: "activatedAbility";
  player: PlayerId;
  instanceId: string;
  defId: string;
  abilityIndex: number;
  targetInstanceId?: string;
  modeId?: string;
  costDiscardInstanceIds?: string[];
}

function fail(reason: string): ReactionActivatedAbilityValidation {
  return { ok: false, reason };
}

function sourceInstance(source: ActivatedAbilitySource): UnitInstance | PermanentInstance | SentinelaInstance {
  if (source.kind === "unit") return source.unit;
  if (source.kind === "permanent") return source.perm;
  return source.sen;
}

function usageKey(abilityIndex: number): string {
  return `reaction:${abilityIndex}`;
}

function abilityUsage(source: ActivatedAbilitySource, abilityIndex: number, round: number): number {
  const record = sourceInstance(source).activatedAbilityUses?.[usageKey(abilityIndex)];
  return record?.round === round ? record.count : 0;
}

function recordAbilityUsage(source: ActivatedAbilitySource, abilityIndex: number, round: number): void {
  const instance = sourceInstance(source);
  if (!instance.activatedAbilityUses) instance.activatedAbilityUses = {};
  const key = usageKey(abilityIndex);
  const previous = instance.activatedAbilityUses[key];
  const next: ActivatedAbilityUsage = previous?.round === round
    ? { round, count: previous.count + 1 }
    : { round, count: 1 };
  instance.activatedAbilityUses[key] = next;
}

function validateNonNegativeInteger(value: number | undefined, name: string): string | null {
  if (value === undefined) return null;
  if (!Number.isInteger(value) || value < 0) return `${name} must be a non-negative integer`;
  return null;
}

function validateDiscardSelection(
  handInstanceIds: readonly string[],
  discardCount: number,
  selectedInstanceIds: readonly string[] | undefined,
  allowMissingSelection: boolean,
): string | null {
  if (discardCount === 0) {
    if (selectedInstanceIds && selectedInstanceIds.length > 0) return "reaction ability does not accept a discard cost selection";
    return null;
  }
  if (handInstanceIds.length < discardCount) return "not enough cards in hand for reaction ability discard cost";
  if (selectedInstanceIds === undefined) return allowMissingSelection ? null : "reaction ability discard cost requires explicit hand selection";
  if (selectedInstanceIds.length !== discardCount) return "reaction ability discard cost requires exactly the configured number of cards";
  if (new Set(selectedInstanceIds).size !== selectedInstanceIds.length) return "reaction ability discard cost selection contains duplicate cards";
  const handIds = new Set(handInstanceIds);
  if (selectedInstanceIds.some((id) => !handIds.has(id))) return "reaction ability discard cost selection references a card outside actor hand";
  return null;
}

function requiresBoardTarget(target: TargetKind): boolean {
  return !["none", "self", "spellOnStack"].includes(target);
}

function boardEntityId(entity: BoardEntity): string {
  if (entity.kind === "unit") return entity.unit.instanceId;
  if (entity.kind === "permanent") return entity.perm.instanceId;
  return entity.sen.instanceId;
}

function boardEntities(state: GameState): BoardEntity[] {
  const entities: BoardEntity[] = [];
  for (const owner of ["player", "ai"] as PlayerId[]) {
    for (const unit of state.players[owner].bench) entities.push({ kind: "unit", owner, unit });
    for (const perm of state.players[owner].permanents) entities.push({ kind: "permanent", owner, perm });
    for (const sen of state.players[owner].sentinelas) entities.push({ kind: "sentinela", owner, sen });
  }
  return entities;
}

function validRespondsTo(ability: ReactionActivatedAbility): boolean {
  if (!Array.isArray(ability.respondsTo) || ability.respondsTo.length === 0) return false;
  if (new Set(ability.respondsTo).size !== ability.respondsTo.length) return false;
  return ability.respondsTo.every((kind) => kind === "unit" || kind === "spell" || kind === "sentinela");
}

export function reactionActivatedAbilitiesForInstance(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): ReactionActivatedAbility[] {
  const source = findActivatedAbilitySource(state, playerId, instanceId);
  if (!source) return [];
  return getCard(sourceInstance(source).defId).reactionActivatedAbilities ?? [];
}

export function validateReactionActivatedAbilityActivation(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  abilityIndex: number,
  pendingAction: PendingReactionActionContext,
  targetInstanceId?: string,
  modeId?: string,
  costDiscardInstanceIds?: readonly string[],
  allowMissingCostSelection: boolean = false,
): ReactionActivatedAbilityValidation {
  if (state.phase === "gameover") return fail("reaction abilities cannot be activated after game over");
  if (pendingAction.player === playerId) return fail("reaction abilities require an opposing pending action");
  if (!Number.isInteger(abilityIndex) || abilityIndex < 0) return fail("invalid reaction ability index");

  const source = findActivatedAbilitySource(state, playerId, instanceId);
  if (!source) return fail("reaction ability source is not controlled by actor");
  const def = getCard(sourceInstance(source).defId);
  const ability = def.reactionActivatedAbilities?.[abilityIndex];
  if (!ability) return fail("reaction ability index does not exist");
  if (!validRespondsTo(ability)) return fail("reaction ability respondsTo contract is invalid");
  if (!ability.respondsTo.includes(pendingAction.kind)) return fail("reaction ability does not respond to this action kind");

  const resolved = resolveActivatedAbilityChoice(ability, modeId);
  if (!resolved.ok) return fail(resolved.reason);
  const effect = resolved.choice.effect;

  const manaError = validateNonNegativeInteger(ability.cost?.mana, "mana cost");
  if (manaError) return fail(manaError);
  const spellManaError = validateNonNegativeInteger(ability.cost?.spellMana, "spell mana cost");
  if (spellManaError) return fail(spellManaError);
  const healthError = validateNonNegativeInteger(ability.cost?.nexusHealth, "Nexus health cost");
  if (healthError) return fail(healthError);
  const discardError = validateNonNegativeInteger(ability.cost?.discardFromHand, "discard from hand cost");
  if (discardError) return fail(discardError);
  if ((ability.cost?.discardFromHand ?? 0) > 10) return fail("discard from hand cost must be at most 10");
  if (ability.cost?.consumeBarrier !== undefined && typeof ability.cost.consumeBarrier !== "boolean") return fail("consumeBarrier cost must be boolean");
  if (ability.maxUsesPerRound !== undefined && ability.maxUsesPerRound !== null) {
    if (!Number.isInteger(ability.maxUsesPerRound) || ability.maxUsesPerRound <= 0) return fail("maxUsesPerRound must be a positive integer or null");
  }
  if (ability.maxUsesPerRound === null && !hasConsumingActivatedAbilityCost(ability)) return fail("unlimited reaction abilities require a consuming cost");

  const player = state.players[playerId];
  if (player.mana < (ability.cost?.mana ?? 0)) return fail("not enough regular mana for reaction ability");
  if (player.spellMana < (ability.cost?.spellMana ?? 0)) return fail("not enough spell mana for reaction ability");
  const healthCost = ability.cost?.nexusHealth ?? 0;
  if (healthCost > 0 && player.nexusHealth <= healthCost) return fail("Nexus health cost cannot be paid lethally");
  const selectedDiscardError = validateDiscardSelection(
    player.hand.map((card) => card.instanceId),
    ability.cost?.discardFromHand ?? 0,
    costDiscardInstanceIds,
    allowMissingCostSelection,
  );
  if (selectedDiscardError) return fail(selectedDiscardError);

  const limit = ability.maxUsesPerRound === undefined ? 1 : ability.maxUsesPerRound;
  if (source.kind === "sentinela" && source.sen.activatedThisTurn) return fail("Sentinela already activated this round");
  if (source.kind !== "sentinela" && limit !== null && abilityUsage(source, abilityIndex, state.round) >= limit) return fail("reaction ability reached its per-round use limit");

  if (ability.cost?.loyaltyDelta !== undefined) {
    if (!Number.isInteger(ability.cost.loyaltyDelta)) return fail("loyalty delta must be an integer");
    if (source.kind !== "sentinela") return fail("loyalty cost requires a Sentinela source");
    if (ability.cost.loyaltyDelta < 0 && source.sen.loyalty < -ability.cost.loyaltyDelta) return fail("not enough Sentinela loyalty");
  }

  if (ability.cost?.exhaustSelf) {
    if (source.kind === "unit") {
      if (source.unit.hasAttackedThisTurn) return fail("unit is already exhausted this round");
      if (source.unit.stunned) return fail("stunned unit cannot pay an exhaust cost");
      if (source.unit.summonedThisTurn && !source.unit.keywords.includes("Haste")) return fail("summoning-sick unit cannot pay an exhaust cost");
    } else if (sourceInstance(source).exhaustedRound === state.round) return fail("source is already exhausted this round");
  }

  if (ability.cost?.consumeBarrier) {
    if (source.kind !== "unit") return fail("Barrier cost requires a Unit source");
    if (!source.unit.barrier) return fail("source has no active Barrier to consume");
  }
  if (ability.cost?.sacrificeSelf && effect.target === "self") return fail("a sacrificed source cannot also be the effect's self target");

  if (effect.target === "spellOnStack") {
    if (effect.kind !== "negateSpell") return fail("only negateSpell may target the reaction stack");
    if (pendingAction.kind !== "spell") return fail("stack-targeted reaction ability requires a pending spell");
    if (!pendingAction.instanceId) return fail("stack-targeted reaction ability requires a pending action id");
    if (targetInstanceId !== pendingAction.instanceId) return fail("reaction ability must target the pending spell instance");
    if (pendingAction.defId && cannotBeCountered(getCard(pendingAction.defId))) return fail("pending spell cannot be countered");
  } else if (effect.kind === "negateSpell") {
    return fail("negateSpell reaction ability must target spellOnStack");
  } else if (requiresBoardTarget(effect.target)) {
    if (!targetInstanceId) return fail("reaction ability requires a target");
    const target = findAnyBoardEntity(state, targetInstanceId);
    if (!target) return fail("reaction ability target does not exist");
    if (!isValidTarget(state, playerId, effect.target, target)) return fail("invalid reaction ability target");
  } else if (targetInstanceId) {
    return fail("reaction ability does not accept an explicit target");
  }

  return { ok: true, ability, source, effect, modeId: resolved.choice.modeId };
}

export function canBeginReactionActivatedAbility(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  abilityIndex: number,
  pendingAction: PendingReactionActionContext,
  modeId?: string,
): boolean {
  const ability = reactionActivatedAbilitiesForInstance(state, playerId, instanceId)[abilityIndex];
  if (!ability) return false;
  if (ability.modes !== undefined && modeId === undefined) {
    return activatedAbilityChoices(ability).some((choice) => canBeginReactionActivatedAbility(state, playerId, instanceId, abilityIndex, pendingAction, choice.modeId));
  }
  const resolved = resolveActivatedAbilityChoice(ability, modeId);
  if (!resolved.ok) return false;
  const effect = resolved.choice.effect;
  if (effect.target === "spellOnStack") {
    return validateReactionActivatedAbilityActivation(
      state, playerId, instanceId, abilityIndex, pendingAction, pendingAction.instanceId, modeId, undefined, true,
    ).ok;
  }
  if (!requiresBoardTarget(effect.target)) {
    return validateReactionActivatedAbilityActivation(state, playerId, instanceId, abilityIndex, pendingAction, undefined, modeId, undefined, true).ok;
  }
  return boardEntities(state).some((entity) =>
    isValidTarget(state, playerId, effect.target, entity) &&
    validateReactionActivatedAbilityActivation(
      state, playerId, instanceId, abilityIndex, pendingAction, boardEntityId(entity), modeId, undefined, true,
    ).ok,
  );
}

export function reactionActivatedAbilityOptions(
  state: GameState,
  playerId: PlayerId,
  pendingAction: PendingReactionActionContext,
): ReactionActivatedAbilityOption[] {
  const options: ReactionActivatedAbilityOption[] = [];
  for (const zone of [state.players[playerId].bench, state.players[playerId].permanents, state.players[playerId].sentinelas] as const) {
    for (const source of zone) {
      const abilities = getCard(source.defId).reactionActivatedAbilities ?? [];
      abilities.forEach((ability, abilityIndex) => {
        const choices = activatedAbilityChoices(ability);
        for (const choice of choices) {
          if (!canBeginReactionActivatedAbility(state, playerId, source.instanceId, abilityIndex, pendingAction, choice.modeId)) continue;
          options.push({
            sourceInstanceId: source.instanceId,
            defId: source.defId,
            abilityIndex,
            description: ability.description,
            ...(choice.modeId ? { modeId: choice.modeId, modeDescription: choice.description } : {}),
            targetKind: choice.effect.target,
          });
        }
      });
    }
  }
  return options;
}

export function canReactWithActivatedAbilityAction(
  state: GameState,
  playerId: PlayerId,
  action: ReactionActivatedAbilityAction,
  pendingAction: PendingReactionActionContext,
): boolean {
  if (action.responseKind !== "activatedAbility" || action.player !== playerId || action.kind !== "sentinela") return false;
  return validateReactionActivatedAbilityActivation(
    state,
    playerId,
    action.instanceId,
    action.abilityIndex,
    pendingAction,
    action.targetInstanceId,
    action.modeId,
    action.costDiscardInstanceIds,
  ).ok;
}

function payCosts(
  state: GameState,
  source: ActivatedAbilitySource,
  ability: ReactionActivatedAbility,
  costDiscardInstanceIds?: readonly string[],
): void {
  const player = state.players[source.owner];
  player.mana -= ability.cost?.mana ?? 0;
  player.spellMana -= ability.cost?.spellMana ?? 0;
  player.nexusHealth -= ability.cost?.nexusHealth ?? 0;
  if ((ability.cost?.discardFromHand ?? 0) > 0 && costDiscardInstanceIds) {
    discardHandInstancesToGraveyard(
      state,
      source.owner,
      costDiscardInstanceIds,
      "discard",
      sourceInstance(source).instanceId,
    );
  }
  if (ability.cost?.loyaltyDelta !== undefined && source.kind === "sentinela") source.sen.loyalty += ability.cost.loyaltyDelta;
  if (ability.cost?.exhaustSelf) {
    if (source.kind === "unit") source.unit.hasAttackedThisTurn = true;
    else sourceInstance(source).exhaustedRound = state.round;
  }
  if (ability.cost?.consumeBarrier && source.kind === "unit") source.unit.barrier = false;
  if (ability.cost?.sacrificeSelf) {
    if (source.kind === "unit") source.unit.health = 0;
    else if (source.kind === "permanent") source.perm.health = 0;
    else source.sen.loyalty = 0;
  }
}

export function resolveReactionActivatedAbility(
  state: GameState,
  playerId: PlayerId,
  action: ReactionActivatedAbilityAction,
  pendingAction: PendingReactionActionContext,
): { next: GameState; negatesPending: boolean } {
  const validation = validateReactionActivatedAbilityActivation(
    state,
    playerId,
    action.instanceId,
    action.abilityIndex,
    pendingAction,
    action.targetInstanceId,
    action.modeId,
    action.costDiscardInstanceIds,
  );
  if (!validation.ok || !validation.ability || !validation.source || !validation.effect) return { next: state, negatesPending: false };

  const next = clone(state);
  const source = findActivatedAbilitySource(next, playerId, action.instanceId);
  if (!source) return { next: state, negatesPending: false };
  const ability = getCard(sourceInstance(source).defId).reactionActivatedAbilities?.[action.abilityIndex];
  if (!ability) return { next: state, negatesPending: false };
  const resolved = resolveActivatedAbilityChoice(ability, action.modeId);
  if (!resolved.ok) return { next: state, negatesPending: false };
  const effect = resolved.choice.effect;

  if (source.kind === "sentinela") source.sen.activatedThisTurn = true;
  else recordAbilityUsage(source, action.abilityIndex, next.round);
  payCosts(next, source, ability, action.costDiscardInstanceIds);

  const modeSuffix = resolved.choice.modeId ? ` — ${resolved.choice.description}` : "";
  next.log.push(`${getCard(sourceInstance(source).defId).name} reage com "${ability.description}${modeSuffix}".`);

  if (ability.cost?.sacrificeSelf) {
    cleanupDead(next);
    cleanupSentinelas(next);
  }

  const negatesPending = effect.kind === "negateSpell" && effect.target === "spellOnStack";
  if (!negatesPending) {
    const self = source.kind === "unit" ? source.unit : undefined;
    const explicitTarget = requiresBoardTarget(effect.target) ? action.targetInstanceId : undefined;
    applyEffect(next, playerId, effect, explicitTarget, self);
  }

  cleanupDead(next);
  cleanupSentinelas(next);
  checkLevelUps(next);
  checkWin(next);
  return { next, negatesPending };
}