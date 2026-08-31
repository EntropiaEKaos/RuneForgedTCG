import { applyGameAction, type GameAction } from "@/game/reducer";
import { createCustomGame } from "@/game/engine";
import { assertGameStateInvariant } from "@/game/invariants";
import { deriveGameEvents, type GameEvent } from "@/game/events";
import type { AiRulesSnapshot, DeckInput, EngineRulesSnapshot, GameState, PlayerId } from "@/game/types";
import { validateGameAction } from "@/game/authoritative";
import { validateGameActionSemantics } from "@/game/action-validator";
import { assertReplayActionAllowed } from "@/game/replay-protocol";
import {
  openPvpReactionPriority,
  resolvePvpReactionPass,
  resolvePvpReactionResponse,
  type PvpReactionPriorityState,
} from "@/lib/pvp-reaction-priority";

export interface PvpReplayInput {
  hostName: string;
  guestName: string;
  hostDeck: DeckInput;
  guestDeck: DeckInput;
  playerFirst: boolean;
  seed: number;
  actions: GameAction[];
  rules?: EngineRulesSnapshot;
  aiRules?: AiRulesSnapshot;
}

export interface PvpReplayResult {
  state: GameState;
  applied: number;
  events: GameEvent[];
}

function actorForAction(action: GameAction, state: GameState): PlayerId | null {
  if ("player" in action) return action.player;
  if (action.type === "block") {
    const attacker = state.combat?.attackerId;
    return attacker ? (attacker === "player" ? "ai" : "player") : null;
  }
  return null;
}

/**
 * Replays a human-vs-human match through the same persistent reaction protocol
 * used by the room API. A reactable base action is logged immediately but does
 * not mutate GameState until the following `react` or historical `resolve`
 * action closes priority.
 */
export function replayPvpMatch(input: PvpReplayInput): PvpReplayResult {
  let state = createCustomGame(input.hostName, input.hostDeck, input.guestDeck, { playerGoesFirst: input.playerFirst, seed: input.seed, rules: input.rules, aiRules: input.aiRules });
  let reactionState: PvpReactionPriorityState | null = null;
  let applied = 0;
  const events: GameEvent[] = [];

  for (const action of input.actions) {
    if (state.phase === "gameover") break;
    if (action.type === "aiStep") throw new Error(`Forbidden PvP transition at index ${applied}: ${action.type}`);

    if (reactionState) {
      const previous = state;
      if (action.type === "react") {
        const resolved = resolvePvpReactionResponse(state, reactionState, action.player, action);
        if (!resolved.ok) throw new Error(`Invalid PvP reaction at index ${applied}: ${resolved.error}`);
        state = resolved.next;
      } else if (action.type === "resolve") {
        const resolved = resolvePvpReactionPass(state, reactionState, reactionState.responder);
        if (!resolved.ok) throw new Error(`Invalid PvP priority pass at index ${applied}: ${resolved.error}`);
        state = resolved.next;
      } else {
        throw new Error(`PvP action ${action.type} attempted while reaction priority was open at index ${applied}`);
      }
      reactionState = null;
      events.push(...deriveGameEvents(previous, state));
      assertGameStateInvariant(state);
      applied += 1;
      continue;
    }

    if (action.type === "react" || action.type === "resolve") {
      throw new Error(`Reaction opcode without an open PvP priority window at index ${applied}: ${action.type}`);
    }
    const actor = actorForAction(action, state);
    if (!actor) throw new Error(`Unable to determine PvP actor at index ${applied}: ${action.type}`);
    assertReplayActionAllowed(state, action, actor, false);
    const semantic = validateGameActionSemantics(state, action, actor);
    if (!semantic.ok) throw new Error(`Invalid PvP action at index ${applied}: ${semantic.reason}`);
    if (!validateGameAction(state, action, actor)) throw new Error(`Unauthorized PvP action at index ${applied}: ${action.type}`);

    const opened = openPvpReactionPriority(state, action, 0);
    if (opened) {
      reactionState = opened;
      applied += 1;
      continue;
    }

    const previous = state;
    const result = applyGameAction(state, action, false);
    if (result.awaitingReaction) throw new Error("PvP replay produced an unexpected AI reaction window");
    if (result.next === state) throw new Error(`Rejected PvP action at index ${applied}: ${action.type}`);
    state = result.next;
    events.push(...deriveGameEvents(previous, state));
    assertGameStateInvariant(state);
    applied += 1;
  }

  return { state, applied, events };
}
