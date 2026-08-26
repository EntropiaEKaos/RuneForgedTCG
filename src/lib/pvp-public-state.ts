import type { GameState } from "@/game/types";

/**
 * Project the authoritative server state into one participant's local view.
 * The guest is re-oriented to the local `player` slot, then both future deck
 * orders and the opponent hand are redacted. RNG/instance counters stay
 * server-only so a browser cannot predict future authoritative transitions.
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
