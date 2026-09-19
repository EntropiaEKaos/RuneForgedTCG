"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StudioBreadcrumb, StudioCommandPalette } from "../StudioChrome";
import { buildBattlefieldLabScenario, type BattlefieldLabMode } from "@/game/presentation/battlefield-lab-scenario";

export default function BattlefieldLabClient() {
  const [mode, setMode] = useState<BattlefieldLabMode>("commander-4p");
  const [units, setUnits] = useState(48);
  const scenario = useMemo(() => buildBattlefieldLabScenario(mode, units), [mode, units]);

  return (
    <main className="studio-shell min-h-screen">
      <StudioCommandPalette />
      <div className="studio-main mx-auto max-w-[1500px] p-5 sm:p-8">
        <StudioBreadcrumb section="QA" current="Battlefield Lab" />
        <header className="mt-5 rounded-[2rem] border border-cyan-300/20 bg-slate-950/75 p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Experimental // Renderer</p>
          <h1 className="mt-2 text-3xl font-black text-white">Battlefield Lab</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Harness isolado para desenvolver o renderer Phaser sem transferir autoridade de regras para o cliente.
            O Alpha atual continua sendo o renderer padrão.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-200">read-only snapshots</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">deterministic seed: {scenario.seed}</span>
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-amber-200">Phaser mount: próximo slice</span>
          </div>
        </header>

        <div className="mt-6 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-white/10 bg-slate-950/65 p-5">
            <h2 className="font-black text-white">Cenário determinístico</h2>
            <label className="mt-5 block text-xs font-bold text-slate-400">Modo</label>
            <select className="input mt-2 w-full" value={mode} onChange={(e) => setMode(e.target.value as BattlefieldLabMode)}>
              <option value="duel-1v1">1v1</option>
              <option value="commander-4p">Commander 4P</option>
            </select>
            <label className="mt-5 block text-xs font-bold text-slate-400">Unidades no battlefield: {units}</label>
            <input className="mt-3 w-full" type="range" min="8" max="160" step="8" value={units} onChange={(e) => setUnits(Number(e.target.value))} />
            <div className="mt-5 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><b className="block text-lg text-white">{scenario.players.length}</b><span className="text-slate-500">players</span></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><b className="block text-lg text-white">{scenario.entities.length}</b><span className="text-slate-500">entities</span></div>
            </div>
            <Link href="/admin/studio/lab" className="btn-ghost mt-5 inline-flex">Card Laboratory</Link>
          </aside>

          <section className="rounded-3xl border border-white/10 bg-slate-950/65 p-5">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-fuchsia-300">Presentation Contract</p><h2 className="mt-1 text-xl font-black text-white">Spatial snapshot</h2></div>
              <span className="font-mono text-xs text-slate-500">{scenario.mode}</span>
            </div>
            <div className="mt-5 grid min-h-[520px] gap-3 rounded-[2rem] border border-white/10 bg-black/30 p-4 sm:grid-cols-2">
              {scenario.players.map((player) => (
                <article key={player.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex justify-between gap-3"><b className="text-white">{player.label}</b><span className="text-xs text-slate-400">{player.life} life</span></div>
                  <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {scenario.entities.filter((entity) => entity.controllerId === player.id).map((entity) => (
                      <div key={entity.id} title={entity.id} className="aspect-[3/4] rounded-lg border border-cyan-200/15 bg-gradient-to-b from-cyan-300/10 to-fuchsia-300/5 p-1">
                        <span className="block truncate text-[8px] font-bold text-slate-400">{entity.kind}</span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
