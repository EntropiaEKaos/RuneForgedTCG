"use client";

import { useEffect, useRef, useState } from "react";
import { Panel } from "./CardAuthoringFields";
import { FORGED_FX_PRESETS, type FxPreset, type FxPresetId } from "@/game/fx-registry";
import type { GameEvent } from "@/game/events";
import { buildFxExecutionPlan } from "@/game/fx-plan";
import { playFxDomAnimation } from "@/game/fx-dom-renderer";
import { playFxParticles, type FxParticleHandle } from "@/game/fx-particle-renderer";
import { playFxGpuOverlay, type FxGpuHandle } from "@/game/fx-gpu-renderer";
import { playFxTimeline, type FxTimelineHandle } from "@/game/fx-timeline-renderer";

const PRESET_IDS = Object.keys(FORGED_FX_PRESETS) as FxPresetId[];
const presetFor = (id: FxPresetId): FxPreset => FORGED_FX_PRESETS[id];
const rendererLabel = { motion: "Motion", timeline: "GSAP Timeline", gpu: "WebGL" } as const;
const intensityLabel = { subtle: "Subtle", standard: "Standard", cinematic: "Cinematic" } as const;

function previewEvent(id: FxPresetId): GameEvent {
  const base = { player: "player" as const, unitId: "studio-fx-preview" };
  switch (id) {
    case "summon-default": return { type: "UNIT_SUMMONED", ...base, defId: "studio-preview" };
    case "attack-default": return { type: "UNIT_ATTACK_STARTED", ...base };
    case "damage-default": return { type: "UNIT_DAMAGED", ...base, amount: 3 };
    case "heal-default": return { type: "UNIT_HEALED", ...base, amount: 3 };
    case "death-default": return { type: "UNIT_DIED", ...base, defId: "studio-preview" };
    case "levelup-default": return { type: "UNIT_LEVELLED_UP", ...base, fromDefId: "studio-preview", toDefId: "studio-preview-plus" };
    case "poison-default": return { type: "NEXUS_POISONED", player: "player", amount: 1, total: 3 };
    case "barrier-default": return { type: "STATUS_APPLIED", ...base, status: "barrier" };
    case "barrierbreak-default": return { type: "STATUS_REMOVED", ...base, status: "barrier" };
    case "frost-default": return { type: "STATUS_APPLIED", ...base, status: "frostbitten" };
    case "stun-default": return { type: "STATUS_APPLIED", ...base, status: "stunned" };
  }
}

export default function CardFxStudio() {
  const [presetId, setPresetId] = useState<FxPresetId>("summon-default");
  const [playing, setPlaying] = useState(false);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlesRef = useRef<Array<FxParticleHandle | FxGpuHandle | FxTimelineHandle>>([]);
  const animationRef = useRef<Animation | null>(null);
  const generationRef = useRef(0);
  const preset = presetFor(presetId);
  const particleBudget = preset.particleBudget ?? 0;

  function cleanup() {
    generationRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    animationRef.current?.cancel();
    animationRef.current = null;
    handlesRef.current.forEach((handle) => handle.cancel());
    handlesRef.current = [];
  }

  useEffect(() => cleanup, []);

  function selectPreset(id: FxPresetId) {
    cleanup();
    setPlaying(false);
    setPresetId(id);
  }

  function preview() {
    cleanup();
    const target = targetRef.current;
    if (!target) return;
    const generation = generationRef.current;
    const event = previewEvent(presetId);
    const plan = buildFxExecutionPlan({ preset, event }, { quality: "ultra", reducedMotion: false, constrained: false });
    setPlaying(true);

    if (plan.renderer === "motion") animationRef.current = playFxDomAnimation(target, plan);
    const particles = playFxParticles(target, event, plan, "ultra");
    if (particles) handlesRef.current.push(particles);
    if (plan.renderer === "gpu" || plan.intensity === "cinematic") {
      const gpu = playFxGpuOverlay(target, event, plan, "ultra");
      if (gpu) handlesRef.current.push(gpu);
    }
    if (plan.renderer === "timeline") {
      void playFxTimeline(target, event, plan).then((timeline) => {
        if (generation !== generationRef.current || !target.isConnected) timeline.cancel();
        else handlesRef.current.push(timeline);
      });
    }
    timerRef.current = setTimeout(() => setPlaying(false), Math.max(900, plan.durationMs + 360));
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]" data-card-fx-studio="true">
      <Panel title="FORGED FX Presets" eyebrow="PRESENTATION / ENGINE-SAFE">
        <div className="mb-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[.04] p-4 text-xs leading-5 text-cyan-100/80">Preview conectado aos mesmos renderers de produção. Nenhum evento é despachado ao jogo e nenhuma regra, stat ou estado autoritativo é alterado.</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PRESET_IDS.map((id) => { const fx = presetFor(id); const active = id === presetId; return (
            <button key={id} type="button" onClick={() => selectPreset(id)} className={`rounded-2xl border p-4 text-left transition ${active ? "border-cyan-300/40 bg-cyan-300/10 shadow-[0_0_30px_rgba(34,211,238,.08)]" : "border-white/10 bg-white/[.025] hover:border-white/20 hover:bg-white/[.04]"}`}>
              <div className="flex items-center justify-between gap-2"><span className="text-xs font-black text-white">{id.replace("-default", "")}</span><span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-black uppercase text-slate-400">{rendererLabel[fx.renderer]}</span></div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] font-bold uppercase text-slate-500"><span>{intensityLabel[fx.intensity]}</span><span>·</span><span>{fx.durationMs}ms</span><span>·</span><span>{fx.particleBudget ?? 0} particles</span></div>
            </button>); })}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Metric label="Renderer" value={rendererLabel[preset.renderer]} /><Metric label="Intensity" value={intensityLabel[preset.intensity]} /><Metric label="Duration" value={`${preset.durationMs} ms`} /><Metric label="Particles" value={String(particleBudget)} /><Metric label="Screen shake" value={preset.screenShake ?? "off"} /><Metric label="Target flash" value={preset.targetFlashMs ? `${preset.targetFlashMs} ms` : "off"} /><Metric label="Sound cue" value={preset.soundCue ?? "none"} /><Metric label="Preset ID" value={preset.id} mono />
        </div>
      </Panel>

      <Panel title="Production Renderer Preview" eyebrow="MOTION · GSAP · WEBGL">
        <div className="relative min-h-[430px] overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,.12),transparent_32%),linear-gradient(160deg,#111827,#020617_70%)] p-6 shadow-2xl">
          <div className="absolute inset-x-5 top-5 flex items-center justify-between text-[9px] font-black uppercase tracking-[.18em] text-slate-500"><span>{rendererLabel[preset.renderer]}</span><span className={playing ? "text-emerald-300" : ""}>{playing ? "● LIVE" : preset.intensity}</span></div>
          <div className="absolute inset-0 grid place-items-center"><div ref={targetRef} data-fx-studio-preview-target="true" className="relative grid h-56 w-40 place-items-center rounded-[22px] border border-white/15 bg-gradient-to-br from-slate-800 to-slate-950 shadow-2xl"><div className="absolute inset-3 rounded-[17px] border border-amber-300/15 bg-[radial-gradient(circle_at_50%_30%,rgba(245,158,11,.2),transparent_42%)]" /><div className="relative text-center"><div className="text-4xl">◇</div><div className="mt-2 text-[10px] font-black uppercase tracking-[.22em] text-slate-300">FX Target</div></div></div></div>
          <div className="absolute inset-x-5 bottom-5 grid gap-2"><button type="button" className="btn-primary w-full justify-center" onClick={preview}>▶ Run production FX</button><div className="text-center text-[9px] leading-4 text-slate-500">Ultra preview · renderers reais · sem dispatch · cleanup automático</div></div>
        </div>
      </Panel>
    </div>
  );
}

function Metric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[9px] font-black uppercase tracking-[.16em] text-slate-600">{label}</div><div className={`mt-1 truncate text-xs font-black text-slate-200 ${mono ? "font-mono" : ""}`}>{value}</div></div>; }
