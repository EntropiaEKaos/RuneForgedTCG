"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { GameEvent } from "@/game/events";
import { presentGameEvent } from "@/game/event-presentation";

interface Replay {
  id: number;
  playerName: string;
  deckName: string;
  opponentName: string;
  won: boolean;
  rounds: number;
  playerFirst: boolean;
  log: string[];
  createdAt: string;
  engineVersion?: string;
  rulesetVersion?: string;
  contentVersion?: string;
  aiDifficulty?: "apprentice" | "tactician" | "overlord";
  eventLog?: GameEvent[];
}

type ReplayFilter = "all" | "combat" | "cards" | "status" | "nexus";
function eventFilter(type: string): ReplayFilter {
  if (["UNIT_DAMAGED", "UNIT_DIED", "UNIT_ATTACK_STARTED"].includes(type)) return "combat";
  if (["UNIT_SUMMONED", "UNIT_LEVELLED_UP"].includes(type)) return "cards";
  if (["STATUS_APPLIED", "STATUS_REMOVED"].includes(type)) return "status";
  if (type.startsWith("NEXUS_")) return "nexus";
  return "all";
}

function parseLegacyEvent(line: string) {
  if (line.includes("summons")) return { icon: "⚔️", color: "text-emerald-300" };
  if (line.includes("casts")) return { icon: "✨", color: "text-purple-300" };
  if (line.includes("strikes")) return { icon: "💥", color: "text-red-300" };
  if (line.includes("Nexus") || line.includes("nexus")) return { icon: "💠", color: "text-cyan-300" };
  if (line.includes("Round")) return { icon: "🔄", color: "text-amber-300" };
  if (line.includes("blocked") || line.includes("blocks")) return { icon: "🛡️", color: "text-blue-300" };
  if (line.includes("destroys") || line.includes("destroyed") || line.includes("dies") || line.includes("slain")) return { icon: "💀", color: "text-slate-400" };
  if (line.includes("Level Up") || line.includes("LEVEL UP") || line.includes("levels up")) return { icon: "⭐", color: "text-yellow-300" };
  if (line.includes("declares")) return { icon: "⚔️", color: "text-orange-300" };
  if (line.includes("passes") || line.includes("turn")) return { icon: "🔁", color: "text-slate-400" };
  return { icon: "•", color: "text-slate-300" };
}

export default function ReplayViewer({ id }: { id: string }) {
  const [replay, setReplay] = useState<Replay | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const [error, setError] = useState("");
  const [verification, setVerification] = useState<"idle" | "loading" | "valid" | "invalid">("idle");
  const [filter, setFilter] = useState<ReplayFilter>("all");

  useEffect(() => {
    fetch(`/api/replays/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setReplay(d.replay);
          setCurrentStep(0);
        } else {
          setError(d.error || "Replay not found");
        }
      });
  }, [id]);

  useEffect(() => {
    if (!playing || !replay) return;
    const length = replay.eventLog?.length || replay.log.length;
    if (!length) return;
    const timer = setTimeout(() => {
      setCurrentStep((s) => {
        if (s + 1 >= length) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, speed);
    return () => clearTimeout(timer);
  }, [playing, currentStep, replay, speed]);

  const timeline = useMemo(() => {
    if (!replay) return [];
    if (replay.eventLog?.length) return replay.eventLog.map((event, originalIndex) => ({ ...presentGameEvent(event), type: event.type, originalIndex }));
    return replay.log.map((line, originalIndex) => ({ ...parseLegacyEvent(line), label: line, type: "LEGACY", originalIndex }));
  }, [replay]);
  const visibleTimeline = useMemo(() => filter === "all" ? timeline : timeline.filter((event) => eventFilter(event.type) === filter), [timeline, filter]);
  const keyMoments = useMemo(() => timeline.filter((event) => ["UNIT_DIED", "UNIT_LEVELLED_UP", "NEXUS_DAMAGED", "NEXUS_POISONED"].includes(event.type)).map((event) => event.originalIndex), [timeline]);
  const jumpMoment = (direction: -1 | 1) => {
    const candidates = direction > 0 ? keyMoments.filter((step) => step > currentStep) : keyMoments.filter((step) => step < currentStep).reverse();
    if (candidates[0] !== undefined) setCurrentStep(candidates[0]);
  };

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/replay/${id}` : "";

  const copyUrl = () => {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
  };

  const verifyReplay = async () => {
    setVerification("loading");
    try {
      const r = await fetch(`/api/replays/${id}/verify`, { cache: "no-store" });
      const d = await r.json();
      setVerification(d.ok && d.consistent ? "valid" : "invalid");
    } catch { setVerification("invalid"); }
  };

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-100">
        <div className="text-center">
          <p className="text-xl text-red-400">❌ {error}</p>
          <Link href="/leaderboard" className="btn-primary mt-4 inline-block">
            Ver Replays
          </Link>
        </div>
      </main>
    );
  }

  if (!replay) return <div className="grid min-h-screen place-items-center bg-slate-950 text-slate-100">Carregando…</div>;

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#1e293b,#0f172a_55%,#020617)] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link href="/leaderboard" className="text-sm text-slate-400 hover:text-white">← Voltar</Link>
          <div className="flex gap-2">
            <button onClick={verifyReplay} className="btn-ghost !px-3 !py-1 text-xs">
              {verification === "loading" ? "Verificando…" : verification === "valid" ? "✓ Replay íntegro" : verification === "invalid" ? "⚠ Replay inválido" : "🔐 Verificar integridade"}
            </button>
            <button onClick={copyUrl} className="btn-ghost !px-3 !py-1 text-xs">📋 Copiar Link</button>
          </div>
        </div>

        <div className={`mb-4 rounded-2xl border-2 p-4 ${replay.won ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black">
                {replay.won ? "🏆" : "💀"} Replay #{replay.id}
              </h1>
              <p className="text-sm text-slate-300">
                {replay.playerName} · {replay.deckName} vs {replay.opponentName}
              </p>
              <p className="text-xs text-slate-500">
                {replay.rounds} rounds · {replay.playerFirst ? "Player primeiro" : "Oponente primeiro"} · IA {replay.aiDifficulty ?? "n/a"}
              </p>
              <p className="mt-1 text-[11px] text-slate-600">Engine {replay.engineVersion ?? "legacy"} · Ruleset {replay.rulesetVersion ?? "legacy"} · Content {replay.contentVersion ?? "legacy"}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Evento</p>
              <p className="text-2xl font-black">
                {timeline.length ? currentStep + 1 : 0} / {timeline.length}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all"
              style={{ width: `${timeline.length ? ((currentStep + 1) / timeline.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="replay-director" aria-label="Direção do replay">
          <div><small>FILTRO DE EVENTOS</small>{(["all", "combat", "cards", "status", "nexus"] as ReplayFilter[]).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "Todos" : item === "combat" ? "Combate" : item === "cards" ? "Cartas" : item === "status" ? "Estados" : "Nexus"}</button>)}</div>
          <div><small>MOMENTOS-CHAVE · {keyMoments.length}</small><button onClick={() => jumpMoment(-1)}>← Anterior</button><button onClick={() => jumpMoment(1)}>Próximo →</button></div>
        </div>

        {/* Controls */}
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
          <button
            onClick={() => setCurrentStep(0)}
            disabled={currentStep === 0}
            className="rounded bg-slate-700 px-3 py-1 text-sm font-bold hover:bg-slate-600 disabled:opacity-30"
          >
            ⏮️ Início
          </button>
          <button
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="rounded bg-slate-700 px-3 py-1 text-sm font-bold hover:bg-slate-600 disabled:opacity-30"
          >
            ◀ Anterior
          </button>
          <button
            onClick={() => timeline.length && setPlaying(!playing)}
            disabled={!timeline.length}
            className={`rounded px-6 py-1.5 text-sm font-black ${playing ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"}`}
          >
            {playing ? "⏸️ Pausar" : "▶️ Reproduzir"}
          </button>
          <button
            onClick={() => setCurrentStep((s) => Math.min(timeline.length - 1, s + 1))}
            disabled={!timeline.length || currentStep >= timeline.length - 1}
            className="rounded bg-slate-700 px-3 py-1 text-sm font-bold hover:bg-slate-600 disabled:opacity-30"
          >
            Próximo ▶
          </button>
          <button
            onClick={() => setCurrentStep(Math.max(0, timeline.length - 1))}
            disabled={!timeline.length || currentStep >= timeline.length - 1}
            className="rounded bg-slate-700 px-3 py-1 text-sm font-bold hover:bg-slate-600 disabled:opacity-30"
          >
            Fim ⏭️
          </button>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="input max-w-[100px] !py-1"
          >
            <option value={2000}>0.5x</option>
            <option value={1000}>1x</option>
            <option value={500}>2x</option>
            <option value={250}>4x</option>
          </select>
        </div>

        {/* Current Event Highlight */}
        {timeline[currentStep] && (
          <div className="mb-4 rounded-xl border-2 border-amber-400/40 bg-amber-500/10 p-4 text-center">
            <p className="text-lg font-bold">
              <span className="mr-2">{timeline[currentStep].icon}</span>
              {timeline[currentStep].label}
            </p>
          </div>
        )}

        {replay.eventLog?.length ? (
          <section className="mb-4 rounded-xl border border-violet-400/15 bg-violet-400/[.04] p-4">
            <h3 className="text-xs font-black tracking-[.2em] text-violet-300">ENGINE EVENTS</h3>
            <div className="mt-3 max-h-44 space-y-1 overflow-auto text-xs">{replay.eventLog.map((event, i) => <div key={i} className="rounded bg-black/20 px-2 py-1"><b>#{i + 1}</b> · {presentGameEvent(event).label}</div>)}</div>
          </section>
        ) : null}

        {/* Full Log */}
        <div className="rounded-xl border border-white/10 bg-black/40 p-4">
          <h3 className="mb-2 text-sm font-bold text-slate-400">Histórico Completo</h3>
          <ul className="max-h-[400px] space-y-1 overflow-y-auto text-sm">
            {visibleTimeline.map((event) => {
              const i = event.originalIndex;
              const isCurrent = i === currentStep;
              const isPast = i < currentStep;
              return (
                <li
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  className={`cursor-pointer rounded px-2 py-1 transition-all ${
                    isCurrent
                      ? "bg-amber-500/20 ring-1 ring-amber-400 font-bold"
                      : isPast
                        ? "opacity-70 hover:bg-white/5"
                        : "opacity-40 hover:opacity-70 hover:bg-white/5"
                  }`}
                >
                  <span className="mr-2 font-mono text-xs text-slate-600">{String(i + 1).padStart(3, "0")}</span>
                  <span className="mr-2">{event.icon}</span>
                  <span className={event.color}>{event.label}</span>
                </li>
              );
            })}
            {!timeline.length && <li className="rounded-lg border border-white/10 p-6 text-center text-slate-500">Este replay não possui eventos reproduzíveis.</li>}
          </ul>
        </div>
      </div>
    </main>
  );
}
