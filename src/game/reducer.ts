/**
 * Public reducer facade. The authoritative implementation lives in
 * reducer-core.ts so every action — including the backwards-compatible
 * `sentinela` opcode with optional modal `modeId` — passes through the same
 * gameover, runtime override and action-allowlist gates.
 *
 * Certified semantic card types add one extra authority boundary here: Trap
 * cards are reaction-only and therefore cannot be submitted through normal
 * `play`/`cast` opcodes even if a client is modified.
 */
import { getCard } from "./cards";
import { isTrapCard } from "./semantic-card-types";
import {
  applyGameAction as applyCoreGameAction,
  simulateMatch,
  type ActionResult,
  type GameAction,
} from "./reducer-core";
import type { GameState } from "./types";

export function applyGameAction(
  state: GameState,
  action: GameAction,
  opponentIsBot: boolean = true,
): ActionResult {
  if (action.type === "play" || action.type === "cast") {
    const instance = state.players[action.player].hand.find((card) => card.instanceId === action.instanceId);
    if (instance && isTrapCard(getCard(instance.defId))) return { next: state };
  }
  return applyCoreGameAction(state, action, opponentIsBot);
}

export { simulateMatch };
export type { ActionResult, GameAction };
