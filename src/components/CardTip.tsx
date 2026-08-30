"use client";

import { getCard } from "@/game/cards";
import { activatedAbilitiesForInstance } from "@/game/engine";
import {
  activatedAbilityCostDescription,
  activatedAbilityCostLabel,
  activatedAbilityUiState,
} from "@/game/activated-ability-presentation";
import ActivatedAbilityIntelligence from "./ActivatedAbilityIntelligence";
import CardView, { type CardViewProps } from "./CardView";
import CardInfo from "./CardInfo";
import Tooltip from "./Tooltip";

export interface CardTipProps extends CardViewProps {
  /** Battlefield-only activation callback. Hand/deck cards omit this entirely. */
  onActivateAbility?: (abilityIndex: number) => void;
}

export default function CardTip({ onActivateAbility, ...cardProps }: CardTipProps) {
  const { defId, definition, unit, state, costOverride } = cardProps;
  const def = definition ?? getCard(defId);
  const abilities = state && unit && onActivateAbility
    ? activatedAbilitiesForInstance(state, unit.owner, unit.instanceId)
    : [];

  return (
    <Tooltip
      content={(
        <div className="space-y-2">
          <CardInfo defId={defId} definition={definition} unit={unit} state={state} costOverride={costOverride} />
          <ActivatedAbilityIntelligence
            definition={def}
            state={state}
            owner={unit?.owner}
            instanceId={unit?.instanceId}
          />
        </div>
      )}
      panelWidth={420}
      panelHeightEstimate={860}
    >
      <span data-card-tip-def-id={defId} data-unit-id={unit?.instanceId} className="inline-flex flex-col items-stretch gap-1 align-top">
        <CardView {...cardProps} />
        {abilities.length > 0 && unit && state && (
          <span className="flex max-w-full flex-col gap-1" data-activated-ability-tray={unit.instanceId}>
            {abilities.map((ability, abilityIndex) => {
              const ui = activatedAbilityUiState(state, unit.owner, unit.instanceId, abilityIndex);
              const statusText = ui.canUse ? "Pronta para ativar." : ui.reason ?? "Indisponível agora.";
              return (
                <button
                  key={`${unit.instanceId}-ability-${abilityIndex}`}
                  type="button"
                  disabled={!ui.canUse}
                  data-activated-ability-index={abilityIndex}
                  data-activated-ability-state={ui.status}
                  data-activated-ability-reason={ui.reason ?? undefined}
                  aria-label={`${ability.description}. ${activatedAbilityCostDescription(ability)} ${statusText}`}
                  title={`${activatedAbilityCostDescription(ability)} ${statusText}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (ui.canUse) onActivateAbility?.(abilityIndex);
                  }}
                  className="rounded-md border border-cyan-300/25 bg-slate-950/90 px-1.5 py-1 text-left text-[8px] font-bold leading-tight text-cyan-100 shadow-lg transition enabled:hover:border-cyan-200/60 enabled:hover:bg-cyan-950/90 disabled:cursor-not-allowed disabled:border-rose-300/15 disabled:bg-rose-950/20 disabled:text-slate-400"
                >
                  <span className="flex items-center justify-between gap-1">
                    <b className="text-amber-200">{activatedAbilityCostLabel(ability)}</b>
                    <span className={`text-[7px] font-black uppercase tracking-wider ${ui.canUse ? "text-emerald-300" : "text-rose-300"}`}>
                      {ui.canUse ? "PRONTA" : "BLOQUEADA"}
                    </span>
                  </span>
                  <span className="mt-0.5 block line-clamp-2">{ability.description}</span>
                  {!ui.canUse && <span className="mt-0.5 block text-[7px] font-semibold leading-tight text-rose-200/80">{ui.reason}</span>}
                </button>
              );
            })}
          </span>
        )}
      </span>
    </Tooltip>
  );
}
