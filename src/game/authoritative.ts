import { aiChooseReaction } from "./ai";
import { applyGameAction, type GameAction } from "./reducer";
import { applyStackedActionWithAi, createCustomGame, type CardAction, type CustomGameOptions } from "./engine";
import type { DeckInput, GameState } from "./types";
import { assertGameStateInvariant } from "./invariants";
import { deriveGameEvents, type GameEvent } from "./events";
import { validateGameActionSemantics } from "./action-validator";
import { assertReplayActionAllowed } from "./replay-protocol";

export interface AuthoritativeMatchInput {
  playerName: string;
  playerDeck: DeckInput;
  aiDeck: DeckInput;
  playerGoesFirst: boolean;
  seed: number;
  actions: GameAction[];
  customOptions?: CustomGameOptions;
}

export interface ReplayResult {
  state: GameState;
  applied: number;
  events: GameEvent[];
}

export function validateGameAction(state: GameState, action: GameAction, actor: "player" | "ai" = "player"): boolean {
  // `resolve` is not a normal player action. It is only legal when the
  // authoritative replay driver has an actual pending AI reaction window.
  // Keeping it invalid here prevents a client from injecting arbitrary
  // resolve steps into an action log and advancing the AI outside the
  // server-derived reaction flow.
  if (action.type === "resolve") return false;
  const semantic = validateGameActionSemantics(state, action, actor);
  if (!semantic.ok) return false;
  if (action.type === "play" || action.type === "cast" || action.type === "attack" || action.type === "pass" || action.type === "sentinela") {
    return action.player === actor && state.activePlayer === actor && state.phase === "main";
  }
  if (action.type === "block") return state.phase === "blocking" && state.combat?.attackerId !== actor;
  if (action.type === "mulligan" || action.type === "skipMulligan") return action.player === actor && !state.mulliganDone[actor];
  if (action.type === "aiStep") return false;
  if (action.type === "react") return action.player === actor;
  return false;
}

function asCardAction(action: GameAction, state: GameState): CardAction | null {
  if (action.type !== "play" && action.type !== "cast" && action.type !== "react") return null;
  const card = state.players.player.hand.find((c) => c.instanceId === action.instanceId);
  if (!card) return null;
  return {
    player: "player",
    kind: action.type === "cast" || action.type === "react" ? "spell" : "unit",
    instanceId: action.instanceId,
    defId: card.defId,
    targetInstanceId: action.target,
  };
}

/** Replay exclusively through the production reducer/engine. */
export function replayAuthoritativeMatch(input: AuthoritativeMatchInput): ReplayResult {
  let state = createCustomGame(input.playerName, input.playerDeck, input.aiDeck, { ...input.customOptions, playerGoesFirst: input.playerGoesFirst, seed: input.seed });
  let applied = 0;
  let pendingAiAction: CardAction | null = null;
  const events: GameEvent[] = [];

  const driveDerivedAi = () => {
    // AI decisions are derived by the server, never accepted from the client.
    // This must run after every completed player-controlled transition,
    // including resolving or countering a pending AI reaction window. The
    // live match driver does the same; skipping it here makes replay phase
    // ordering diverge from the game that originally produced the action log.
    for (let guard = 0; guard < 80 && !pendingAiAction && state.phase !== "gameover" && state.activePlayer === "ai"; guard++) {
      const aiResult = applyGameAction(state, { type: "aiStep" });
      if (aiResult.awaitingReaction) {
        pendingAiAction = aiResult.awaitingReaction.action;
        const previous = state;
        state = aiResult.next;
        events.push(...deriveGameEvents(previous, state));
        assertGameStateInvariant(state);
        break;
      }
      if (aiResult.next === state) break;
      const previous = state;
      state = aiResult.next;
      events.push(...deriveGameEvents(previous, state));
      assertGameStateInvariant(state);
    }
  };

  for (const action of input.actions) {
    if (state.phase === "gameover") throw new Error(`Action submitted after gameover at index ${applied}`);
    assertReplayActionAllowed(state, action, "player", Boolean(pendingAiAction));

    if (!validateGameAction(state, action, "player") && !pendingAiAction) {
      throw new Error(`Unauthorized game action at index ${applied}: ${action.type}`);
    }

    if (pendingAiAction) {
      if (action.type === "resolve") {
        const previous = state;
        state = applyStackedActionWithAi(state, pendingAiAction, "skip", null, aiChooseReaction).next;
        events.push(...deriveGameEvents(previous, state));
        assertGameStateInvariant(state);
        pendingAiAction = null;
        applied += 1;
        driveDerivedAi();
        continue;
      }
      const semanticReaction = validateGameActionSemantics(state, action, "player");
      if (!semanticReaction.ok) throw new Error(`Invalid reaction action at index ${applied}: ${semanticReaction.reason}`);
      const counter = asCardAction(action, state);
      if (counter) {
        const previous = state;
        state = applyStackedActionWithAi(state, pendingAiAction, "react", counter, aiChooseReaction).next;
        events.push(...deriveGameEvents(previous, state));
        assertGameStateInvariant(state);
        pendingAiAction = null;
        applied += 1;
        driveDerivedAi();
        continue;
      }
      throw new Error(`Expected reaction/resolve action at index ${applied}`);
    }

    const previous = state;
    const result = applyGameAction(state, action);
    events.push(...deriveGameEvents(previous, result.next));
    assertGameStateInvariant(result.next);
    if (result.awaitingReaction) {
      pendingAiAction = result.awaitingReaction.action;
      state = result.next;
      applied += 1;
    } else {
      if (result.next === state && action.type !== "resolve") {
        throw new Error(`Rejected game action at index ${applied}: ${action.type}`);
      }
      state = result.next;
      applied += 1;
    }

    driveDerivedAi();
  }

  if (pendingAiAction) {
    // An unfinished reaction means the submitted action log does not describe
    // a complete game; never derive a result from an incomplete replay.
    throw new Error("Replay ended with an unresolved reaction window");
  }

  return { state, applied, events };
}
