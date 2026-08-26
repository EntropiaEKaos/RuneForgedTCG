import { applyGameAction, type GameAction } from "@/game/reducer";
import { validateGameAction } from "@/game/authoritative";
import { validateGameActionSemantics } from "@/game/action-validator";
import { assertGameStateInvariant } from "@/game/invariants";
import type { GameState, PlayerId } from "@/game/types";
import { verifyReplayBundle, type ReplayDeckSnapshot } from "@/game/replay-content-snapshot";
import { withRegisteredCardSnapshot } from "@/game/custom-registry";

export type PvpTransitionResult =
  | { ok: true; authorized: GameAction; next: GameState }
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

/**
 * Apply one human-vs-human action against the immutable card-definition closure
 * captured when the room started. This prevents a Studio publish/deploy from
 * changing gameplay semantics halfway through a live PvP/Ranked match.
 */
export function applyAuthoritativePvpSnapshotAction(input: {
  state: GameState;
  gameAction: GameAction;
  actor: PlayerId;
  contentSnapshot: ReplayDeckSnapshot | null | undefined;
  contentHash: string | null | undefined;
}): PvpTransitionResult {
  const { state, gameAction, actor, contentSnapshot, contentHash } = input;
  if (!verifyReplayBundle(contentSnapshot) || contentSnapshot.contentHash !== contentHash) {
    return {
      ok: false,
      error: "Match content snapshot is missing or invalid",
      code: "MATCH_CONTENT_SNAPSHOT_INVALID",
      status: 409,
    };
  }

  return withRegisteredCardSnapshot(contentSnapshot.cardDefs, () => {
    const authorized = authorizePvpAction(gameAction, actor, state);
    const semantic = authorized
      ? validateGameActionSemantics(state, authorized, actor)
      : { ok: false, reason: "unauthorized action" };
    if (!authorized || !semantic.ok || !validateGameAction(state, authorized, actor)) {
      return { ok: false, error: semantic.reason || "Unauthorized or illegal action", status: 403 } as const;
    }
    const applied = applyGameAction(state, authorized, false);
    if (applied.awaitingReaction || applied.next === state) {
      return { ok: false, error: "Illegal game action", status: 422 } as const;
    }
    assertGameStateInvariant(applied.next);
    return { ok: true, authorized, next: applied.next } as const;
  });
}
