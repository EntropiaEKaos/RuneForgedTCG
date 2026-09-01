import { getCard } from "../cards";
import type { GameState, PlayerId } from "../types";
import { recomputeContinuousAuras } from "./state";

export function cleanupSentinelas(state: GameState): void {
  let removedSentinela = false;
  for (const pid of ["player", "ai"] as PlayerId[]) {
    const p = state.players[pid];
    const dead = p.sentinelas.filter((s) => s.loyalty <= 0);
    if (dead.length) removedSentinela = true;
    for (const s of dead) {
      const def = getCard(s.defId);
      state.log.push(`A Sentinela ${def.name} foi destruída (Lealdade 0).`);
    }
    p.sentinelas = p.sentinelas.filter((s) => s.loyalty > 0);
  }
  if (removedSentinela) recomputeContinuousAuras(state);
}
export function resetSentinelasActivation(state: GameState): void {
  for (const pid of ["player", "ai"] as PlayerId[]) {
    for (const s of state.players[pid].sentinelas) {
      s.activatedThisTurn = false;
    }
  }
}
