"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import SiteNav from "@/components/SiteNav";
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
  matchMode?: string | null;
  perspective?: string | null;
  eventLog?: GameEvent[];
}

type ReplayFilter = "all" | "combat" | "cards" | "status" | "nexus";
type VerificationStatus = "idle" | "loading" | "valid" | "invalid" | "unverifiable" | "error";

interface VerificationSnapshot {
  authoritative?: boolean;
  consistent?: boolean;
  hashesMatch?: boolean;
  rulesSnapshot?: boolean;
  winner?: "player" | "ai" | null;
  rounds?: number;
  appliedActions?: number;
  engineVersion?: string | null;
  rulesetVersion?: string | null;
  contentVersion?: string | null;
  historicalSnapshot?: boolean;
  matchMode?: string | null;
}

interface VerificationState {
  status: VerificationStatus;
  message: string;
  snapshot?: VerificationSnapshot;
}

type ReplayPayload = { ok?: boolean; replay?: Replay; error?: string };
type VerificationPayload = VerificationSnapshot & { ok?: boolean; error?: string };

const filterLabels: Record<ReplayFilter, string> = {
  all: "Todos",
  combat: "Combate",
  cards: "Cartas",
  status: "Estados",
  nexus: "Nexus",
};

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

function isReplay(value: unknown): value is Replay {
  if (!value || typeof value !== "object") return false;
  const replay = value as Partial<Replay>;
  return typeof replay.id === "number"
    && typeof replay.playerName === "string"
    && typeof replay.deckName === "string"
    && typeof replay.opponentName === "string"
    && typeof replay.won === "boolean"
    && typeof replay.rounds === "number"
    && typeof replay.playerFirst === "boolean"
    && Array.isArray(replay.log)
    && typeof replay.createdAt === "string";
}

function payloadError(value: unknown, fallback: string): string {
  if (value && typeof value === "object" && "error" in value && typeof (value as { error?: unknown }).error === "string") {
    return String((value as { error: string }).error);
  }
  return fallback;
}

function formatReplayDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data indisponível";
  return date.toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
}

export default function ReplayViewer({ id }: { id: string }) {
  const [replay, setReplay] = useState<Replay | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const [verification, setVerification] = useState<VerificationState>({ status: "idle", message: "Integridade ainda não verificada." });
  const [filter, setFilter] = useState<ReplayFilter>("all");
  const [shareFeedback, setShareFeedback] = useState("");

  const loadReplay = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError("");
    setPlaying(false);
    try {
      const response = await fetch(`/api/replays/${id}`, { cache: "no-store", signal });
      const payload = await response.json() as unknown;
      const data = payload as ReplayPayload;
      if (!response.ok || data.ok !== true || !isReplay(data.replay)) {
        setReplay(null);
        setLoadError(payloadError(payload, response.status === 404 ? "Replay não encontrado." : "Não foi possível carregar este replay."));
        return;
      }
      setReplay(data.replay);
      setCurrentStep(0);
      setFilter("all");
      setVerification({ status: "idle", message: "Integridade ainda não verificada." });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setReplay(null);
      setLoadError("Falha de rede ao carregar o replay. Verifique a conexão e tente novamente.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    void loadReplay(controller.signal);
    return () => controller.abort();
  }, [loadReplay]);

  useEffect(() => {
    if (!playing || !replay) return;
    const length = replay.eventLog?.length || replay.log.length;
    if (!length) return;
    const timer = window.setTimeout(() => {
      setCurrentStep((step) => {
        if (step + 1 >= length) {
          setPlaying(false);
          return step;
        }
        return step + 1;
      });
    }, speed);
    return () => window.clearTimeout(timer);
  }, [playing, currentStep, replay, speed]);

  const timeline = useMemo(() => {
    if (!replay) return [];
    if (replay.eventLog?.length) {
      return replay.eventLog.map((event, originalIndex) => ({ ...presentGameEvent(event), type: event.type, originalIndex }));
    }
    return replay.log.map((line, originalIndex) => ({ ...parseLegacyEvent(line), label: line, type: "LEGACY", originalIndex }));
  }, [replay]);

  const visibleTimeline = useMemo(
    () => filter === "all" ? timeline : timeline.filter((event) => eventFilter(event.type) === filter),
    [timeline, filter],
  );
  const keyMoments = useMemo(
    () => timeline.filter((event) => ["UNIT_DIED", "UNIT_LEVELLED_UP", "NEXUS_DAMAGED", "NEXUS_POISONED"].includes(event.type)).map((event) => event.originalIndex),
    [timeline],
  );
  const filterCounts = useMemo(() => {
    const counts: Record<ReplayFilter, number> = { all: timeline.length, combat: 0, cards: 0, status: 0, nexus: 0 };
    for (const event of timeline) {
      const category = eventFilter(event.type);
      if (category !== "all") counts[category] += 1;
    }
    return counts;
  }, [timeline]);

  const jumpMoment = (direction: -1 | 1) => {
    const candidates = direction > 0
      ? keyMoments.filter((step) => step > currentStep)
      : keyMoments.filter((step) => step < currentStep).reverse();
    if (candidates[0] !== undefined) {
      setPlaying(false);
      setCurrentStep(candidates[0]);
    }
  };

  const copyUrl = async () => {
    setShareFeedback("");
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/replay/${id}`);
      setShareFeedback("Link copiado.");
    } catch {
      setShareFeedback("Não foi possível copiar automaticamente.");
    }
  };

  const verifyReplay = async () => {
    if (verification.status === "loading") return;
    setVerification({ status: "loading", message: "Reexecutando o replay no servidor…" });
    try {
      const response = await fetch(`/api/replays/${id}/verify`, { cache: "no-store" });
      const payload = await response.json() as unknown;
      const data = payload as VerificationPayload;

      if (response.status === 409) {
        setVerification({
          status: "unverifiable",
          message: payloadError(payload, "Este replay não possui snapshot autoritativo suficiente para verificação determinística."),
        });
        return;
      }

      if (!response.ok || data.ok !== true) {
        setVerification({ status: "error", message: payloadError(payload, "A verificação não pôde ser concluída agora.") });
        return;
      }

      const snapshot: VerificationSnapshot = {
        authoritative: data.authoritative,
        consistent: data.consistent,
        hashesMatch: data.hashesMatch,
        rulesSnapshot: data.rulesSnapshot,
        winner: data.winner,
        rounds: data.rounds,
        appliedActions: data.appliedActions,
        engineVersion: data.engineVersion,
        rulesetVersion: data.rulesetVersion,
        contentVersion: data.contentVersion,
        historicalSnapshot: data.historicalSnapshot,
        matchMode: data.matchMode,
      };

      if (data.consistent === true) {
        setVerification({ status: "valid", message: "Reexecução autoritativa consistente com o resultado armazenado.", snapshot });
      } else {
        setVerification({ status: "invalid", message: "A reexecução autoritativa encontrou divergência no resultado, estado ou hashes armazenados.", snapshot });
      }
    } catch {
      setVerification({ status: "error", message: "Falha de rede durante a verificação. Nenhuma conclusão de integridade foi assumida." });
    }
  };

  if (loading) {
    return (
      <main className="rf-app-page">
        <SiteNav />
        <div className="rf-app-shell">
          <ReplayState title="Sincronizando replay" text="Carregando o registro público e preparando a linha do tempo." />
        </div>
      </main>
    );
  }

  if (loadError || !replay) {
    return (
      <main className="rf-app-page">
        <SiteNav />
        <div className="rf-app-shell">
          <ReplayState
            title="Replay indisponível"
            text={loadError || "O servidor não retornou um replay público válido."}
            action={<button type="button" className="rf-button rf-button-secondary" onClick={() => void loadReplay()}>TENTAR NOVAMENTE</button>}
          />
        </div>
      </main>
    );
  }

  const progress = timeline.length ? ((currentStep + 1) / timeline.length) * 100 : 0;
  const currentEvent = timeline[currentStep];
  const verificationTone = verification.status === "valid"
    ? "border-emerald-400/25 bg-emerald-400/[.07] text-emerald-100"
    : verification.status === "invalid"
      ? "border-red-400/25 bg-red-400/[.07] text-red-100"
      : verification.status === "unverifiable"
        ? "border-amber-400/25 bg-amber-400/[.07] text-amber-100"
        : verification.status === "error"
          ? "border-orange-400/25 bg-orange-400/[.07] text-orange-100"
          : "border-white/10 bg-slate-950/45 text-slate-200";

  return (
    <main className="rf-app-page">
      <SiteNav />
      <div className="rf-app-shell">
        <header className="rf-app-heading">
          <div>
            <p className="rf-eyebrow"><span /> ARQUIVO DE BATALHA</p>
            <h1>Replay #{replay.id}</h1>
            <p>Analise a partida evento por evento. A reprodução visual é pública; a conclusão de integridade só existe quando o servidor consegue reexecutar o registro autoritativo.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/leaderboard" className="rf-button rf-button-secondary">HALL DO NEXUS</Link>
            <button type="button" className="rf-button rf-button-secondary" onClick={() => void copyUrl()}>COPIAR LINK</button>
          </div>
        </header>

        {shareFeedback && <p className="mb-4 text-right text-xs text-slate-400" role="status">{shareFeedback}</p>}

        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Resumo do replay">
          <MetricCard label="Resultado" value={replay.won ? "Vitória" : "Derrota"} detail={`${replay.rounds} rodada${replay.rounds === 1 ? "" : "s"}`} tone={replay.won ? "good" : "bad"} />
          <MetricCard label="Invocador" value={replay.playerName} detail={replay.deckName} />
          <MetricCard label="Oponente" value={replay.opponentName} detail={replay.aiDifficulty ? `IA · ${replay.aiDifficulty}` : replay.matchMode || "partida registrada"} />
          <MetricCard label="Iniciativa" value={replay.playerFirst ? "Jogador" : "Oponente"} detail="primeiro turno" />
          <MetricCard label="Registro" value={`${timeline.length} eventos`} detail={formatReplayDate(replay.createdAt)} />
        </section>

        <section className={`mb-5 rounded-2xl border p-4 ${verificationTone}`} aria-labelledby="replay-verification-heading">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[.18em] opacity-65">Integridade autoritativa</p>
              <h2 id="replay-verification-heading" className="mt-1 text-lg font-black">
                {verification.status === "valid" ? "✓ Replay consistente"
                  : verification.status === "invalid" ? "⚠ Divergência detectada"
                    : verification.status === "unverifiable" ? "◌ Replay não verificável"
                      : verification.status === "error" ? "Verificação indisponível"
                        : verification.status === "loading" ? "Verificando no servidor…"
                          : "Verificação ainda não executada"}
              </h2>
              <p className="mt-1 text-sm leading-6 opacity-80">{verification.message}</p>
            </div>
            <button type="button" onClick={() => void verifyReplay()} disabled={verification.status === "loading"} className="rf-button rf-button-secondary disabled:cursor-not-allowed disabled:opacity-50">
              {verification.status === "loading" ? "VERIFICANDO…" : "VERIFICAR INTEGRIDADE"}
            </button>
          </div>
          {verification.snapshot && (
            <div className="mt-4 grid gap-2 border-t border-current/10 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <VerificationFact label="Hashes" value={verification.snapshot.hashesMatch ? "Coincidem" : "Divergem"} />
              <VerificationFact label="Regras" value={verification.snapshot.rulesSnapshot ? "Snapshot imutável" : "Compatibilidade legacy"} />
              <VerificationFact label="Ações aplicadas" value={String(verification.snapshot.appliedActions ?? "—")} />
              <VerificationFact label="Resultado refeito" value={`${verification.snapshot.winner ?? "—"} · ${verification.snapshot.rounds ?? "—"} rod.`} />
            </div>
          )}
        </section>

        <section className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45" aria-labelledby="replay-timeline-heading">
          <div className="border-b border-white/10 p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Direção do replay</p>
                <h2 id="replay-timeline-heading" className="mt-1 text-xl font-black text-white">Linha do tempo</h2>
                <p className="mt-1 text-xs text-slate-400">Evento {timeline.length ? currentStep + 1 : 0} de {timeline.length} · {keyMoments.length} momento(s)-chave</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rf-button rf-button-secondary !px-3 !py-2" onClick={() => jumpMoment(-1)} disabled={!keyMoments.some((step) => step < currentStep)}>← MOMENTO</button>
                <button type="button" className="rf-button rf-button-secondary !px-3 !py-2" onClick={() => jumpMoment(1)} disabled={!keyMoments.some((step) => step > currentStep)}>MOMENTO →</button>
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10" aria-label={`${Math.round(progress)}% do replay percorrido`}>
              <div className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-[width] duration-200" style={{ width: `${progress}%` }} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Filtros de evento">
              {(Object.keys(filterLabels) as ReplayFilter[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={filter === item}
                  onClick={() => setFilter(item)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition ${filter === item ? "border-amber-300/45 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/[.03] text-slate-400 hover:border-white/20 hover:text-white"}`}
                >
                  {filterLabels[item]} · {filterCounts[item]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 p-4 md:p-5 xl:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
            <div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">Evento em foco</p>
                {currentEvent ? (
                  <div className="mt-3 flex gap-3">
                    <span className="text-2xl" aria-hidden="true">{currentEvent.icon}</span>
                    <div><p className={`font-bold leading-6 ${currentEvent.color}`}>{currentEvent.label}</p><p className="mt-1 text-[10px] font-mono text-slate-600">#{String(currentStep + 1).padStart(3, "0")} · {currentEvent.type}</p></div>
                  </div>
                ) : <p className="mt-3 text-sm text-slate-500">Este replay não possui eventos reproduzíveis.</p>}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
                <PlaybackButton label="⏮ INÍCIO" disabled={currentStep === 0} onClick={() => { setPlaying(false); setCurrentStep(0); }} />
                <PlaybackButton label="◀ ANTERIOR" disabled={currentStep === 0} onClick={() => { setPlaying(false); setCurrentStep((step) => Math.max(0, step - 1)); }} />
                <button type="button" onClick={() => timeline.length && setPlaying((value) => !value)} disabled={!timeline.length} className="rf-button rf-button-primary flex-1 disabled:cursor-not-allowed disabled:opacity-40">{playing ? "PAUSAR" : "REPRODUZIR"}</button>
                <PlaybackButton label="PRÓXIMO ▶" disabled={!timeline.length || currentStep >= timeline.length - 1} onClick={() => { setPlaying(false); setCurrentStep((step) => Math.min(Math.max(0, timeline.length - 1), step + 1)); }} />
                <PlaybackButton label="FIM ⏭" disabled={!timeline.length || currentStep >= timeline.length - 1} onClick={() => { setPlaying(false); setCurrentStep(Math.max(0, timeline.length - 1)); }} />
                <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="input !w-auto !py-2" aria-label="Velocidade do replay">
                  <option value={2000}>0.5x</option>
                  <option value={1000}>1x</option>
                  <option value={500}>2x</option>
                  <option value={250}>4x</option>
                </select>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <VersionCard label="Engine" value={replay.engineVersion || "legacy"} />
                <VersionCard label="Ruleset" value={replay.rulesetVersion || "legacy"} />
                <VersionCard label="Content" value={replay.contentVersion || "legacy"} />
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3 px-1 pb-3">
                <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">Log navegável</p><h3 className="mt-1 font-black text-white">Histórico de eventos</h3></div>
                <span className="text-xs text-slate-500">{visibleTimeline.length} visível(is)</span>
              </div>
              <ol className="max-h-[470px] space-y-1 overflow-y-auto pr-1 text-sm">
                {visibleTimeline.map((event) => {
                  const eventIndex = event.originalIndex;
                  const isCurrent = eventIndex === currentStep;
                  const isPast = eventIndex < currentStep;
                  return (
                    <li key={eventIndex}>
                      <button
                        type="button"
                        onClick={() => { setPlaying(false); setCurrentStep(eventIndex); }}
                        aria-current={isCurrent ? "step" : undefined}
                        className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition ${isCurrent ? "border-amber-300/35 bg-amber-300/[.08]" : isPast ? "border-transparent bg-white/[.025] opacity-75 hover:border-white/10 hover:opacity-100" : "border-transparent opacity-45 hover:border-white/10 hover:bg-white/[.025] hover:opacity-80"}`}
                      >
                        <span className="w-8 shrink-0 font-mono text-[10px] text-slate-600">{String(eventIndex + 1).padStart(3, "0")}</span>
                        <span aria-hidden="true">{event.icon}</span>
                        <span className={`min-w-0 leading-5 ${event.color}`}>{event.label}</span>
                      </button>
                    </li>
                  );
                })}
                {!visibleTimeline.length && <li className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">Nenhum evento corresponde ao filtro atual.</li>}
              </ol>
            </div>
          </div>
        </section>

        {replay.eventLog?.length ? (
          <section className="rounded-2xl border border-violet-400/15 bg-violet-400/[.04] p-4" aria-labelledby="engine-events-heading">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-300/70">Telemetria estruturada</p><h3 id="engine-events-heading" className="mt-1 text-lg font-black text-violet-100">ENGINE EVENTS</h3></div><span className="text-xs text-violet-200/50">{replay.eventLog.length} evento(s)</span></div>
            <div className="mt-3 max-h-48 space-y-1 overflow-auto text-xs">{replay.eventLog.map((event, index) => <div key={index} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2"><b className="mr-2 text-violet-300">#{index + 1}</b>{presentGameEvent(event).label}</div>)}</div>
          </section>
        ) : (
          <section className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Compatibilidade histórica</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">Este registro usa o log textual legado. Ele continua reproduzível visualmente, mas a disponibilidade de verificação autoritativa depende dos snapshots preservados pelo servidor.</p>
          </section>
        )}
      </div>
    </main>
  );
}

function MetricCard({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "good" | "bad" | "neutral" }) {
  const valueClass = tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-red-300" : "text-slate-100";
  return <div className="rounded-xl border border-white/10 bg-slate-950/45 p-4"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">{label}</p><p className={`mt-1 truncate text-xl font-black ${valueClass}`} title={value}>{value}</p><p className="mt-1 truncate text-xs text-slate-400" title={detail}>{detail}</p></div>;
}

function VerificationFact({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[9px] font-black uppercase tracking-[.15em] opacity-55">{label}</p><p className="mt-1 text-xs font-bold">{value}</p></div>;
}

function VersionCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-white/[.025] p-2 text-center"><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-600">{label}</p><p className="mt-1 truncate text-[11px] font-bold text-slate-300" title={value}>{value}</p></div>;
}

function PlaybackButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="rounded-lg border border-white/10 bg-white/[.04] px-3 py-2 text-[10px] font-black text-slate-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30">{label}</button>;
}

function ReplayState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <section className="grid min-h-[55vh] place-items-center">
      <div className="max-w-xl rounded-2xl border border-white/10 bg-slate-950/45 p-6 text-center shadow-2xl shadow-black/20">
        <p className="rf-eyebrow justify-center"><span /> ARQUIVO DE BATALHA</p>
        <h1 className="mt-3 text-2xl font-black text-white">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </div>
    </section>
  );
}
