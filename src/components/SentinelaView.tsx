"use client";

import { getCard } from "@/game/cards";
import { activatedAbilitiesForInstance } from "@/game/engine";
import {
  activatedAbilityCostDescription,
  activatedAbilityCostLabel,
  activatedAbilityUiState,
} from "@/game/activated-ability-presentation";
import { REGION_STYLE } from "./CardView";
import ActivatedAbilityIntelligence from "./ActivatedAbilityIntelligence";
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

/** Renderiza uma Sentinela em jogo: lealdade, habilidades e inspeção completa. */
export default function SentinelaView({ instance, state, size = "md", onActivate }: SentinelaViewProps) {
  const def = getCard(instance.defId);
  const style = REGION_STYLE[def.region];
  const dims = size === "sm" ? "w-24 min-h-36" : "w-32 min-h-44";
  const configuredFallbackArt = getClientArtFallbackUrl();
  const artUrl = def.art || configuredFallbackArt;
  const abilities = activatedAbilitiesForInstance(state, instance.owner, instance.instanceId);
  const legacyAbilityCount = def.sentinela?.abilities.length ?? 0;

  return (
    <Tooltip
      content={(
        <div className="space-y-2">
          <CardInfo defId={instance.defId} sentinela={instance} state={state} />
          <ActivatedAbilityIntelligence
            definition={def}
            state={state}
            owner={instance.owner}
            instanceId={instance.instanceId}
            fromIndex={legacyAbilityCount}
          />
        </div>
      )}
      panelWidth={420}
      panelHeightEstimate={860}
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
              const availability = activatedAbilityUiState(state, instance.owner, instance.instanceId, index);
              const canUse = Boolean(onActivate) && availability.canUse;
              const reason = !onActivate
                ? "Apenas o controlador pode ativar esta habilidade."
                : availability.reason;
              const statusText = canUse ? "Pronta para ativar." : reason ?? "Indisponível agora.";
              return (
                <button
                  key={index}
                  type="button"
                  disabled={!canUse}
                  data-activated-ability-index={index}
                  data-activated-ability-state={canUse ? "ready" : "blocked"}
                  data-activated-ability-reason={canUse ? undefined : reason ?? undefined}
                  aria-label={`${ability.description}. ${activatedAbilityCostDescription(ability)} ${statusText}`}
                  title={`${activatedAbilityCostDescription(ability)} ${statusText}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (canUse) onActivate?.(index);
                  }}
                  className={`tcg-sentinel-ability rounded px-1.5 py-1 text-left text-[9px] leading-tight transition ${canUse ? "bg-white/20 text-white hover:bg-white/30" : "bg-black/35 text-white/55"}`}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className="font-black text-amber-200">{activatedAbilityCostLabel(ability)}</span>
                    <span className={`text-[7px] font-black uppercase tracking-wider ${canUse ? "text-emerald-300" : "text-rose-300"}`}>
                      {canUse ? "PRONTA" : "BLOQUEADA"}
                    </span>
                  </span>
                  <span className="mt-0.5 block">{ability.description}</span>
                  {!canUse && <span className="mt-0.5 block text-[7px] font-semibold leading-tight text-rose-200/80">{reason}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Tooltip>
  );
}
