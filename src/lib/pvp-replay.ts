import { applyGameAction, type GameAction } from "@/game/reducer";
import { createCustomGame } from "@/game/engine";
import { assertGameStateInvariant } from "@/game/invariants";
import { deriveGameEvents, type GameEvent } from "@/game/events";
import type { AiRulesSnapshot, DeckInput, EngineRulesSnapshot, GameState, PlayerId } from "@/game/types";
import { validateGameAction } from "@/game/authoritative";
import { validateGameActionSemantics } from "@/game/action-validator";
import { assertReplayActionAllowed } from "@/game/replay-protocol";

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
 * Replays a human-vs-human match through the production reducer. No AI
 * decisions are accepted or generated in this path.
 */
export function replayPvpMatch(input: PvpReplayInput): PvpReplayResult {
  let state = createCustomGame(input.hostName, input.hostDeck, input.guestDeck, { playerGoesFirst: input.playerFirst, seed: input.seed, rules: input.rules, aiRules: input.aiRules });
  let applied = 0;
  const events: GameEvent[] = [];

  for (const action of input.actions) {
    if (state.phase === "gameover") break;
    if (action.type === "react" || action.type === "resolve" || action.type === "aiStep") throw new Error(`Forbidden PvP transition at index ${applied}: ${action.type}`);
    const actor = actorForAction(action, state);
    if (!actor) throw new Error(`Unable to determine PvP actor at index ${applied}: ${action.type}`);
    assertReplayActionAllowed(state, action, actor, false);
    const semantic = validateGameActionSemantics(state, action, actor);
    if (!semantic.ok) throw new Error(`Invalid PvP action at index ${applied}: ${semantic.reason}`);
    if (!validateGameAction(state, action, actor)) throw new Error(`Unauthorized PvP action at index ${applied}: ${action.type}`);
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
