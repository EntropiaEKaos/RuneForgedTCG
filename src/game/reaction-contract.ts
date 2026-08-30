import { getCard } from "./cards";
import { cannotBeCountered, counterActionKinds, type ReactionActionKind } from "./counter-rules";
import type { BoardEntity, CardDef, CardInstance, GameState, PlayerId, TargetKind } from "./types";
import { canCastReaction, isValidTarget } from "./engine/actions";

export {
  COUNTER_ACTION_KINDS,
  COUNTER_FILTER_KEYS,
  UNCOUNTERABLE_RULE_KEY,
  cannotBeCountered,
  counterActionKinds,
} from "./counter-rules";
export type { ReactionActionKind } from "./counter-rules";

export interface ReactionActionContext {
  kind: ReactionActionKind;
  defId?: string;
  instanceId?: string;
}

function actionContext(action: ReactionActionKind | ReactionActionContext): ReactionActionContext {
  return typeof action === "string" ? { kind: action } : action;
}

export function canCounterPendingAction(counterCard: CardDef, action: ReactionActionKind | ReactionActionContext): boolean {
  if (counterCard.type !== "Spell" || counterCard.spell?.kind !== "negateSpell") return false;
  const pending = actionContext(action);
  if (!counterActionKinds(counterCard).includes(pending.kind)) return false;
  if (pending.defId && cannotBeCountered(getCard(pending.defId))) return false;
  return true;
}

/**
 * Ability System 2.0 reaction contract.
 *
 * `canCastReaction` remains the low-level speed/mana gate. This layer adds the
 * semantic target gate that decides whether a card represents a legal response
 * to the pending action at all. Stack opening and stack insertion both consume
 * this contract, so a reaction window cannot be opened by a card that would
 * immediately fail to resolve for lack of a legal target.
 */
export interface ReactionEligibility {
  allowed: boolean;
  reason:
    | "allowed"
    | "speed-or-cost"
    | "missing-spell"
    | "stack-target-mismatch"
    | "counter-kind-mismatch"
    | "target-uncounterable"
    | "no-legal-target";
}

function boardEntities(state: GameState): BoardEntity[] {
  const entities: BoardEntity[] = [];
  for (const owner of ["player", "ai"] as const) {
    for (const unit of state.players[owner].bench) entities.push({ kind: "unit", owner, unit });
    for (const perm of state.players[owner].permanents) entities.push({ kind: "permanent", owner, perm });
    for (const sen of state.players[owner].sentinelas) entities.push({ kind: "sentinela", owner, sen });
  }
  return entities;
}

export function reactionTargetAvailable(
  state: GameState,
  playerId: PlayerId,
  target: TargetKind,
  action: ReactionActionKind | ReactionActionContext,
): boolean {
  const pending = actionContext(action);
  if (target === "none" || target === "self") return true;
  if (target === "spellOnStack") return pending.kind === "spell";
  return boardEntities(state).some((entity) => isValidTarget(state, playerId, target, entity));
}

export function reactionEligibility(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  action: ReactionActionKind | ReactionActionContext,
): ReactionEligibility {
  const pending = actionContext(action);
  if (!canCastReaction(state, playerId, instanceId, pending.kind)) {
    return { allowed: false, reason: "speed-or-cost" };
  }

  const instance = state.players[playerId].hand.find((card) => card.instanceId === instanceId);
  if (!instance) return { allowed: false, reason: "missing-spell" };
  const def = getCard(instance.defId);
  if (def.type !== "Spell" || !def.spell) return { allowed: false, reason: "missing-spell" };

  if (def.spell.kind === "negateSpell") {
    if (!counterActionKinds(def).includes(pending.kind)) {
      return { allowed: false, reason: "counter-kind-mismatch" };
    }
    if (pending.defId && cannotBeCountered(getCard(pending.defId))) {
      return { allowed: false, reason: "target-uncounterable" };
    }
    return { allowed: true, reason: "allowed" };
  }

  if (def.spell.target === "spellOnStack" && pending.kind !== "spell") {
    return { allowed: false, reason: "stack-target-mismatch" };
  }
  if (!reactionTargetAvailable(state, playerId, def.spell.target, pending)) {
    return { allowed: false, reason: "no-legal-target" };
  }
  return { allowed: true, reason: "allowed" };
}

export function canReactWithCard(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  action: ReactionActionKind | ReactionActionContext,
): boolean {
  return reactionEligibility(state, playerId, instanceId, action).allowed;
}

export function eligibleReactionCards(
  state: GameState,
  playerId: PlayerId,
  action: ReactionActionKind | ReactionActionContext,
): CardInstance[] {
  return state.players[playerId].hand.filter((card) => canReactWithCard(state, playerId, card.instanceId, action));
}

export function hasReactionOpportunity(
  state: GameState,
  playerId: PlayerId,
  action: ReactionActionKind | ReactionActionContext,
): boolean {
  return eligibleReactionCards(state, playerId, action).length > 0;
}
