"use client";

import { useEffect, useRef, useState } from "react";
import { getBattlefieldPresentationDurationMs, layoutBattlefieldEntities, previewBattlefieldTarget, type BattlefieldLabScenario } from "../battlefield-lab-scenario";
import { buildDeterministicBattlefieldDemoSequence } from "./BattlefieldDemoSequence";
import { playBattlefieldPresentationEvent } from "./BattlefieldFxExecutor";
import { playNegateSpellFx } from "./BattlefieldNegateFx";
import { BattlefieldPresentationEventQueue } from "./BattlefieldPresentationEventQueue";
import { BattlefieldPresentationScheduler } from "./BattlefieldPresentationScheduler";
import { describeBattlefieldPresentationEvent, describeCombatPresentation, describeTargetingPresentation, type BattlefieldInteractionPresentation } from "./BattlefieldInteractionPresentation";
import { buildDeterministicReactionTimeline, type BattlefieldReactionPresentation } from "./BattlefieldStackPresentation";

type Props = { scenario: BattlefieldLabScenario };
const idlePresentation: BattlefieldInteractionPresentation = { phase: "idle", headline: "BATTLEFIELD", detail: "Awaiting authoritative event", accent: "slate" };
const accentClass: Record<BattlefieldInteractionPresentation["accent"], string> = { slate: "border-slate-500/30 bg-slate-950/80 text-slate-100", cyan: "border-cyan-400/40 bg-cyan-950/80 text-cyan-50", orange: "border-orange-400/40 bg-orange-950/80 text-orange-50", violet: "border-violet-400/40 bg-violet-950/80 text-violet-50", rose: "border-rose-400/40 bg-rose-950/80 text-rose-50" };

export default function PhaserBattlefieldMount({ scenario }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{ destroy: (removeCanvas: boolean, noReturn?: boolean) => void } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [metrics, setMetrics] = useState({ fps: 0, objects: 0, renderer: "pending" });
  const [interaction, setInteraction] = useState({ selected: "", target: "", relation: "" as "" | "friendly" | "opponent" });
  const [combat, setCombat] = useState({ attacker: "", blocker: "" });
  const [demo, setDemo] = useState({ beat: "idle", elapsedMs: 0, totalMs: 0 });
  const [presentation, setPresentation] = useState<BattlefieldInteractionPresentation>(idlePresentation);
  const [reaction, setReaction] = useState<BattlefieldReactionPresentation | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading"); setDemo({ beat: "idle", elapsedMs: 0, totalMs: 0 }); setPresentation(idlePresentation); setReaction(null);
    async function mount() {
      const host = hostRef.current; if (!host) return;
      gameRef.current?.destroy(true); gameRef.current = null; host.replaceChildren();
      try {
        const Phaser = await import("phaser"); if (cancelled || !hostRef.current) return;
        class BattlefieldLabScene extends Phaser.Scene {
          constructor() { super("battlefield-lab"); }
          create() {
            const width = this.scale.width; const height = this.scale.height;
            this.cameras.main.setBackgroundColor("#070b16");
            const cols = scenario.players.length === 4 ? 2 : 1; const rows = Math.ceil(scenario.players.length / cols); const zoneW = width / cols; const zoneH = height / rows;
            const entityLayout = layoutBattlefieldEntities(scenario, width, height); const demoSequence = buildDeterministicBattlefieldDemoSequence(scenario, "high"); const reactionTimeline = buildDeterministicReactionTimeline(scenario);
            setDemo({ beat: "ready", elapsedMs: 0, totalMs: demoSequence.totalDurationMs });
            let selectedUnit: { id: string; shape: Phaser.GameObjects.Rectangle } | null = null; let targetLine: Phaser.GameObjects.Line | null = null; let combatLine: Phaser.GameObjects.Line | null = null; let demoStarted = false; let reactionStarted = false;
            const presentationQueue = new BattlefieldPresentationEventQueue();
            const presentationScheduler = new BattlefieldPresentationScheduler(presentationQueue, async ({ event }) => { setPresentation(describeBattlefieldPresentationEvent(event, scenario)); playBattlefieldPresentationEvent(this, entityLayout, event, "high"); const presentationDuration = getBattlefieldPresentationDurationMs(event, "high"); if (presentationDuration > 0) await new Promise<void>((resolve) => this.time.delayedCall(presentationDuration, resolve)); });
            this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => presentationScheduler.clear());
            const runReactionDemo = () => {
              if (reactionStarted || reactionTimeline.length === 0) return; reactionStarted = true;
              const source = scenario.entities.find((entity) => entity.controllerId === scenario.players[1]?.id) ?? scenario.entities[0];
              const target = scenario.entities.find((entity) => entity.controllerId === scenario.players[0]?.id) ?? scenario.entities[1];
              reactionTimeline.forEach((frame, index) => this.time.delayedCall(index * 720, () => {
                setReaction(frame); setPresentation({ phase: "reaction", headline: frame.headline, detail: frame.detail, accent: frame.headline === "STACK RESOLVED" ? "violet" : "cyan", playerId: frame.priorityPlayerId });
                if (frame.headline === "STACK RESOLVED" && source && target) {
                  const sourcePoint = entityLayout[source.id]; const targetPoint = entityLayout[target.id];
                  if (sourcePoint && targetPoint) playNegateSpellFx(this, sourcePoint, targetPoint, "high");
                }
              }));
              this.time.delayedCall(reactionTimeline.length * 720 + 900, () => { setReaction(null); setPresentation(idlePresentation); reactionStarted = false; });
            };
            const runDeterministicDemo = () => { if (demoStarted) return; demoStarted = true; demoSequence.beats.forEach((beat) => { this.time.delayedCall(beat.startMs, () => setDemo({ beat: beat.id, elapsedMs: beat.startMs, totalMs: demoSequence.totalDurationMs })); presentationScheduler.enqueue(beat.event); }); this.time.delayedCall(demoSequence.totalDurationMs, () => { setDemo({ beat: "complete", elapsedMs: demoSequence.totalDurationMs, totalMs: demoSequence.totalDurationMs }); setPresentation(idlePresentation); demoStarted = false; }); };
            scenario.players.forEach((player, playerIndex) => {
              const col = playerIndex % cols; const row = Math.floor(playerIndex / cols); const x0 = col * zoneW; const y0 = row * zoneH;
              this.add.rectangle(x0 + zoneW / 2, y0 + zoneH / 2, zoneW - 10, zoneH - 10, 0x111827, 0.78).setStrokeStyle(1, 0x64748b, 0.45);
              this.add.text(x0 + 16, y0 + 14, `${player.label} · ${player.life}`, { fontFamily: "system-ui", fontSize: "13px", color: "#e2e8f0" });
              const entities = scenario.entities.filter((entity) => entity.controllerId === player.id); const cardW = Math.max(12, Math.min(34, zoneW / Math.max(8, Math.ceil(Math.sqrt(entities.length * 1.6))))); const cardH = cardW * 1.32;
              entities.forEach((entity) => {
                const point = entityLayout[entity.id]; if (!point) return; const fill = entity.kind === "token" ? 0x7c3aed : 0x0891b2;
                const unit = this.add.rectangle(point.x, point.y, cardW, cardH, fill, 0.68).setStrokeStyle(1, entity.tapped ? 0xf59e0b : 0xcbd5e1, 0.65).setInteractive({ useHandCursor: true }); unit.setAngle(point.angle);
                unit.on("pointerover", () => unit.setAlpha(1)); unit.on("pointerout", () => unit.setAlpha(selectedUnit?.id === entity.id ? 1 : 0.68));
                unit.on("pointerdown", () => {
                  if (!selectedUnit) { selectedUnit = { id: entity.id, shape: unit }; unit.setAlpha(1).setStrokeStyle(3, 0x22d3ee, 1); setInteraction({ selected: entity.id, target: "", relation: "" }); setPresentation({ phase: "targeting", headline: "SELECT TARGET", detail: entity.id, accent: "cyan", sourceId: entity.id }); return; }
                  if (selectedUnit.id === entity.id) { selectedUnit.shape.setAlpha(0.68).setStrokeStyle(1, entity.tapped ? 0xf59e0b : 0xcbd5e1, 0.65); selectedUnit = null; targetLine?.destroy(); targetLine = null; setInteraction({ selected: "", target: "", relation: "" }); setPresentation(idlePresentation); return; }
                  targetLine?.destroy(); const preview = previewBattlefieldTarget(scenario, selectedUnit.id, entity.id); if (!preview) return; const lineColor = preview.relation === "friendly" ? 0x22c55e : 0xf43f5e;
                  targetLine = this.add.line(0, 0, selectedUnit.shape.x, selectedUnit.shape.y, unit.x, unit.y, lineColor, 0.9).setOrigin(0, 0).setLineWidth(2).setDepth(18); unit.setStrokeStyle(3, lineColor, 1); setInteraction({ selected: selectedUnit.id, target: entity.id, relation: preview.relation }); setPresentation(describeTargetingPresentation(selectedUnit.id, entity.id, preview.relation));
                  if (preview.relation === "opponent") { combatLine?.destroy(); combatLine = this.add.line(0, 0, selectedUnit.shape.x, selectedUnit.shape.y, unit.x, unit.y, 0xf97316, 0.72).setOrigin(0, 0).setLineWidth(5).setDepth(17); selectedUnit.shape.setStrokeStyle(3, 0xf97316, 1); unit.setStrokeStyle(3, 0xfacc15, 1); setCombat({ attacker: selectedUnit.id, blocker: entity.id }); setPresentation(describeCombatPresentation(selectedUnit.id, entity.id)); }
                });
              });
            });
            this.add.text(width / 2, height / 2, "STACK", { fontFamily: "system-ui", fontSize: "10px", color: "#94a3b8", backgroundColor: "#020617aa", padding: { x: 8, y: 5 } }).setOrigin(0.5).setDepth(20);
            this.add.text(width - 18, height - 18, "DEMO", { fontFamily: "system-ui", fontSize: "12px", color: "#f8fafc", backgroundColor: "#7c2d12dd", padding: { x: 12, y: 7 } }).setOrigin(1, 1).setDepth(30).setInteractive({ useHandCursor: true }).on("pointerdown", runDeterministicDemo);
            this.add.text(width - 18, height - 58, "REACTION", { fontFamily: "system-ui", fontSize: "11px", color: "#ecfeff", backgroundColor: "#164e63dd", padding: { x: 12, y: 7 } }).setOrigin(1, 1).setDepth(30).setInteractive({ useHandCursor: true }).on("pointerdown", runReactionDemo);
            setMetrics((current) => ({ ...current, objects: this.children.length }));
          }
        }
        const game = new Phaser.Game({ type: Phaser.AUTO, parent: hostRef.current, width: Math.max(640, hostRef.current.clientWidth || 960), height: 560, backgroundColor: "#070b16", scene: BattlefieldLabScene, render: { antialias: true, pixelArt: false }, input: { activePointers: 2 } }); gameRef.current = game;
        const renderer = game.renderer?.type === Phaser.WEBGL ? "WebGL" : game.renderer?.type === Phaser.CANVAS ? "Canvas" : "Unknown"; setMetrics({ fps: 0, objects: scenario.entities.length, renderer });
        const metricsTimer = window.setInterval(() => { if (!cancelled && game.loop) setMetrics((current) => ({ ...current, fps: Math.round(game.loop.actualFps || 0) })); }, 1000); (game as Phaser.Game & { __labMetricsTimer?: number }).__labMetricsTimer = metricsTimer; setStatus("ready");
      } catch { if (!cancelled) setStatus("fallback"); }
    }
    void mount(); return () => { cancelled = true; const game = gameRef.current as (typeof gameRef.current & { __labMetricsTimer?: number }); if (game?.__labMetricsTimer) window.clearInterval(game.__labMetricsTimer); game?.destroy(true); gameRef.current = null; };
  }, [scenario]);

  return <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/30">
    <div className={`pointer-events-none absolute left-1/2 top-4 z-30 min-w-[260px] -translate-x-1/2 rounded-2xl border px-5 py-3 text-center shadow-2xl backdrop-blur ${accentClass[presentation.accent]}`}><div className="text-[9px] font-black tracking-[0.28em] opacity-70">{presentation.phase.toUpperCase()}</div><div className="mt-1 text-sm font-black tracking-[0.12em]">{presentation.headline}</div><div className="mt-1 text-[10px] font-mono opacity-80">{presentation.detail}</div></div>
    {reaction && <div className="pointer-events-none absolute right-4 top-24 z-30 w-56 rounded-2xl border border-cyan-400/20 bg-slate-950/90 p-3 shadow-2xl backdrop-blur"><div className="flex items-center justify-between text-[9px] font-black tracking-[0.2em] text-cyan-200"><span>STACK</span><span>{reaction.stack.length}</span></div><div className="mt-2 space-y-2">{[...reaction.stack].reverse().map((item, index) => <div key={item.id} className={`rounded-xl border px-3 py-2 ${item.status === "negated" ? "border-violet-400/50 bg-violet-950/60 opacity-70" : index === 0 ? "border-cyan-300/50 bg-cyan-950/60" : "border-white/10 bg-black/40"}`}><div className="flex items-center justify-between"><span className={`text-xs font-black ${item.status === "negated" ? "line-through text-violet-200" : "text-white"}`}>{item.label}</span><span className="text-[8px] uppercase tracking-widest text-slate-400">{item.status}</span></div><div className="mt-1 text-[9px] font-mono text-slate-400">{item.kind} · {item.controllerId}</div></div>)}</div><div className="mt-3 border-t border-white/10 pt-2 text-[9px] font-mono text-slate-400"><div className="text-cyan-200">priority: {reaction.priorityPlayerId}</div><div>passed: {reaction.passedPlayerIds.length ? reaction.passedPlayerIds.join(" → ") : "none"}</div></div></div>}
    <div className="absolute left-4 top-4 z-20 flex max-w-[38%] flex-wrap gap-2 text-[10px] font-mono text-slate-300"><span className="rounded bg-black/70 px-2 py-1">{metrics.renderer}</span><span className="rounded bg-black/70 px-2 py-1">{metrics.fps} FPS</span><span className="rounded bg-black/70 px-2 py-1">{metrics.objects} objects</span><span className="rounded bg-orange-950/80 px-2 py-1">demo: {demo.beat} · {demo.elapsedMs}/{demo.totalMs}ms</span></div>
    <div className="absolute bottom-4 left-4 z-20 flex max-w-[70%] flex-wrap gap-2 text-[10px] font-mono text-slate-300">{interaction.selected && <span className="rounded bg-cyan-950/80 px-2 py-1">selected: {interaction.selected}</span>}{interaction.target && <span className="rounded bg-rose-950/80 px-2 py-1">target: {interaction.target}</span>}{interaction.relation && <span className="rounded bg-slate-950/80 px-2 py-1">preview: {interaction.relation}</span>}{combat.attacker && <span className="rounded bg-orange-950/80 px-2 py-1">attacker: {combat.attacker}</span>}{combat.blocker && <span className="rounded bg-amber-950/80 px-2 py-1">blocker: {combat.blocker}</span>}</div>
    <div ref={hostRef} className="min-h-[560px] w-full" aria-label="Phaser Battlefield Lab canvas" />
    {status !== "ready" && <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center text-sm text-slate-400">{status === "loading" ? "Inicializando renderer experimental…" : "Phaser indisponível neste build. O Alpha e o renderer atual permanecem intactos."}</div>}
  </div>;
}
