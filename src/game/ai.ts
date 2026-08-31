export * from "./ai-core";

import type { AiAction } from "./ai-core";
import { activateAbility, castSpell, playUnit } from "./engine";
import type { GameState, PlayerId } from "./types";

/**
 * Public AI execution facade. Activated battlefield actions use the same
 * generic executor as the browser, reducer, replay and PvP paths, preserving
 * the versioned `sentinela` action kind while carrying optional modal modeId.
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
    );
  }
  return castSpell(state, playerId, action.instanceId, action.targetInstanceId);
}
