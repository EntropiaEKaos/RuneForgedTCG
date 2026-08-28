"use client";

import type { GameState } from "@/game/types";

export function TutorialChecklist({ state, open, onClose }: { state: GameState; open: boolean; onClose: () => void }) {
  if (!open || state.phase === "gameover") return null;
  const player = state.players.player;
  const steps = [
    { label: "Jogue sua primeira carta", done: player.stats.alliesSummoned + player.stats.spellsCast > 0 },
    { label: "Avance até a segunda rodada", done: state.round >= 2 },
    { label: "Invoque duas unidades", done: player.stats.alliesSummoned >= 2 },
    { label: "Conjure um feitiço", done: player.stats.spellsCast >= 1 },
    { label: "Cause dano ao Nexus rival", done: player.stats.nexusDamageDealt > 0 },
    { label: "Complete quatro rodadas", done: state.round >= 4 },
  ];
  const complete = steps.every((step) => step.done);
  const close = () => {
    if (complete) localStorage.setItem("runeforge_training_checklist", "complete");
    onClose();
  };
  return (
    <aside className={`tutorial-checklist ${complete ? "complete" : ""}`} aria-label="Treinamento da primeira partida">
      <header><div><small>TREINAMENTO</small><b>{complete ? "Ritual concluído" : "Primeiros passos"}</b></div><button onClick={close} aria-label="Fechar treinamento">×</button></header>
      <ol>{steps.map((step) => <li key={step.label} className={step.done ? "done" : ""}><i>{step.done ? "✓" : ""}</i><span>{step.label}</span></li>)}</ol>
      <p>{complete ? "Você dominou o fluxo básico da batalha." : `${steps.filter((step) => step.done).length}/${steps.length} objetivos concluídos`}</p>
    </aside>
  );
}
