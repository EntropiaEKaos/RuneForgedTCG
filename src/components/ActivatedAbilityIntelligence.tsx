import { activatedAbilitiesForDef } from "@/game/engine";
import {
  activatedAbilityCostDescription,
  activatedAbilityCostLabel,
  activatedAbilityUiState,
} from "@/game/activated-ability-presentation";
import type { CardDef, GameState, PlayerId } from "@/game/types";

interface ActivatedAbilityIntelligenceProps {
  definition: CardDef;
  state?: GameState;
  owner?: PlayerId;
  instanceId?: string;
  fromIndex?: number;
}

export default function ActivatedAbilityIntelligence({
  definition,
  state,
  owner,
  instanceId,
  fromIndex = 0,
}: ActivatedAbilityIntelligenceProps) {
  const abilities = activatedAbilitiesForDef(definition)
    .map((ability, index) => ({ ability, index }))
    .filter(({ index }) => index >= fromIndex);

  if (abilities.length === 0) return null;

  return (
    <section
      data-activated-ability-intelligence={definition.defId}
      className="rounded-2xl border border-cyan-400/20 bg-slate-950/98 p-3 shadow-2xl backdrop-blur-xl"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[9px] font-black uppercase tracking-[.18em] text-cyan-300">Habilidades ativadas</div>
        <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[.06] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-cyan-100">
          {abilities.length} {abilities.length === 1 ? "habilidade" : "habilidades"}
        </span>
      </div>
      <div className="space-y-2">
        {abilities.map(({ ability, index }) => {
          const ui = state && owner && instanceId
            ? activatedAbilityUiState(state, owner, instanceId, index)
            : null;
          return (
            <div
              key={`${definition.defId}-activated-intelligence-${index}`}
              data-activated-ability-detail-index={index}
              data-activated-ability-detail-state={ui?.status ?? "reference"}
              className="rounded-xl border border-white/10 bg-white/[.035] px-2.5 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-black leading-tight text-slate-100">{ability.description}</div>
                  <div className="mt-1 text-[8px] leading-relaxed text-slate-400">{activatedAbilityCostDescription(ability)}</div>
                </div>
                <span className="shrink-0 rounded border border-amber-300/20 bg-amber-300/[.08] px-1.5 py-0.5 text-[8px] font-black text-amber-200">
                  {activatedAbilityCostLabel(ability)}
                </span>
              </div>
              {ui && (
                <div className={`mt-1.5 text-[8px] font-bold ${ui.canUse ? "text-emerald-300" : "text-rose-300"}`}>
                  {ui.canUse ? "● PRONTA PARA ATIVAR" : `● BLOQUEADA — ${ui.reason}`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
