import type { MatchPhase } from "@/components/MatchExperience";
import type { GameState } from "@/game/types";

const PHASE_LABEL: Record<MatchPhase, string> = {
  opponent: "Ação rival", main: "Sua prioridade", combat: "Combate", response: "Pilha aberta", gameover: "Encerrada",
};

export function BoardStatusStrip({ state, phase }: { state: GameState; phase: MatchPhase }) {
  const player = state.players.player;
  const opponent = state.players.ai;
  return (
    <section className="board-status-strip" aria-label="Resumo tático da mesa">
      <span><small>RIVAL</small><b>{opponent.hand.length} mão · {opponent.deck.length} deck</b></span>
      <span><small>MESA</small><b>{opponent.bench.length}/6 ↕ {player.bench.length}/6</b></span>
      <span className="board-status-phase"><small>FASE</small><b>{PHASE_LABEL[phase]}</b></span>
      <span><small>RECURSOS</small><b>{player.mana} mana · {player.spellMana} magia</b></span>
      <span><small>VOCÊ</small><b>{player.hand.length} mão · {player.deck.length} deck</b></span>
    </section>
  );
}
