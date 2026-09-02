"use client";

import type { GameState, PlayerId } from "@/game/types";

export function PlayerBar({
  player,
  active,
  hasToken,
  top,
  flash = 0,
}: {
  player: GameState["players"]["player"];
  active: boolean;
  hasToken: boolean;
  top?: boolean;
  flash?: number;
}) {
  const pips = [];
  for (let i = 0; i < Math.max(player.maxMana, 1); i++) pips.push(i < player.mana);
  const nexusState = player.nexusHealth <= 5 ? "fractured" : player.nexusHealth <= 10 ? "cracked" : player.nexusHealth <= 15 ? "strained" : "stable";
  const visibleOpponentCards = Math.min(10, player.hand.length);
  return (
    <div
      data-player-side={top ? "opponent" : "player"}
      className={[
        "tcg-playerbar flex items-center justify-between gap-3 px-4 py-2.5",
        top ? "tcg-playerbar-top" : "tcg-playerbar-bottom",
        active ? "tcg-playerbar-active" : "",
        top ? "border-t border-red-400/10" : "border-b border-cyan-400/10",
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className={["tcg-avatar", top ? "tcg-avatar-ai" : "tcg-avatar-player"].join(" ")}>
          {top ? "♞" : "✦"}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-black leading-none text-white">{player.name}</p>
            {hasToken && <span className="tcg-token" title="Token de Ataque">⚔</span>}
            {active && <span className="tcg-turn-badge">{top ? "TURNO RIVAL" : "SEU TURNO"}</span>}
          </div>
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Mão {player.hand.length} · Deck {player.deck.length}
          </p>
        </div>
      </div>

      {top && player.hand.length > 0 && (
        <div className="tcg-opponent-hand" aria-label={`Mão rival: ${player.hand.length} carta(s)`}>
          {Array.from({ length: visibleOpponentCards }, (_, index) => (
            <i key={index} className="tcg-opponent-card" aria-hidden="true" />
          ))}
          {player.hand.length > visibleOpponentCards && <span className="tcg-opponent-hand-more">+{player.hand.length - visibleOpponentCards}</span>}
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <div className="tcg-mana-panel">
          <div className="tcg-mana-label"><span>MANA</span><b>{player.mana}/{player.maxMana}</b></div>
          <div className="flex gap-1">
            {pips.map((filled, i) => (
              <span key={i} className={["tcg-mana-crystal", filled ? "" : "empty"].join(" ")} />
            ))}
          </div>
          {player.spellMana > 0 && <div className="tcg-spell-mana">✦ {player.spellMana} mana de feitiço</div>}
        </div>
        <div
          key={`nx-${flash}`}
          data-nexus-side={player.id}
          data-nexus-state={nexusState}
          className={[
            "tcg-nexus",
            player.nexusHealth <= 5 ? "tcg-nexus-danger" : "",
            flash > 0 ? "nexus-hit" : "",
          ].join(" ")}
        >
          <span className="tcg-nexus-gem" aria-hidden="true"><b>◆</b></span>
          <div>
            <span className="tcg-nexus-label">NEXUS</span>
            <span className={["tcg-nexus-value", player.nexusHealth <= 5 ? "text-red-300" : "text-emerald-300"].join(" ")}>{player.nexusHealth}</span>
          </div>
        </div>
        {player.poisonCounters > 0 && (
          <div
            className={[
              "tcg-nexus",
              player.poisonCounters >= 7 ? "tcg-nexus-danger" : "",
            ].join(" ")}
            title={`${player.poisonCounters}/10 contadores de veneno — 10 = derrota`}
          >
            <span className="tcg-nexus-gem">🧪</span>
            <div>
              <span className="tcg-nexus-label">VENENO</span>
              <span className={["tcg-nexus-value", player.poisonCounters >= 7 ? "text-red-300" : "text-emerald-300"].join(" ")}>
                {player.poisonCounters}/10
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyHint({ text }: { text: string }) {
  return <span className="px-2 text-xs italic text-white/30">{text}</span>;
}

export function Row({ label, side, children }: { label: string; side?: PlayerId; children: React.ReactNode }) {
  return (
    <div data-bench-side={side} className={["tcg-row relative flex min-h-[104px] items-center gap-2 overflow-x-auto px-4 py-2", side ? `tcg-row-${side}` : ""].join(" ")}>
      <span className="tcg-row-label pointer-events-none">{label}</span>
      {children}
    </div>
  );
}
