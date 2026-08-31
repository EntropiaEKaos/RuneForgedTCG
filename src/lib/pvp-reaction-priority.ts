import { getCard } from "@/game/cards";
import {
  applyStackedAction,
  canReactWithResponse,
  findActivatedAbilitySource,
  hasReactionOpportunity,
  type CardAction,
} from "@/game/engine";
import type { GameAction } from "@/game/reducer";
import type { GameState, PlayerId } from "@/game/types";

export const PVP_REACTION_WINDOW_MS = 10_000;
export const PVP_REACTION_PROTOCOL_VERSION = 1 as const;

/**
 * Server-persisted reaction window for human-vs-human matches.
 *
 * `gameState` remains the immutable pre-action state while this record exists.
 * The pending action is resolved only after the responder explicitly reacts,
 * passes priority, or the authoritative deadline expires. This avoids rollback
 * semantics and makes reconnect/polling deterministic across app replicas.
 */
export interface PvpReactionPriorityState {
  protocolVersion: typeof PVP_REACTION_PROTOCOL_VERSION;
  pendingAction: CardAction;
  actor: PlayerId;
  responder: PlayerId;
  openedAt: number;
  deadlineAt: number;
}

export type PvpReactionResolution =
  | { ok: true; next: GameState; resolvedAction: CardAction; response?: CardAction }
  | { ok: false; error: string };

const opposite = (player: PlayerId): PlayerId => player === "player" ? "ai" : "player";

function sourceDefId(state: GameState, player: PlayerId, instanceId: string): string | null {
  const source = findActivatedAbilitySource(state, player, instanceId);
  if (source?.kind === "unit") return source.unit.defId;
  if (source?.kind === "permanent") return source.perm.defId;
  if (source?.kind === "sentinela") return source.sen.defId;
  return null;
}

/** Convert a normal main-phase network action into the immutable stack frame. */
export function pvpPendingCardAction(state: GameState, action: GameAction): CardAction | null {
  if (action.type !== "play" && action.type !== "cast") return null;
  const instance = state.players[action.player].hand.find((card) => card.instanceId === action.instanceId);
  if (!instance) return null;
  const def = getCard(instance.defId);
  const kind: CardAction["kind"] = action.type === "cast" || def.type === "Spell"
    ? "spell"
    : def.type === "Sentinela"
      ? "sentinela"
      : "unit";
  return {
    kind,
    player: action.player,
    instanceId: action.instanceId,
    defId: instance.defId,
    ...(action.target ? { targetInstanceId: action.target } : {}),
  };
}

/**
 * Open a PvP priority window only when the opposing seat has a legal response.
 * This function never mutates the supplied game state.
 */
export function openPvpReactionPriority(
  state: GameState,
  action: GameAction,
  now: number = Date.now(),
  durationMs: number = PVP_REACTION_WINDOW_MS,
): PvpReactionPriorityState | null {
  const pendingAction = pvpPendingCardAction(state, action);
  if (!pendingAction || !pendingAction.player) return null;
  const responder = opposite(pendingAction.player);
  if (!hasReactionOpportunity(state, responder, pendingAction)) return null;
  const boundedDuration = Number.isFinite(durationMs) ? Math.max(1_000, Math.min(60_000, Math.trunc(durationMs))) : PVP_REACTION_WINDOW_MS;
  return {
    protocolVersion: PVP_REACTION_PROTOCOL_VERSION,
    pendingAction,
    actor: pendingAction.player,
    responder,
    openedAt: now,
    deadlineAt: now + boundedDuration,
  };
}

export function pvpReactionPriorityExpired(window: PvpReactionPriorityState, now: number = Date.now()): boolean {
  return !Number.isFinite(window.deadlineAt) || now >= window.deadlineAt;
}

/** Convert the additive replay/network `react` opcode into one exact stack response. */
export function pvpReactionResponseAction(
  state: GameState,
  actor: PlayerId,
  action: GameAction,
): CardAction | null {
  if (action.type !== "react" || action.player !== actor) return null;
  if (action.responseKind === "activatedAbility") {
    if (action.abilityIndex === undefined) return null;
    const defId = sourceDefId(state, actor, action.instanceId);
    if (!defId) return null;
    return {
      kind: "sentinela",
      player: actor,
      responseKind: "activatedAbility",
      instanceId: action.instanceId,
      defId,
      abilityIndex: action.abilityIndex,
      ...(action.modeId ? { modeId: action.modeId } : {}),
      ...(action.target ? { targetInstanceId: action.target } : {}),
      ...(action.costDiscardInstanceIds ? { costDiscardInstanceIds: [...action.costDiscardInstanceIds] } : {}),
    };
  }
  const instance = state.players[actor].hand.find((card) => card.instanceId === action.instanceId);
  if (!instance) return null;
  return {
    kind: "spell",
    player: actor,
    instanceId: action.instanceId,
    defId: instance.defId,
    ...(action.target ? { targetInstanceId: action.target } : {}),
  };
}

function resolveStackedPvpWindow(
  state: GameState,
  window: PvpReactionPriorityState,
  response: CardAction | null,
) {
  if (window.responder === "player") {
    return applyStackedAction(state, window.pendingAction, response
      ? { human: "react", playerCounter: response }
      : { human: "skip", playerCounter: null });
  }
  return applyStackedAction(state, window.pendingAction, { human: "skip", playerCounter: response });
}

/**
 * Resolve an explicit response. The exact response is revalidated before the
 * existing stack engine is allowed to mutate state, so malformed network
 * payloads cannot degrade into an implicit pass.
 */
export function resolvePvpReactionResponse(
  state: GameState,
  window: PvpReactionPriorityState,
  actor: PlayerId,
  action: GameAction,
): PvpReactionResolution {
  if (window.protocolVersion !== PVP_REACTION_PROTOCOL_VERSION) return { ok: false, error: "Unsupported PvP reaction protocol version" };
  if (actor !== window.responder) return { ok: false, error: "Only the priority holder may react" };
  const response = pvpReactionResponseAction(state, actor, action);
  if (!response) return { ok: false, error: "Invalid PvP reaction response payload" };
  if (!canReactWithResponse(state, actor, response, window.pendingAction)) return { ok: false, error: "Illegal PvP reaction response" };
  const resolved = resolveStackedPvpWindow(state, window, response);
  if (resolved.awaitingReaction) return { ok: false, error: "Nested PvP reaction priority is not certified by protocol v1" };
  return { ok: true, next: resolved.next, resolvedAction: window.pendingAction, response };
}

/** Explicit pass or authoritative timeout: resolve the pending action unchanged. */
export function resolvePvpReactionPass(
  state: GameState,
  window: PvpReactionPriorityState,
  actor: PlayerId,
  options: { timeout?: boolean; now?: number } = {},
): PvpReactionResolution {
  if (window.protocolVersion !== PVP_REACTION_PROTOCOL_VERSION) return { ok: false, error: "Unsupported PvP reaction protocol version" };
  if (!options.timeout && actor !== window.responder) return { ok: false, error: "Only the priority holder may pass" };
  if (options.timeout && !pvpReactionPriorityExpired(window, options.now)) return { ok: false, error: "PvP reaction deadline has not expired" };
  const resolved = resolveStackedPvpWindow(state, window, null);
  if (resolved.awaitingReaction) return { ok: false, error: "PvP reaction pass reopened the same priority window" };
  return { ok: true, next: resolved.next, resolvedAction: window.pendingAction };
}
