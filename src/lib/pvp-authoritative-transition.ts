import { applyGameAction, type GameAction } from "@/game/reducer";
import { validateGameAction } from "@/game/authoritative";
import { validateGameActionSemantics } from "@/game/action-validator";
import { assertGameStateInvariant } from "@/game/invariants";
import type { GameState, PlayerId } from "@/game/types";
import { verifyReplayBundle, type ReplayDeckSnapshot } from "@/game/replay-content-snapshot";
import { withRegisteredCardSnapshot } from "@/game/custom-registry";
import {
  openPvpReactionPriority,
  pvpReactionPriorityExpired,
  resolvePvpReactionPass,
  resolvePvpReactionResponse,
  type PvpReactionPriorityState,
} from "@/lib/pvp-reaction-priority";

export type PvpTransitionResult =
  | {
      ok: true;
      authorized: GameAction;
      next: GameState;
      reactionState: PvpReactionPriorityState | null;
      stateChanged: boolean;
    }
  | { ok: false; error: string; status: 403 | 409 | 422; code?: string };

export function authorizePvpAction(gameAction: GameAction, actor: PlayerId, state: GameState): GameAction | null {
  switch (gameAction.type) {
    case "play":
    case "cast":
    case "attack":
    case "pass":
    case "sentinela":
    case "mulligan":
    case "skipMulligan":
      if (gameAction.player !== actor) return null;
      if (gameAction.type !== "mulligan" && gameAction.type !== "skipMulligan" && state.activePlayer !== actor) return null;
      return gameAction;
    case "block":
      if (state.phase !== "blocking" || state.combat?.attackerId === actor) return null;
      return gameAction;
    case "react":
    case "resolve":
    case "aiStep":
      return null;
    default:
      return null;
  }
}

function validSnapshot(contentSnapshot: ReplayDeckSnapshot | null | undefined, contentHash: string | null | undefined) {
  return verifyReplayBundle(contentSnapshot) && contentSnapshot.contentHash === contentHash;
}

function invalidSnapshot(): PvpTransitionResult {
  return {
    ok: false,
    error: "Match content snapshot is missing or invalid",
    code: "MATCH_CONTENT_SNAPSHOT_INVALID",
    status: 409,
  };
}

/**
 * Apply one human-vs-human action against the immutable card-definition closure
 * captured when the room started. A reactable play/cast now opens persisted
 * network priority without mutating GameState. The exact same pre-action state
 * is resolved later by `react` or historical `resolve` (priority pass).
 */
export function applyAuthoritativePvpSnapshotAction(input: {
  state: GameState;
  gameAction: GameAction;
  actor: PlayerId;
  reactionState?: PvpReactionPriorityState | null;
  contentSnapshot: ReplayDeckSnapshot | null | undefined;
  contentHash: string | null | undefined;
  now?: number;
}): PvpTransitionResult {
  const {
    state,
    gameAction,
    actor,
    reactionState = null,
    contentSnapshot,
    contentHash,
    now = Date.now(),
  } = input;
  if (!validSnapshot(contentSnapshot, contentHash)) return invalidSnapshot();

  return withRegisteredCardSnapshot(contentSnapshot!.cardDefs, () => {
    if (reactionState) {
      if (pvpReactionPriorityExpired(reactionState, now)) {
        return {
          ok: false,
          error: "PvP reaction priority expired; synchronize the room before acting",
          code: "PVP_REACTION_PRIORITY_EXPIRED",
          status: 409,
        } as const;
      }
      if (actor !== reactionState.responder) {
        return {
          ok: false,
          error: "PvP reaction priority belongs to the opposing player",
          code: "PVP_REACTION_PRIORITY_HELD_BY_OPPONENT",
          status: 409,
        } as const;
      }
      const resolved = gameAction.type === "react"
        ? resolvePvpReactionResponse(state, reactionState, actor, gameAction)
        : gameAction.type === "resolve"
          ? resolvePvpReactionPass(state, reactionState, actor)
          : null;
      if (!resolved) {
        return {
          ok: false,
          error: "A reaction window is open; react or pass priority first",
          code: "PVP_REACTION_PRIORITY_OPEN",
          status: 409,
        } as const;
      }
      if (!resolved.ok) return { ok: false, error: resolved.error, status: 422 } as const;
      assertGameStateInvariant(resolved.next);
      return {
        ok: true,
        authorized: gameAction,
        next: resolved.next,
        reactionState: null,
        stateChanged: resolved.next !== state,
      } as const;
    }

    const authorized = authorizePvpAction(gameAction, actor, state);
    const semantic = authorized
      ? validateGameActionSemantics(state, authorized, actor)
      : { ok: false, reason: "unauthorized action" };
    if (!authorized || !semantic.ok || !validateGameAction(state, authorized, actor)) {
      return { ok: false, error: semantic.reason || "Unauthorized or illegal action", status: 403 } as const;
    }

    const opened = openPvpReactionPriority(state, authorized, now);
    if (opened) {
      return {
        ok: true,
        authorized,
        next: state,
        reactionState: opened,
        stateChanged: false,
      } as const;
    }

    const applied = applyGameAction(state, authorized, false);
    if (applied.awaitingReaction || applied.next === state) {
      return { ok: false, error: "Illegal game action", status: 422 } as const;
    }
    assertGameStateInvariant(applied.next);
    return {
      ok: true,
      authorized,
      next: applied.next,
      reactionState: null,
      stateChanged: true,
    } as const;
  });
}

/**
 * Lazily resolve an expired persisted window under the same immutable content
 * snapshot. GET/poll and stale POST paths call this while holding the room row
 * lock so a disconnected responder can never deadlock the match.
 */
export function expireAuthoritativePvpSnapshotReaction(input: {
  state: GameState;
  reactionState: PvpReactionPriorityState;
  contentSnapshot: ReplayDeckSnapshot | null | undefined;
  contentHash: string | null | undefined;
  now?: number;
}): PvpTransitionResult {
  const { state, reactionState, contentSnapshot, contentHash, now = Date.now() } = input;
  if (!validSnapshot(contentSnapshot, contentHash)) return invalidSnapshot();
  return withRegisteredCardSnapshot(contentSnapshot!.cardDefs, () => {
    const resolved = resolvePvpReactionPass(state, reactionState, reactionState.responder, { timeout: true, now });
    if (!resolved.ok) return { ok: false, error: resolved.error, status: 409 } as const;
    assertGameStateInvariant(resolved.next);
    return {
      ok: true,
      authorized: { type: "resolve" },
      next: resolved.next,
      reactionState: null,
      stateChanged: resolved.next !== state,
    } as const;
  });
}
