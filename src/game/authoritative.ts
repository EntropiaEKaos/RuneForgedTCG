import { aiChooseReaction } from "./ai";
import { applyGameAction, type GameAction } from "./reducer";
import {
  applyStackedActionWithAi,
  canReactWithResponse,
  createCustomGame,
  findActivatedAbilitySource,
  type CardAction,
  type CustomGameOptions,
} from "./engine";
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

function reactionSourceDefId(action: Extract<GameAction, { type: "react" }>, state: GameState): string | null {
  const source = findActivatedAbilitySource(state, "player", action.instanceId);
  if (!source) return null;
  if (source.kind === "unit") return source.unit.defId;
  if (source.kind === "permanent") return source.perm.defId;
  return source.sen.defId;
}

function asCardAction(action: GameAction, state: GameState): CardAction | null {
  if (action.type !== "play" && action.type !== "cast" && action.type !== "react") return null;
  if (action.type === "react" && action.responseKind === "activatedAbility") {
    if (action.abilityIndex === undefined) return null;
    const defId = reactionSourceDefId(action, state);
    if (!defId) return null;
    return {
      player: "player",
      kind: "sentinela",
      responseKind: "activatedAbility",
      instanceId: action.instanceId,
      defId,
      abilityIndex: action.abilityIndex,
      targetInstanceId: action.target,
      ...(action.modeId ? { modeId: action.modeId } : {}),
      ...(action.costDiscardInstanceIds ? { costDiscardInstanceIds: action.costDiscardInstanceIds } : {}),
    };
  }
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
        if (!canReactWithResponse(state, "player", counter, pendingAiAction)) {
          throw new Error(`Illegal reaction response at index ${applied}`);
        }
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

  if (pendingAiAction) throw new Error("Replay ended with an unresolved reaction window");
  return { state, applied, events };
}