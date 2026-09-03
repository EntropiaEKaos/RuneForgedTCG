import type { GameState, PlayerId } from "@/game/types";
import type { PvpReactionPriorityState } from "@/lib/pvp-reaction-priority";

const orientPlayer = (player: PlayerId, viewerIsGuest: boolean): PlayerId =>
  viewerIsGuest ? (player === "player" ? "ai" : "player") : player;

/**
 * The pending stack frame is already public once played. Re-orient only seat
 * identifiers for the guest; stable instance/definition/target ids remain the
 * same ids used by the participant GameState projection.
 */
export function toPvpParticipantReactionState(
  reactionState: PvpReactionPriorityState | null | undefined,
  viewerIsGuest: boolean,
): PvpReactionPriorityState | null {
  if (!reactionState) return null;
  const source = structuredClone(reactionState);
  return {
    ...source,
    actor: orientPlayer(source.actor, viewerIsGuest),
    responder: orientPlayer(source.responder, viewerIsGuest),
    pendingAction: {
      ...source.pendingAction,
      ...(source.pendingAction.player
        ? { player: orientPlayer(source.pendingAction.player, viewerIsGuest) }
        : {}),
    },
  };
}

/**
 * Project the authoritative server state into one participant's local view.
 * The guest is re-oriented to the local `player` slot, then both future deck
 * orders and the opponent hand are redacted. Graveyards are public, but their
 * owner seat ids are re-oriented with every other public board-zone owner.
 * RNG/instance counters stay server-only so a browser cannot predict future
 * authoritative transitions.
 */
export function toPvpParticipantGameState(state: GameState, viewerIsGuest: boolean): GameState {
  const source = structuredClone(state);
  const publicState: GameState = viewerIsGuest
    ? {
        ...source,
        players: {
          player: { ...source.players.ai, id: "player" },
          ai: { ...source.players.player, id: "ai" },
        },
        activePlayer: source.activePlayer === "player" ? "ai" : "player",
        attackToken: source.attackToken === "player" ? "ai" : "player",
        winner: source.winner === "player" ? "ai" : source.winner === "ai" ? "player" : null,
        mulliganDone: { player: source.mulliganDone.ai, ai: source.mulliganDone.player },
        combat: source.combat
          ? {
              ...source.combat,
              attackerId: source.combat.attackerId === "player" ? "ai" : "player",
            }
          : null,
      }
    : source;

  if (viewerIsGuest) {
    for (const pid of ["player", "ai"] as const) {
      for (const unit of publicState.players[pid].bench) unit.owner = pid;
      for (const perm of publicState.players[pid].permanents) perm.owner = pid;
      for (const sentinela of publicState.players[pid].sentinelas) sentinela.owner = pid;
      for (const entry of publicState.players[pid].graveyard ?? []) entry.owner = pid;
    }
  }

  for (const pid of ["player", "ai"] as const) {
    publicState.players[pid].deck = publicState.players[pid].deck.map(() => "__hidden__");
    if (pid !== "player") {
      publicState.players[pid].hand = publicState.players[pid].hand.map(() => ({ hidden: true } as never));
    }
  }
  publicState.seed = 0;
  publicState.rngState = 0;
  publicState.idCounter = 0;
  return publicState;
}