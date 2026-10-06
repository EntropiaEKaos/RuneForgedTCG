"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { getCardArt } from "@/game/card-art";
import { getCard } from "@/game/cards";
import { activatedAbilitiesForInstance, activatedAbilityChoices } from "@/game/engine";
import { activatedAbilityCostDescription, activatedAbilityCostLabel, activatedAbilityUiState } from "@/game/activated-ability-presentation";
import ActivatedAbilityIntelligence from "./ActivatedAbilityIntelligence";
import CardArtViewerButton, { CardArtViewerDialog } from "./CardArtViewerButton";
import CardView, { type CardViewProps } from "./CardView";
import CardInfo from "./CardInfo";
import ForgedMotionSurface from "./ForgedMotionSurface";
import Tooltip from "./Tooltip";

export interface CardTipProps extends CardViewProps { onActivateAbility?: (abilityIndex: number, modeId?: string) => void; artViewer?: boolean; }

export default function CardTip({ onActivateAbility, artViewer, ...cardProps }: CardTipProps) {
  const pathname = usePathname();
  const [artViewerOpen, setArtViewerOpen] = useState(false);
  const [abilityPanelOpen, setAbilityPanelOpen] = useState(false);
  const [abilityPanelPosition, setAbilityPanelPosition] = useState({ left: 12, top: 12 });
  const abilityButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!abilityPanelOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setAbilityPanelOpen(false); };
    const dismiss = () => setAbilityPanelOpen(false);
    window.addEventListener("keydown", close);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => { window.removeEventListener("keydown", close); window.removeEventListener("resize", dismiss); window.removeEventListener("scroll", dismiss, true); };
  }, [abilityPanelOpen]);
  const { defId, definition, unit, state, costOverride } = cardProps;
  const def = definition ?? getCard(defId);
  const abilities = state && unit && onActivateAbility ? activatedAbilitiesForInstance(state, unit.owner, unit.instanceId) : [];
  const artViewerEnabled = artViewer ?? (pathname === "/codex" || pathname === "/collection");
  const artUrl = getCardArt(defId)?.url ?? def.art ?? null;
  const restoreCollectionPointerEvents = pathname === "/collection";
  const legendaryPresentation = def.rarity === "Legend" || def.isLegend === true;

  return (
    <>
      <Tooltip content={<div className="space-y-2"><CardInfo defId={defId} definition={definition} unit={unit} state={state} costOverride={costOverride} /><ActivatedAbilityIntelligence definition={def} state={state} owner={unit?.owner} instanceId={unit?.instanceId} />{artViewerEnabled && <CardArtViewerButton defId={defId} name={def.name} artUrl={artUrl} onOpen={() => setArtViewerOpen(true)} />}</div>} panelWidth={420} panelHeightEstimate={900}>
        <ForgedMotionSurface
          legendary={legendaryPresentation}
          cardDefId={defId}
          unitId={unit?.instanceId}
          rarity={def.rarity}
          className={`relative inline-flex flex-col items-stretch gap-1 align-top ${restoreCollectionPointerEvents ? "pointer-events-auto" : ""}`}
        >
          <CardView {...cardProps} />
          {abilities.length > 0 && unit && state && <button
            ref={abilityButtonRef}
            type="button"
            data-activated-ability-trigger={unit.instanceId}
            aria-expanded={abilityPanelOpen}
            aria-label={`Habilidades ativadas de ${def.name}`}
            onClick={(event) => {
              event.preventDefault(); event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              const width = Math.min(320, window.innerWidth - 24);
              const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
              const panelHeight = Math.min(320, window.innerHeight * 0.6);
              const top = rect.bottom + 8 + panelHeight > window.innerHeight ? Math.max(12, rect.top - panelHeight - 8) : rect.bottom + 8;
              setAbilityPanelPosition({ left, top });
              setAbilityPanelOpen((current) => !current);
            }}
            className="absolute bottom-1 right-1 z-10 rounded-md border border-cyan-300/70 bg-slate-950/95 px-1.5 py-1 text-[10px] font-black text-cyan-100 shadow-lg"
          >⚡ {abilities.length}</button>}

        </ForgedMotionSurface>
      </Tooltip>
      {abilityPanelOpen && abilities.length > 0 && unit && state && typeof document !== "undefined" && createPortal(
        <>
          <button type="button" className="fixed inset-0 z-[210] cursor-default bg-transparent" aria-label="Fechar habilidades ativadas" onClick={() => setAbilityPanelOpen(false)} />
          <div role="dialog" aria-label={`Habilidades ativadas de ${def.name}`} data-activated-ability-tray={unit.instanceId} className="fixed z-[211] flex max-h-[60dvh] w-[min(320px,calc(100vw-24px))] flex-col gap-2 overflow-y-auto rounded-xl border border-cyan-300/40 bg-slate-950/95 p-3 text-slate-100 shadow-2xl" style={abilityPanelPosition}>
            <div className="flex items-center justify-between gap-2"><strong className="text-xs text-cyan-100">⚡ Habilidades · {def.name}</strong><button type="button" aria-label="Fechar painel" className="rounded px-2 py-1 text-xs" onClick={() => setAbilityPanelOpen(false)}>✕</button></div>
            {abilities.map((ability, abilityIndex) => { const choices = activatedAbilityChoices(ability); const modal = ability.modes !== undefined; return <span key={`${unit.instanceId}-ability-${abilityIndex}`} className="flex flex-col gap-1">{modal && <span className="rounded-md border border-violet-300/20 bg-violet-950/35 px-1.5 py-1 text-[8px] font-bold leading-tight text-violet-100"><span className="block text-[7px] font-black uppercase tracking-wider text-violet-300">Escolha um modo</span><span className="mt-0.5 block line-clamp-2">{ability.description}</span></span>}{choices.map((choice) => { const ui = activatedAbilityUiState(state, unit.owner, unit.instanceId, abilityIndex, choice.modeId); const statusText = ui.canUse ? "Pronta para ativar." : ui.reason ?? "Indisponível agora."; const label = modal ? choice.description : ability.description; return <button key={`${unit.instanceId}-ability-${abilityIndex}-${choice.modeId ?? "direct"}`} type="button" disabled={!ui.canUse} data-activated-ability-index={abilityIndex} data-activated-ability-mode-id={choice.modeId} data-activated-ability-state={ui.status} data-activated-ability-status={ui.status} data-activated-ability-reason={ui.reason ?? undefined} aria-label={`${label}. ${activatedAbilityCostDescription(ability)} ${statusText}`} title={`${activatedAbilityCostDescription(ability)} ${statusText}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (ui.canUse) { setAbilityPanelOpen(false); onActivateAbility?.(abilityIndex, choice.modeId); } }} className="rounded-md border border-cyan-300/25 bg-slate-950/90 px-1.5 py-1 text-left text-[8px] font-bold leading-tight text-cyan-100 shadow-lg transition enabled:hover:border-cyan-200/60 enabled:hover:bg-cyan-950/90 disabled:cursor-not-allowed disabled:border-rose-300/15 disabled:bg-rose-950/20 disabled:text-slate-400"><span className="flex items-center justify-between gap-1"><b className="text-amber-200">{activatedAbilityCostLabel(ability)}</b><span className={`text-[7px] font-black uppercase tracking-wider ${ui.canUse ? "text-emerald-300" : "text-rose-300"}`}>{ui.canUse ? "PRONTA" : "BLOQUEADA"}</span></span><span className="mt-0.5 block line-clamp-2">{label}</span>{!ui.canUse && <span className="mt-0.5 block text-[7px] font-semibold leading-tight text-rose-200/80">{ui.reason}</span>}</button>; })}</span>; })}
          </div>
        </>, document.body,
      )}
      {artViewerEnabled && <CardArtViewerDialog defId={defId} name={def.name} artUrl={artUrl} open={artViewerOpen} onClose={() => setArtViewerOpen(false)} />}
    </>
  );
}
