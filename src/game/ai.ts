export * from "./ai-core";

import { aiChooseReaction as aiChooseCardReaction, type AiAction } from "./ai-core";
import { aiChooseReactionActivatedAbilityAction } from "./ai-reaction-activated-abilities";
import { activateAbility, castSpell, playUnit, type CardAction } from "./engine";
import type { GameState, PlayerId } from "./types";

/**
 * Public AI execution facade. Activated battlefield actions use the same
 * generic executor as the browser, reducer, replay and PvP paths, preserving
 * the versioned `sentinela` action kind while carrying additive modal and
 * selected-cost payload fields.
 */
export function applyAiAction(
  state: GameState,
  action: AiAction,
  playerId: PlayerId = "ai",
): GameState {
  if (action.kind === "unit") {
    return playUnit(state, playerId, action.instanceId, action.targetInstanceId);
  }
  if (action.kind === "sentinela") {
    return activateAbility(
      state,
      playerId,
      action.instanceId,
      action.abilityIndex ?? 0,
      action.targetInstanceId,
      action.modeId,
      action.costDiscardInstanceIds,
    );
  }
  return castSpell(state, playerId, action.instanceId, action.targetInstanceId);
}

/**
 * Prefer a legal battlefield reaction when one exists, then fall back to the
 * historical hand-card reaction policy. Both candidates are revalidated by the
 * authoritative stack contract before insertion.
 */
export function aiChooseReaction(
  state: GameState,
  action: CardAction,
  playerId: PlayerId = "ai",
): AiAction | null {
  return aiChooseReactionActivatedAbilityAction(state, action, playerId) ??
    aiChooseCardReaction(state, action, playerId);
}
