import { getCard } from "./cards";
import type { BoardEntity, CardInstance, GameState, PlayerId, TargetKind } from "./types";
import { canCastReaction, isValidTarget } from "./engine/actions";

export type ReactionActionKind = "unit" | "spell" | "sentinela";

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
  actionKind: ReactionActionKind,
): boolean {
  if (target === "none" || target === "self") return true;
  if (target === "spellOnStack") return actionKind === "spell";
  return boardEntities(state).some((entity) => isValidTarget(state, playerId, target, entity));
}

export function reactionEligibility(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  actionKind: ReactionActionKind,
): ReactionEligibility {
  if (!canCastReaction(state, playerId, instanceId, actionKind)) {
    return { allowed: false, reason: "speed-or-cost" };
  }

  const instance = state.players[playerId].hand.find((card) => card.instanceId === instanceId);
  if (!instance) return { allowed: false, reason: "missing-spell" };
  const def = getCard(instance.defId);
  if (def.type !== "Spell" || !def.spell) return { allowed: false, reason: "missing-spell" };

  if (def.spell.target === "spellOnStack" && actionKind !== "spell") {
    return { allowed: false, reason: "stack-target-mismatch" };
  }
  if (!reactionTargetAvailable(state, playerId, def.spell.target, actionKind)) {
    return { allowed: false, reason: "no-legal-target" };
  }
  return { allowed: true, reason: "allowed" };
}

export function canReactWithCard(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  actionKind: ReactionActionKind,
): boolean {
  return reactionEligibility(state, playerId, instanceId, actionKind).allowed;
}

export function eligibleReactionCards(
  state: GameState,
  playerId: PlayerId,
  actionKind: ReactionActionKind,
): CardInstance[] {
  return state.players[playerId].hand.filter((card) => canReactWithCard(state, playerId, card.instanceId, actionKind));
}

export function hasReactionOpportunity(
  state: GameState,
  playerId: PlayerId,
  actionKind: ReactionActionKind,
): boolean {
  return eligibleReactionCards(state, playerId, actionKind).length > 0;
}
