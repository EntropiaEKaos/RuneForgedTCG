"use client";

import { getCard } from "@/game/cards";
import { canActivateSentinela } from "@/game/engine";
import { REGION_STYLE } from "./CardView";
import type { GameState, SentinelaInstance } from "@/game/types";
import { getGameConfigSync } from "@/game/settings";

interface SentinelaViewProps {
  instance: SentinelaInstance;
  state: GameState;
  size?: "sm" | "md";
  /** Chamado com o índice da habilidade quando o jogador ativa. */
  onActivate?: (abilityIndex: number) => void;
}

/**
 * Renderiza uma Sentinela (Planeswalker) em jogo: lealdade e habilidades.
 */
export default function SentinelaView({ instance, state, size = "md", onActivate }: SentinelaViewProps) {
  const def = getCard(instance.defId);
  const style = REGION_STYLE[def.region];
  const isOwnerTurn = state.activePlayer === instance.owner && state.phase === "main";
  const dims = size === "sm" ? "w-24 min-h-36" : "w-32 min-h-44";

  const configuredFallbackArt = getGameConfigSync().advanced.presentation.artFallbackUrl;
  const artUrl = def.art || configuredFallbackArt;
  return (
    <div
      className={`tcg-sentinel relative flex flex-col overflow-hidden rounded-xl border-2 bg-gradient-to-br p-2 text-left ${dims} ${style.grad} ${style.border}`}
    >
      <div className="tcg-sentinel-art absolute inset-0" style={artUrl ? { backgroundImage: `url(${artUrl})` } : undefined} />
      <div className="tcg-sentinel-vignette absolute inset-0" />
      <div className="tcg-sentinel-orbit" aria-hidden="true" />
      <div className="tcg-sentinel-crown" aria-hidden="true" />
      <div className="relative z-10">
      <div className="tcg-sentinel-topline"><span>◆ SENTINELA</span><span>{style.sigil}</span></div>
      {/* Lealdade */}
      <div className="tcg-sentinel-loyalty absolute right-1 top-6 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/70 bg-slate-900 text-sm font-black text-amber-300">
        {instance.loyalty}
      </div>
      <div className="absolute left-1 top-1 text-lg">{def.emoji}</div>

      <p className="mt-7 truncate text-xs font-black text-white">{def.name}</p>
      <p className="text-[9px] uppercase tracking-wider text-white/70">Sentinela</p>

      {/* Habilidades */}
      <div className="mt-2 flex flex-col gap-1">
        {def.sentinela?.abilities.map((ab, i) => {
          const canUse = isOwnerTurn && onActivate && canActivateSentinela(state, instance.owner, instance.instanceId, i);
          const costLabel = ab.cost > 0 ? `+${ab.cost}` : `${ab.cost}`;
          return (
            <button
              key={i}
              type="button"
              disabled={!canUse}
              onClick={() => onActivate?.(i)}
              className={`tcg-sentinel-ability rounded px-1.5 py-1 text-left text-[9px] leading-tight transition ${
                canUse
                  ? "bg-white/20 text-white hover:bg-white/30"
                  : "bg-black/30 text-white/50"
              }`}
            >
              <span className="font-black text-amber-200">{costLabel}</span>: {ab.description}
            </button>
          );
        })}
      </div>
      </div>
    </div>
  );
}
