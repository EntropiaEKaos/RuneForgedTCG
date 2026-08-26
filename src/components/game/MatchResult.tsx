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
  const mastery = evaluateMatchMastery(state);
  const share = async () => {
    const text = `${victory ? "Vitória" : "Batalha"} no Runeforge · Nota ${mastery.grade} · ${player.stats.nexusDamageDealt} de dano · ${state.round} rodadas.`;
    try {
      if (navigator.share) await navigator.share({ title: "Runeforge — Relatório de batalha", text });
      else await navigator.clipboard.writeText(text);
      setShared(true);
    } catch { setShared(false); }
  };
  return (
    <div className="match-result-backdrop">
      <section className="gameover-card match-result-card" role="dialog" aria-modal="true" aria-labelledby="match-result-title">
        <div className="gameover-crown">{victory ? "✦" : "◇"}</div>
        <p className="gameover-kicker">NEXUS CLASH · RELATÓRIO</p>
        <h2 id="match-result-title" className="gameover-title">{victory ? "VITÓRIA" : "DERROTA"}</h2>
        <p className="gameover-subtitle">{victory
          ? opponent.poisonCounters >= 10 ? "O oponente sucumbiu ao veneno." : "O Nexus inimigo foi quebrado."
          : player.poisonCounters >= 10 ? "Você sucumbiu ao veneno." : "Seu Nexus caiu. A batalha terminou."}</p>
        <div className="gameover-score"><span>{player.nexusHealth}</span><b>×</b><span>{opponent.nexusHealth}</span></div>
        <div className="match-result-stats">
          <span><small>Rodadas</small><b>{state.round}</b></span>
          <span><small>Dano ao Nexus</small><b>{player.stats.nexusDamageDealt}</b></span>
          <span><small>Invocações</small><b>{player.stats.alliesSummoned}</b></span>
          <span><small>Feitiços</small><b>{player.stats.spellsCast}</b></span>
        </div>
        <div className="match-mastery"><strong>{mastery.grade}</strong><div><small>MAESTRIA DE PARTIDA · {mastery.score}/100</small><b>{mastery.title}</b><p>{mastery.highlights.join(" · ")}</p></div></div>
        {reward && <div className="match-rewards" aria-label="Recompensas confirmadas"><span><small>XP</small><b>+{reward.xpGain}</b></span><span><small>OURO</small><b>+{reward.goldGain}</b></span>{reward.dustGain > 0 && <span><small>PÓ</small><b>+{reward.dustGain}</b></span>}{reward.leveledUp && <strong>✦ NÍVEL {reward.newLevel}</strong>}</div>}
        <div className="match-result-actions">
          <button onClick={onReplay} className="btn-primary">⚔ Revanche</button>
          <button onClick={onChangeDeck} className="btn-ghost">Trocar deck</button>
          <button onClick={share} className="btn-ghost">{shared ? "✓ Copiado" : "Compartilhar resultado"}</button>
        </div>
      </section>
    </div>
  );
}
