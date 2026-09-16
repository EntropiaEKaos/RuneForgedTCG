"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "./CardAuthoringFields";
import { FORGED_FX_PRESETS, type FxPresetId } from "@/game/fx-registry";

const PRESET_IDS = Object.keys(FORGED_FX_PRESETS) as FxPresetId[];

const rendererLabel = { motion: "Motion", timeline: "GSAP Timeline", gpu: "WebGL" } as const;
const intensityLabel = { subtle: "Subtle", standard: "Standard", cinematic: "Cinematic" } as const;

export default function CardFxStudio() {
  const [presetId, setPresetId] = useState<FxPresetId>("summon-default");
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preset = FORGED_FX_PRESETS[presetId];
  const particleBudget = preset.particleBudget ?? 0;
  const dots = useMemo(() => Array.from({ length: Math.min(18, Math.max(4, particleBudget)) }), [particleBudget]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function preview() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPlaying(false);
    requestAnimationFrame(() => {
      setPlaying(true);
      timerRef.current = setTimeout(() => setPlaying(false), Math.max(700, preset.durationMs + 260));
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]" data-card-fx-studio="true">
      <Panel title="FORGED FX Presets" eyebrow="PRESENTATION / ENGINE-SAFE">
        <div className="mb-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[.04] p-4 text-xs leading-5 text-cyan-100/80">
          Biblioteca visual somente-leitura nesta etapa. Os presets controlam apresentação; regras, stats e resolução do engine permanecem fora desta superfície.
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PRESET_IDS.map((id) => {
            const fx = FORGED_FX_PRESETS[id];
            const active = id === presetId;
            return (
              <button key={id} type="button" onClick={() => setPresetId(id)} className={`rounded-2xl border p-4 text-left transition ${active ? "border-cyan-300/40 bg-cyan-300/10 shadow-[0_0_30px_rgba(34,211,238,.08)]" : "border-white/10 bg-white/[.025] hover:border-white/20 hover:bg-white/[.04]"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-white">{id.replace("-default", "")}</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-black uppercase text-slate-400">{rendererLabel[fx.renderer]}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] font-bold uppercase text-slate-500">
                  <span>{intensityLabel[fx.intensity]}</span><span>·</span><span>{fx.durationMs}ms</span><span>·</span><span>{fx.particleBudget ?? 0} particles</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Metric label="Renderer" value={rendererLabel[preset.renderer]} />
          <Metric label="Intensity" value={intensityLabel[preset.intensity]} />
          <Metric label="Duration" value={`${preset.durationMs} ms`} />
          <Metric label="Particles" value={String(particleBudget)} />
          <Metric label="Screen shake" value={preset.screenShake ?? "off"} />
          <Metric label="Target flash" value={preset.targetFlashMs ? `${preset.targetFlashMs} ms` : "off"} />
          <Metric label="Sound cue" value={preset.soundCue ?? "none"} />
          <Metric label="Preset ID" value={preset.id} mono />
        </div>
      </Panel>

      <Panel title="Live Preview" eyebrow="MOTION · GSAP · WEBGL">
        <div className="relative min-h-[430px] overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,.12),transparent_32%),linear-gradient(160deg,#111827,#020617_70%)] p-6 shadow-2xl">
          <div className="absolute inset-x-5 top-5 flex items-center justify-between text-[9px] font-black uppercase tracking-[.18em] text-slate-500">
            <span>{rendererLabel[preset.renderer]}</span><span>{preset.intensity}</span>
          </div>
          <div className="absolute inset-0 grid place-items-center">
            <div className={`relative grid h-56 w-40 place-items-center rounded-[22px] border bg-gradient-to-br from-slate-800 to-slate-950 shadow-2xl transition-transform ${playing ? "scale-[1.035] border-cyan-200/70" : "border-white/15"}`} style={{ transitionDuration: `${Math.max(180, preset.durationMs)}ms` }}>
              <div className="absolute inset-3 rounded-[17px] border border-amber-300/15 bg-[radial-gradient(circle_at_50%_30%,rgba(245,158,11,.2),transparent_42%)]" />
              <div className="relative text-center"><div className="text-4xl">◇</div><div className="mt-2 text-[10px] font-black uppercase tracking-[.22em] text-slate-300">FX Target</div></div>
              {playing && <>
                <div className="absolute -inset-5 animate-ping rounded-[28px] border border-cyan-300/35" />
                {dots.map((_, i) => <i key={i} className="absolute h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_10px_currentColor]" style={{ transform: `rotate(${(360 / dots.length) * i}deg) translateY(-118px)`, opacity: .45 + (i % 4) * .12 }} />)}
              </>}
            </div>
          </div>
          <div className="absolute inset-x-5 bottom-5 grid gap-2">
            <button type="button" className="btn-primary w-full justify-center" onClick={preview}>▶ Preview {preset.id}</button>
            <div className="text-center text-[9px] leading-4 text-slate-500">Preview isolado · sem dispatch de evento · sem mutação de gameplay</div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Metric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[9px] font-black uppercase tracking-[.16em] text-slate-600">{label}</div><div className={`mt-1 truncate text-xs font-black text-slate-200 ${mono ? "font-mono" : ""}`}>{value}</div></div>;
}
