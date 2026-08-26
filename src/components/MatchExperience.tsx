"use client";

import { useState } from "react";
import type { GameState } from "@/game/types";
import { matchGuidance, potentialAttackPressure, type MatchPhase } from "./match-experience-model";
export { matchGuidance, potentialAttackPressure, type MatchPhase } from "./match-experience-model";

const PHASES: ReadonlyArray<{ id: MatchPhase; icon: string; label: string }> = [
  { id: "opponent", icon: "◌", label: "Oponente" },
  { id: "main", icon: "◆", label: "Principal" },
  { id: "combat", icon: "⚔", label: "Combate" },
  { id: "response", icon: "↯", label: "Resposta" },
  { id: "gameover", icon: "✦", label: "Fim" },
];

export function TurnRail({ phase, guidance }: { phase: MatchPhase; guidance: string }) {
  return (
    <div className="match-command-rail" aria-live="polite">
      <div className="match-phase-track" aria-label="Estado atual da partida">
        {PHASES.map((item) => (
          <span key={item.id} className={item.id === phase ? "active" : ""}>
            <b>{item.icon}</b>{item.label}
          </span>
        ))}
      </div>
      <p>{guidance}</p>
    </div>
  );
}

export function AttackForecast({ state, selectedIds }: { state: GameState; selectedIds: string[] }) {
  if (!selectedIds.length) return null;
  const pressure = potentialAttackPressure(state.players.player.bench, selectedIds);
  return (
    <div className="attack-forecast" role="status">
      <span>PRESSÃO POTENCIAL</span>
      <strong>{pressure}</strong>
      <small>{selectedIds.length} atacante(s) · antes dos bloqueios</small>
    </div>
  );
}

const GUIDE = [
  { icon: "◆", title: "Proteja seu Nexus", text: "Você vence reduzindo o Nexus inimigo a zero — ou aplicando 10 marcadores de veneno." },
  { icon: "✦", title: "Gaste mana com intenção", text: "Unidades constroem sua mesa. Até 3 de mana não usada vira mana de feitiço." },
  { icon: "⚔", title: "Leia o Token de Ataque", text: "Somente quem possui o token pode iniciar combate. Selecione atacantes e revise a pressão antes de confirmar." },
  { icon: "↯", title: "Responda à pilha", text: "Cartas rápidas abrem prioridade. A última resposta entra primeiro e resolve primeiro." },
  { icon: "✦", title: "Domine sua identidade", text: "Cartas de duas ou três regiões ativam Maestria apenas quando a identidade completa do deck coincide exatamente com a carta." },
];

export function FirstMatchGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  if (!open) return null;
  const item = GUIDE[step];
  const finish = () => {
    localStorage.setItem("runeforge_first_match_guide", "complete");
    setStep(0);
    onClose();
  };
  return (
    <div className="match-guide-backdrop" role="dialog" aria-modal="true" aria-labelledby="match-guide-title">
      <div className="match-guide-card">
        <button className="match-guide-skip" onClick={finish}>Pular guia</button>
        <div className="match-guide-icon">{item.icon}</div>
        <p className="match-guide-kicker">BRIEFING {step + 1}/{GUIDE.length}</p>
        <h2 id="match-guide-title">{item.title}</h2>
        <p>{item.text}</p>
        <div className="match-guide-progress" aria-hidden="true">
          {GUIDE.map((_, index) => <i key={index} className={index <= step ? "active" : ""} />)}
        </div>
        <button className="btn-primary" onClick={() => step === GUIDE.length - 1 ? finish() : setStep((current) => current + 1)}>
          {step === GUIDE.length - 1 ? "Entrar na batalha" : "Continuar"}
        </button>
      </div>
    </div>
  );
}
