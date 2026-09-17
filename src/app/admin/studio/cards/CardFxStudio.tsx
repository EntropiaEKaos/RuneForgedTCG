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
type EditablePreset = Omit<FxPreset, "screenShake"> & { screenShake?: "light" | "medium" };
const editablePresetFor = (id: FxPresetId): EditablePreset => {
  const preset = presetFor(id);
  const { screenShake, ...rest } = preset;
  return { ...rest, screenShake: screenShake === "light" || screenShake === "medium" ? screenShake : undefined };
};

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
  const [draft, setDraft] = useState<EditablePreset>(() => editablePresetFor("summon-default"));
  const [playing, setPlaying] = useState(false);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlesRef = useRef<Array<FxParticleHandle | FxGpuHandle | FxTimelineHandle>>([]);
  const animationRef = useRef<Animation | null>(null);
  const generationRef = useRef(0);

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
    setDraft(editablePresetFor(id));
  }

  function patchDraft(patch: Partial<EditablePreset>) {
    cleanup();
    setPlaying(false);
    setDraft((current) => ({ ...current, ...patch }));
  }

  function resetDraft() {
    cleanup();
    setPlaying(false);
    setDraft(editablePresetFor(presetId));
  }

  function preview() {
    cleanup();
    const target = targetRef.current;
    if (!target) return;
    const generation = generationRef.current;
    const event = previewEvent(presetId);
    const plan = buildFxExecutionPlan({ preset: draft, event }, { quality: "ultra", reducedMotion: false, constrained: false });
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
      <div className="grid gap-4">
        <Panel title="FORGED FX Presets" eyebrow="PRESENTATION / ENGINE-SAFE">
          <div className="mb-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[.04] p-4 text-xs leading-5 text-cyan-100/80">Edite um rascunho visual e rode os mesmos renderers de produção. Nada é despachado ao jogo; regras, stats e estado autoritativo permanecem intocados.</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PRESET_IDS.map((id) => { const fx = presetFor(id); const active = id === presetId; return (
              <button key={id} type="button" onClick={() => selectPreset(id)} className={`rounded-2xl border p-4 text-left transition ${active ? "border-cyan-300/40 bg-cyan-300/10 shadow-[0_0_30px_rgba(34,211,238,.08)]" : "border-white/10 bg-white/[.025] hover:border-white/20 hover:bg-white/[.04]"}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-black text-white">{id.replace("-default", "")}</span><span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-black uppercase text-slate-400">{rendererLabel[fx.renderer]}</span></div>
                <div className="mt-3 text-[9px] font-bold uppercase text-slate-500">{intensityLabel[fx.intensity]} · {fx.durationMs}ms · {fx.particleBudget ?? 0} particles</div>
              </button>); })}
          </div>
        </Panel>

        <Panel title="Live Draft Controls" eyebrow="FX STUDIO 1.3">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Renderer"><select value={draft.renderer} onChange={(e) => patchDraft({ renderer: e.target.value as FxPreset["renderer"] })} className="input w-full"><option value="motion">Motion</option><option value="timeline">GSAP Timeline</option><option value="gpu">WebGL</option></select></Field>
            <Field label="Intensity"><select value={draft.intensity} onChange={(e) => patchDraft({ intensity: e.target.value as FxPreset["intensity"] })} className="input w-full"><option value="subtle">Subtle</option><option value="standard">Standard</option><option value="cinematic">Cinematic</option></select></Field>
            <Field label={`Duration · ${draft.durationMs} ms`}><input type="range" min={80} max={5000} step={20} value={draft.durationMs} onChange={(e) => patchDraft({ durationMs: Number(e.target.value) })} className="w-full" /></Field>
            <Field label={`Particles · ${draft.particleBudget ?? 0}`}><input type="range" min={0} max={36} step={1} value={draft.particleBudget ?? 0} onChange={(e) => patchDraft({ particleBudget: Number(e.target.value) })} className="w-full" /></Field>
            <Field label="Screen shake"><select value={draft.screenShake ?? "off"} onChange={(e) => patchDraft({ screenShake: e.target.value === "off" ? undefined : e.target.value as "light" | "medium" })} className="input w-full"><option value="off">Off</option><option value="light">Light</option><option value="medium">Medium</option></select></Field>
            <Field label={`Target flash · ${draft.targetFlashMs ?? 0} ms`}><input type="range" min={0} max={2000} step={20} value={draft.targetFlashMs ?? 0} onChange={(e) => patchDraft({ targetFlashMs: Number(e.target.value) || undefined })} className="w-full" /></Field>
            <Field label="Sound cue"><input value={draft.soundCue ?? ""} maxLength={80} onChange={(e) => patchDraft({ soundCue: e.target.value || undefined })} placeholder="none" className="input w-full" /></Field>
          </div>
          <div className="mt-5 flex flex-wrap gap-2"><button type="button" className="btn-secondary" onClick={resetDraft}>Reset to registry</button><span className="self-center text-[10px] font-bold uppercase tracking-[.15em] text-amber-300/70">Draft local · não publicado</span></div>
        </Panel>
      </div>

      <Panel title="Production Renderer Preview" eyebrow="MOTION · GSAP · WEBGL">
        <div className="relative min-h-[520px] overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,.12),transparent_32%),linear-gradient(160deg,#111827,#020617_70%)] p-6 shadow-2xl">
          <div className="absolute inset-x-5 top-5 flex items-center justify-between text-[9px] font-black uppercase tracking-[.18em] text-slate-500"><span>{rendererLabel[draft.renderer]}</span><span className={playing ? "text-emerald-300" : ""}>{playing ? "● LIVE" : draft.intensity}</span></div>
          <div className="absolute inset-0 grid place-items-center"><div ref={targetRef} data-fx-studio-preview-target="true" data-fx-preset-id={presetId} data-fx-playing={playing ? "true" : "false"} className="relative grid h-56 w-40 place-items-center rounded-[22px] border border-white/15 bg-gradient-to-br from-slate-800 to-slate-950 shadow-2xl"><div className="absolute inset-3 rounded-[17px] border border-amber-300/15 bg-[radial-gradient(circle_at_50%_30%,rgba(245,158,11,.2),transparent_42%)]" /><div className="relative text-center"><div className="text-4xl">◇</div><div className="mt-2 text-[10px] font-black uppercase tracking-[.22em] text-slate-300">FX Target</div></div></div></div>
          <div className="absolute inset-x-5 bottom-5 grid gap-3"><div className="grid grid-cols-2 gap-2"><Metric label="Duration" value={`${draft.durationMs} ms`} /><Metric label="Particles" value={String(draft.particleBudget ?? 0)} /></div><button type="button" className="btn-primary w-full justify-center" onClick={preview}>▶ Run draft in production renderer</button><div className="text-center text-[9px] leading-4 text-slate-500">Ultra preview · rascunho local · renderers reais · cleanup automático</div></div>
        </div>
      </Panel>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="mb-2 block text-[9px] font-black uppercase tracking-[.16em] text-slate-500">{label}</span>{children}</label>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[9px] font-black uppercase tracking-[.16em] text-slate-600">{label}</div><div className="mt-1 truncate text-xs font-black text-slate-200">{value}</div></div>; }
