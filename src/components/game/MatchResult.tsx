"use client";

import { useState } from "react";
import type { GameState } from "@/game/types";
import { evaluateMatchMastery } from "@/game/client/match-mastery";

export interface MatchReward { xpGain: number; goldGain: number; dustGain: number; leveledUp?: boolean; newLevel?: number }

export function MatchResult({ state, reward, onReplay, onChangeDeck }: { state: GameState; reward?: MatchReward | null; onReplay: () => void; onChangeDeck: () => void }) {
  const [shared, setShared] = useState(false);
  if (state.phase !== "gameover") return null;
  const player = state.players.player;
  const opponent = state.players.ai;
  const victory = state.winner === "player";
  const outcome = victory ? "victory" : "defeat";
  const mastery = evaluateMatchMastery(state);
  const defeated = victory ? opponent : player;
  const maxRoundDecision = state.log.some((entry) => entry.startsWith("Maximum round limit ("));
  const resultMessage = defeated.poisonCounters >= 10
    ? victory ? "O oponente sucumbiu ao veneno." : "Você sucumbiu ao veneno."
    : defeated.nexusHealth <= 0
      ? victory ? "O Nexus inimigo foi quebrado." : "Seu Nexus caiu. A batalha terminou."
      : maxRoundDecision
        ? victory ? "Vitória por decisão no limite de rodadas." : "Derrota por decisão no limite de rodadas."
        : victory ? "O adversário se rendeu. Vitória confirmada." : "Você se rendeu. Derrota confirmada.";

  const share = async () => {
    const text = `${victory ? "Vitória" : "Batalha"} no Runeforge · Nota ${mastery.grade} · ${player.stats.nexusDamageDealt} de dano · ${state.round} rodadas.`;
    try {
      if (navigator.share) await navigator.share({ title: "Runeforge — Relatório de batalha", text });
      else await navigator.clipboard.writeText(text);
      setShared(true);
    } catch { setShared(false); }
  };

  return (
    <div className="match-result-backdrop" data-result-outcome={outcome}>
      <div className="match-result-atmosphere" aria-hidden="true">
        <span className="match-result-rift match-result-rift-outer" />
        <span className="match-result-rift match-result-rift-inner" />
        <span className="match-result-spark match-result-spark-a">✦</span>
        <span className="match-result-spark match-result-spark-b">◇</span>
      </div>

      <section
        className="gameover-card match-result-card"
        data-result-outcome={outcome}
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-result-title"
      >
        <header className="match-result-hero">
          <div className="match-result-seal" aria-hidden="true">
            <span className="match-result-seal-ring" />
            <strong>{victory ? "✦" : "◇"}</strong>
          </div>
          <div className="match-result-hero-copy">
            <p className="gameover-kicker">NEXUS CLASH · BATALHA CONCLUÍDA</p>
            <h2 id="match-result-title" className="gameover-title">{victory ? "VITÓRIA" : "DERROTA"}</h2>
            <p className="gameover-subtitle">{resultMessage}</p>
          </div>
        </header>

        <div className="match-result-scoreboard" aria-label="Placar final do Nexus">
          <div className="match-result-nexus-score match-result-nexus-score-player">
            <small>SEU NEXUS</small>
            <strong>{player.nexusHealth}</strong>
            <span>{player.nexusHealth > 0 ? "Permaneceu de pé" : "Fraturado"}</span>
          </div>
          <div className="match-result-versus" aria-hidden="true"><i />◇<i /></div>
          <div className="match-result-nexus-score match-result-nexus-score-opponent">
            <small>NEXUS RIVAL</small>
            <strong>{opponent.nexusHealth}</strong>
            <span>{opponent.nexusHealth > 0 ? "Permaneceu de pé" : "Fraturado"}</span>
          </div>
        </div>

        <div className="match-result-stats" aria-label="Resumo da batalha">
          <span><small>Rodadas</small><b>{state.round}</b></span>
          <span><small>Dano ao Nexus</small><b>{player.stats.nexusDamageDealt}</b></span>
          <span><small>Invocações</small><b>{player.stats.alliesSummoned}</b></span>
          <span><small>Feitiços</small><b>{player.stats.spellsCast}</b></span>
        </div>

        <section className="match-mastery" aria-label={`Maestria de partida ${mastery.grade}`}>
          <div className="match-mastery-medal" aria-hidden="true"><strong>{mastery.grade}</strong><span>MAESTRIA</span></div>
          <div className="match-mastery-copy">
            <small>MAESTRIA DE PARTIDA · {mastery.score}/100</small>
            <b>{mastery.title}</b>
            <p>{mastery.highlights.join(" · ")}</p>
            <div className="match-mastery-track" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, mastery.score))}%` }} /></div>
          </div>
        </section>

        {reward && (
          <section className="match-reward-panel" aria-label="Recompensas confirmadas">
            <div className="match-reward-heading">
              <span aria-hidden="true">✦</span>
              <div><small>RECOMPENSAS CONFIRMADAS</small><b>Progresso conquistado</b></div>
            </div>
            <div className="match-rewards">
              <span><small>XP</small><b>+{reward.xpGain}</b><i>Experiência</i></span>
              <span><small>OURO</small><b>+{reward.goldGain}</b><i>Tesouro</i></span>
              {reward.dustGain > 0 && <span><small>PÓ</small><b>+{reward.dustGain}</b><i>Arcano</i></span>}
              {reward.leveledUp && <strong className="match-level-up">✦ NÍVEL {reward.newLevel}</strong>}
            </div>
          </section>
        )}

        <div className="match-result-actions">
          <button onClick={onReplay} className="btn-primary">⚔ Revanche</button>
          <button onClick={onChangeDeck} className="btn-ghost">Trocar deck</button>
          <button onClick={share} className="btn-ghost">{shared ? "✓ Copiado" : "Compartilhar resultado"}</button>
        </div>
      </section>
    </div>
  );
}
