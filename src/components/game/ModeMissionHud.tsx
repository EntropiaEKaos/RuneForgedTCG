"use client";

import { useState, useSyncExternalStore } from "react";
import {
  getActiveModeMission,
  subscribeActiveModeMission,
} from "@/game/client/mode-mission";

const serverSnapshot = () => null;

const MODE_LABEL: Record<string, string> = {
  puzzle: "PUZZLE TÁTICO",
  boss: "BATALHA DE CHEFE",
  brawl: "BRAWL · REGRAS ESPECIAIS",
};

export function ModeMissionHud() {
  const mission = useSyncExternalStore(
    subscribeActiveModeMission,
    getActiveModeMission,
    serverSnapshot,
  );
  const [open, setOpen] = useState(true);
  const [revealedHintId, setRevealedHintId] = useState("");

  if (!mission) return null;
  const hintVisible = mission.kind === "puzzle" && revealedHintId === mission.id;

  return (
    <aside
      className="mx-3 mb-2 overflow-hidden rounded-2xl border border-amber-300/20 bg-slate-950/85 shadow-[0_18px_60px_rgba(0,0,0,.35)] backdrop-blur"
      data-mode-mission={mission.kind}
      aria-label={`Missão ativa: ${mission.name}`}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.05] text-xl" aria-hidden="true">
          {mission.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <small className="block text-[9px] font-black uppercase tracking-[.22em] text-amber-300">
            {MODE_LABEL[mission.kind]}
          </small>
          <b className="mt-0.5 block truncate text-sm text-white">{mission.name}</b>
          {!open && <span className="mt-0.5 block truncate text-[11px] text-slate-400">{mission.objective}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
          {mission.difficulty ? `Nível ${mission.difficulty}` : "Missão"}
          <i className="not-italic text-base text-slate-300">{open ? "−" : "+"}</i>
        </span>
      </button>

      {open && (
        <div className="border-t border-white/[.07] px-4 py-3">
          <div className="grid gap-3 lg:grid-cols-[1.35fr_.65fr]">
            <div>
              <small className="text-[9px] font-black uppercase tracking-[.18em] text-slate-500">Objetivo atual</small>
              <p className="mt-1 text-sm font-bold leading-5 text-amber-100">{mission.objective}</p>
              {mission.description && mission.description !== mission.objective && (
                <p className="mt-1.5 max-w-4xl text-[11px] leading-5 text-slate-400">{mission.description}</p>
              )}
            </div>

            <div className="flex flex-wrap content-start justify-start gap-1.5 lg:justify-end">
              {mission.region && (
                <span className="rounded-full border border-white/10 bg-white/[.04] px-2.5 py-1 text-[10px] font-bold text-slate-300">
                  {mission.region}
                </span>
              )}
              {mission.facts.map((fact) => (
                <span key={fact} className="rounded-full border border-cyan-300/15 bg-cyan-300/[.05] px-2.5 py-1 text-[10px] font-bold text-cyan-100">
                  {fact}
                </span>
              ))}
            </div>
          </div>

          {mission.kind === "puzzle" && mission.hint && (
            <div className="mt-3 border-t border-white/[.06] pt-3">
              {hintVisible ? (
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-violet-300/15 bg-violet-300/[.05] px-3 py-2.5">
                  <p className="text-[11px] leading-5 text-violet-100"><b>Dica:</b> {mission.hint}</p>
                  <button type="button" className="text-[10px] font-black uppercase tracking-wider text-violet-300" onClick={() => setRevealedHintId("")}>Ocultar dica</button>
                </div>
              ) : (
                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-white/[.03] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:bg-white/[.06]"
                  onClick={() => setRevealedHintId(mission.id)}
                >
                  Revelar dica tática
                </button>
              )}
            </div>
          )}

          <p className="mt-3 text-[9px] uppercase tracking-wider text-slate-600">
            Briefing da tentativa autoritativa · resolução e recompensas continuam no servidor
          </p>
        </div>
      )}
    </aside>
  );
}

export default ModeMissionHud;
