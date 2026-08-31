import { activateAbility } from "./engine";
import {
  applyGameAction as applyCoreGameAction,
  simulateMatch,
} from "./reducer-core";
import type {
  ActionResult as CoreActionResult,
  GameAction as CoreGameAction,
} from "./reducer-core";
import type { GameState, PlayerId } from "./types";

/**
 * Public reducer protocol. The historic `sentinela` opcode remains stable for
 * replay/PvP compatibility, but now carries an optional deterministic modeId
 * and resolves through the generic activated-ability executor.
 */
export type GameAction =
  | Exclude<CoreGameAction, { type: "sentinela" }>
  | {
      type: "sentinela";
      player: PlayerId;
      sentinelaId: string;
      abilityIndex: number;
      target?: string;
      modeId?: string;
    };

export type ActionResult = CoreActionResult;

/**
 * Compatibility facade over the 2.97 reducer core. Activated battlefield
 * actions are intercepted here so Units, Artifacts, Enchantments, Sentinelas
 * and modal choices all share one authoritative executor. Every other action
 * preserves the established reducer implementation unchanged.
 */
export function applyGameAction(
  state: GameState,
  action: GameAction,
  opponentIsBot: boolean = true,
): ActionResult {
  if (action.type === "sentinela") {
    return {
      next: activateAbility(
        state,
        action.player,
        action.sentinelaId,
        action.abilityIndex,
        action.target,
        action.modeId,
      ),
    };
  }
  return applyCoreGameAction(state, action as CoreGameAction, opponentIsBot);
}

export { simulateMatch };
