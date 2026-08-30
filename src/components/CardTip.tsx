"use client";

import { activatedAbilitiesForInstance, canBeginActivateAbility } from "@/game/engine";
import type { ActivatedAbility } from "@/game/activated-ability-types";
import CardView, { type CardViewProps } from "./CardView";
import CardInfo from "./CardInfo";
import Tooltip from "./Tooltip";

export interface CardTipProps extends CardViewProps {
  /** Battlefield-only activation callback. Hand/deck cards omit this entirely. */
  onActivateAbility?: (abilityIndex: number) => void;
}

function costLabel(ability: ActivatedAbility): string {
  const parts: string[] = [];
  const cost = ability.cost;
  if (cost?.mana) parts.push(`💧${cost.mana}`);
  if (cost?.nexusHealth) parts.push(`♥${cost.nexusHealth}`);
  if (cost?.exhaustSelf) parts.push("↷");
  if (cost?.sacrificeSelf) parts.push("✕");
  if (cost?.loyaltyDelta !== undefined) {
    parts.push(`${cost.loyaltyDelta > 0 ? "+" : ""}${cost.loyaltyDelta}◆`);
  }
  return parts.length ? parts.join(" ") : "ATIVAR";
}

export default function CardTip({ onActivateAbility, ...cardProps }: CardTipProps) {
  const { defId, definition, unit, state, costOverride } = cardProps;
  const abilities = state && unit && onActivateAbility
    ? activatedAbilitiesForInstance(state, unit.owner, unit.instanceId)
    : [];

  return (
    <Tooltip
      content={<CardInfo defId={defId} definition={definition} unit={unit} state={state} costOverride={costOverride} />}
      panelWidth={420}
      panelHeightEstimate={720}
    >
      <span data-card-tip-def-id={defId} data-unit-id={unit?.instanceId} className="inline-flex flex-col items-stretch gap-1 align-top">
        <CardView {...cardProps} />
        {abilities.length > 0 && unit && state && (
          <span className="flex max-w-full flex-col gap-1" data-activated-ability-tray={unit.instanceId}>
            {abilities.map((ability, abilityIndex) => {
              const canUse = canBeginActivateAbility(state, unit.owner, unit.instanceId, abilityIndex);
              return (
                <button
                  key={`${unit.instanceId}-ability-${abilityIndex}`}
                  type="button"
                  disabled={!canUse}
                  data-activated-ability-index={abilityIndex}
                  aria-label={`Ativar: ${ability.description}`}
                  title={`${costLabel(ability)} — ${ability.description}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (canUse) onActivateAbility?.(abilityIndex);
                  }}
                  className="rounded-md border border-cyan-300/25 bg-slate-950/90 px-1.5 py-1 text-left text-[8px] font-bold leading-tight text-cyan-100 shadow-lg transition enabled:hover:border-cyan-200/60 enabled:hover:bg-cyan-950/90 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <b className="mr-1 text-amber-200">{costLabel(ability)}</b>
                  <span className="line-clamp-2">{ability.description}</span>
                </button>
              );
            })}
          </span>
        )}
      </span>
    </Tooltip>
  );
}
