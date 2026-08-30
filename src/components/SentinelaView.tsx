"use client";

import { getCard } from "@/game/cards";
import { activatedAbilitiesForInstance, canBeginActivateAbility } from "@/game/engine";
import type { ActivatedAbility } from "@/game/activated-ability-types";
import { REGION_STYLE } from "./CardView";
import CardInfo from "./CardInfo";
import Tooltip from "./Tooltip";
import type { GameState, SentinelaInstance } from "@/game/types";
import { getClientArtFallbackUrl } from "@/game/client-game-config";

interface SentinelaViewProps {
  instance: SentinelaInstance;
  state: GameState;
  size?: "sm" | "md";
  /** Chamado com o índice unificado da habilidade quando o jogador ativa. */
  onActivate?: (abilityIndex: number) => void;
}

function abilityCostLabel(ability: ActivatedAbility): string {
  const parts: string[] = [];
  const cost = ability.cost;
  if (cost?.loyaltyDelta !== undefined) parts.push(`${cost.loyaltyDelta > 0 ? "+" : ""}${cost.loyaltyDelta}◆`);
  if (cost?.mana) parts.push(`💧${cost.mana}`);
  if (cost?.nexusHealth) parts.push(`♥${cost.nexusHealth}`);
  if (cost?.exhaustSelf) parts.push("↷");
  if (cost?.sacrificeSelf) parts.push("✕");
  return parts.length ? parts.join(" ") : "ATIVAR";
}

/** Renderiza uma Sentinela em jogo: lealdade, habilidades e inspeção completa. */
export default function SentinelaView({ instance, state, size = "md", onActivate }: SentinelaViewProps) {
  const def = getCard(instance.defId);
  const style = REGION_STYLE[def.region];
  const dims = size === "sm" ? "w-24 min-h-36" : "w-32 min-h-44";
  const configuredFallbackArt = getClientArtFallbackUrl();
  const artUrl = def.art || configuredFallbackArt;
  const abilities = activatedAbilitiesForInstance(state, instance.owner, instance.instanceId);

  return (
    <Tooltip
      content={<CardInfo defId={instance.defId} sentinela={instance} state={state} />}
      panelWidth={420}
      panelHeightEstimate={720}
    >
      <div
        data-sentinela-id={instance.instanceId}
        className={`tcg-sentinel relative flex flex-col overflow-hidden rounded-xl border-2 bg-gradient-to-br p-2 text-left ${dims} ${style.grad} ${style.border}`}
      >
        <div className="tcg-sentinel-art absolute inset-0" style={artUrl ? { backgroundImage: `url(${artUrl})` } : undefined} />
        <div className="tcg-sentinel-vignette absolute inset-0" />
        <div className="tcg-sentinel-orbit" aria-hidden="true" />
        <div className="tcg-sentinel-crown" aria-hidden="true" />
        <div className="relative z-10">
          <div className="tcg-sentinel-topline"><span>◆ SENTINELA</span><span>{style.sigil}</span></div>
          <div className="tcg-sentinel-loyalty absolute right-1 top-6 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/70 bg-slate-900 text-sm font-black text-amber-300">
            {instance.loyalty}
          </div>
          <div className="absolute left-1 top-1 text-lg">{def.emoji}</div>

          <p className="mt-7 truncate text-xs font-black text-white">{def.name}</p>
          <p className="text-[9px] uppercase tracking-wider text-white/70">Sentinela</p>

          <div className="mt-2 flex flex-col gap-1">
            {abilities.map((ability, index) => {
              const canUse = Boolean(onActivate) && canBeginActivateAbility(state, instance.owner, instance.instanceId, index);
              return (
                <button
                  key={index}
                  type="button"
                  disabled={!canUse}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (canUse) onActivate?.(index);
                  }}
                  className={`tcg-sentinel-ability rounded px-1.5 py-1 text-left text-[9px] leading-tight transition ${canUse ? "bg-white/20 text-white hover:bg-white/30" : "bg-black/30 text-white/50"}`}
                >
                  <span className="font-black text-amber-200">{abilityCostLabel(ability)}</span>: {ability.description}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Tooltip>
  );
}
