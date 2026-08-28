"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { rankTierFor, type RankTier } from "@/lib/ranked";
import { ensurePlayerSession } from "@/lib/client-player-session";

interface RankedData {
  rankedEnabled: boolean;
  rankedConfigured: boolean;
  rankedReleaseCertified: boolean;
  rankedRulesVersion: string;
  rankedDeckPoolVersion: string;
  season: { id: number; name: string; startAt: string; endAt: string } | null;
  certifiedDecks: { id: string; name: string; emoji: string; cardCount: number; formatId: string }[];
  player: {
    id: number;
    name: string;
    mmr: number;
    peakMmr: number;
    rankedWins: number;
    rankedLosses: number;
    rankedGamesInPlacement: number;
    tier: RankTier;
    peakTier: RankTier;
    avatar: string;
    title: string;
  };
  history: {
    id: number;
    opponentName: string;
    won: boolean;
    mmrChange: number;
    mmrBefore: number;
    mmrAfter: number;
    createdAt: string;
  }[];
  leaderboard: {
    id: number;
    name: string;
    mmr: number;
    rankedWins: number;
    rankedLosses: number;
    avatar: string;
    title: string;
  }[];
  tiers: RankTier[];
}

type RankedPayload = Partial<RankedData> & { ok?: boolean; error?: string };
type MatchmakingPayload = {
  ok?: boolean;
  status?: string;
  error?: string;
  range?: number;
  opponent?: { name?: string; isHuman?: boolean; roomCode?: string };
};

function isRankedData(value: unknown): value is RankedData & { ok: true } {
  if (!value || typeof value !== "object") return false;
  const data = value as RankedPayload;
  return data.ok === true
    && typeof data.rankedEnabled === "boolean"
    && typeof data.rankedConfigured === "boolean"
    && typeof data.rankedReleaseCertified === "boolean"
    && typeof data.rankedRulesVersion === "string"
    && typeof data.rankedDeckPoolVersion === "string"
    && Boolean(data.player && typeof data.player.name === "string" && typeof data.player.mmr === "number")
    && Array.isArray(data.certifiedDecks)
    && Array.isArray(data.history)
    && Array.isArray(data.leaderboard)
    && Array.isArray(data.tiers);
}

function payloadError(value: unknown, fallback: string): string {
  if (value && typeof value === "object" && "error" in value && typeof (value as { error?: unknown }).error === "string") {
    return String((value as { error: string }).error);
  }
  return fallback;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data indisponível";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function availabilityReason(data: RankedData): string {
  if (!data.rankedConfigured) return "Ranked está desativado na configuração operacional.";
  if (!data.rankedReleaseCertified) return "A release atual ainda não está liberada pelo gate explícito de certificação Ranked.";
  if (!data.season) return "Nenhuma temporada ranqueada está aberta neste momento.";
  if (!data.rankedEnabled) return "O gate competitivo está bloqueando novas entradas na fila.";
  return "Fila ranqueada operacional e pronta para matchmaking humano.";
}

export default function RankedClient() {
  const router = useRouter();
  const [data, setData] = useState<RankedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState("");
  const [selectedDeck, setSelectedDeck] = useState("");
  const queueAbortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      await ensurePlayerSession(localStorage.getItem("runeforge_playername") || "");
      const response = await fetch("/api/ranked", { cache: "no-store" });
      const payload = await response.json() as unknown;
      if (!isRankedData(payload)) {
        setData(null);
        setLoadError(payloadError(payload, "Não foi possível carregar o lobby competitivo."));
        return;
      }
      setData(payload);
      if (payload.certifiedDecks.length) {
        setSelectedDeck((current) => payload.certifiedDecks.some((deck) => deck.id === current) ? current : payload.certifiedDecks[0].id);
      } else {
        setSelectedDeck("");
      }
    } catch {
      setData(null);
      setLoadError("Não foi possível sincronizar o lobby Ranked com o servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  const winRate = data && data.player.rankedWins + data.player.rankedLosses > 0
    ? Math.round((data.player.rankedWins / (data.player.rankedWins + data.player.rankedLosses)) * 100)
    : 0;

  const searchMatch = async () => {
    if (!data?.rankedEnabled || !selectedDeck || searching) return;
    queueAbortRef.current?.abort();
    const controller = new AbortController();
    queueAbortRef.current = controller;
    setSearching(true);
    setSearchMsg("Entrando na fila ranqueada...");
    try {
      const startedAt = Date.now();
      const deckId = selectedDeck;
      const trySearch = async () => {
        const waitSeconds = Math.floor((Date.now() - startedAt) / 1000);
        const response = await fetch("/api/matchmaking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            deckId,
            mode: "ranked",
            waitSeconds,
          }),
        });
        const body = await response.json().catch(() => ({})) as MatchmakingPayload;
        return { ...body, httpStatus: response.status };
      };

      let attempt = 0;
      while (!controller.signal.aborted) {
        const result = await trySearch();
        if (!result.ok) {
          if (result.httpStatus >= 500 || result.httpStatus === 429) {
            setSearchMsg("⚠️ Serviço temporariamente indisponível. Tentando novamente…");
          } else {
            setSearchMsg(`❌ ${result.error || "Matchmaking recusado"}`);
            break;
          }
        }
        if (result.status === "matched" && result.opponent?.isHuman && result.opponent.roomCode) {
          setSearchMsg(`🎮 Oponente humano encontrado: ${result.opponent.name || "adversário"}! Redirecionando...`);
          router.push(`/play?pvpRoom=${encodeURIComponent(result.opponent.roomCode)}`);
          return;
        }
        if (result.status === "queued") {
          attempt += 1;
          setSearchMsg(`⌛ Na fila · faixa ±${result.range ?? "?"} MMR · ${Math.floor((Date.now() - startedAt) / 1000)}s · consulta ${attempt}`);
        }
        await new Promise<void>((resolve) => {
          const id = window.setTimeout(resolve, 1800);
          controller.signal.addEventListener("abort", () => { window.clearTimeout(id); resolve(); }, { once: true });
        });
      }
    } catch (error) {
      if (!controller.signal.aborted) setSearchMsg(error instanceof Error && error.name === "AbortError" ? "Fila cancelada." : "❌ Erro no matchmaking");
    } finally {
      if (queueAbortRef.current === controller) queueAbortRef.current = null;
      setSearching(false);
    }
  };

  const cancelSearch = useCallback(async () => {
    queueAbortRef.current?.abort();
    queueAbortRef.current = null;
    await fetch("/api/matchmaking", { method: "DELETE" }).catch(() => null);
    setSearching(false);
    setSearchMsg("Fila cancelada com segurança.");
  }, []);

  useEffect(() => {
    return () => {
      queueAbortRef.current?.abort();
      fetch("/api/matchmaking", { method: "DELETE", keepalive: true }).catch(() => null);
    };
  }, []);

  return (
    <main className="rf-app-page">
      <SiteNav />
      <div className="rf-app-shell">
        <header className="rf-app-heading">
          <div>
            <p className="rf-eyebrow"><span /> CIRCUITO COMPETITIVO</p>
            <h1>Ranked do Nexus</h1>
            <p>Fila humana, pool certificado e MMR liquidados pela infraestrutura PvP autoritativa. O cliente apenas acompanha a busca.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/leaderboard" className="rf-button rf-button-secondary">HALL DO NEXUS</Link>
            <Link href="/play" className="rf-button rf-button-secondary">PVP CASUAL</Link>
          </div>
        </header>

        {loading ? (
          <EmptyState title="Sincronizando circuito competitivo" text="Carregando temporada, certificação, pool de decks, MMR e histórico." />
        ) : loadError || !data ? (
          <EmptyState title="Lobby Ranked indisponível" text={loadError || "O servidor não retornou um snapshot competitivo válido."} action={<button type="button" className="rf-button rf-button-secondary" onClick={() => void load()}>TENTAR NOVAMENTE</button>} />
        ) : (
          <>
            <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Estado do competitivo">
              <StatusCard label="Operação" value={data.rankedEnabled ? "Aberto" : "Bloqueado"} detail={data.rankedEnabled ? "matchmaking disponível" : "fail-closed"} tone={data.rankedEnabled ? "good" : "bad"} />
              <StatusCard label="Release" value={data.rankedReleaseCertified ? "Certificada" : "Pendente"} detail={data.rankedRulesVersion} tone={data.rankedReleaseCertified ? "good" : "warn"} />
              <StatusCard label="Temporada" value={data.season?.name || "Fechada"} detail={data.season ? `${formatDate(data.season.startAt)} → ${formatDate(data.season.endAt)}` : "sem season aberta"} tone={data.season ? "good" : "warn"} />
              <StatusCard label="Pool" value={`${data.certifiedDecks.length} decks`} detail={data.rankedDeckPoolVersion} tone={data.certifiedDecks.length ? "neutral" : "bad"} />
              <StatusCard label="Invocador" value={data.player.name} detail={`${data.player.avatar || "🎮"} ${data.player.title || "Competidor"}`} tone="neutral" />
            </section>

            {!data.rankedEnabled && (
              <div className="mb-5 rounded-2xl border border-red-400/25 bg-red-400/[.07] px-4 py-3" role="status">
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-red-300">Gate competitivo fechado</p>
                <p className="mt-1 text-sm leading-6 text-red-100">🔒 {availabilityReason(data)} PvP casual continua separado deste gate.</p>
              </div>
            )}

            <section className={`mb-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${data.player.tier.gradient}${searching ? " ranked-queue-beacon" : ""}`} aria-labelledby="rank-card-heading">
              <div className="bg-slate-950/25 p-5 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-5">
                  <div className="flex items-center gap-4">
                    <div className="text-6xl" aria-hidden="true">{data.player.tier.icon}</div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[.18em] text-white/60">Classificação atual</p>
                      <h2 id="rank-card-heading" className="mt-1 text-3xl font-black text-white">{data.player.tier.name}</h2>
                      <p className="mt-1 text-sm font-bold text-white/85">{data.player.mmr} MMR</p>
                      <p className="mt-1 text-xs text-white/65">Pico: {data.player.peakMmr} · {data.player.peakTier.icon} {data.player.peakTier.name}</p>
                      {data.player.rankedGamesInPlacement > 0 && <span className="mt-2 inline-block rounded-full border border-amber-200/20 bg-amber-200/15 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-amber-50">Placement · {data.player.rankedGamesInPlacement} restantes</span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <RankMetric label="Vitórias" value={data.player.rankedWins} tone="text-emerald-200" />
                    <RankMetric label="Derrotas" value={data.player.rankedLosses} tone="text-red-200" />
                    <RankMetric label="Win rate" value={`${winRate}%`} tone="text-white" />
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)]">
                  <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/55">Pool certificado</p><h3 className="mt-1 text-lg font-black text-white">Escolha o deck ranqueado</h3></div>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-white/70">{data.rankedDeckPoolVersion}</span>
                    </div>
                    <select className="input mt-3 w-full" value={selectedDeck} onChange={(event) => setSelectedDeck(event.target.value)} disabled={searching || !data.rankedEnabled} aria-label="Deck ranqueado certificado">
                      {data.certifiedDecks.map((deck) => <option key={deck.id} value={deck.id}>{deck.emoji} {deck.name} · {deck.cardCount} cartas</option>)}
                    </select>
                    <p className="mt-2 text-xs leading-5 text-white/55">Somente os decks pré-construídos devolvidos pelo snapshot Ranked entram nesta fila. Decks customizados permanecem no PvP casual.</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/55">Matchmaking humano</p>
                    <button type="button" onClick={() => void searchMatch()} disabled={searching || !data.rankedEnabled || !selectedDeck} className="rf-button rf-button-primary mt-3 w-full disabled:cursor-not-allowed disabled:opacity-40">{searching ? "PROCURANDO OPONENTE…" : "BUSCAR PARTIDA RANQUEADA"}</button>
                    {searching && <button type="button" onClick={() => void cancelSearch()} className="rf-button rf-button-secondary mt-2 w-full">CANCELAR FILA</button>}
                    {searchMsg && <p className="mt-3 text-xs leading-5 text-amber-100" role="status" aria-live="polite">{searchMsg}</p>}
                    {!searching && !searchMsg && <p className="mt-3 text-xs leading-5 text-white/50">A fila amplia a faixa MMR conforme o tempo de espera definido pela política server-side.</p>}
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-white/10 bg-slate-950/45 p-4" aria-labelledby="ranked-history-heading">
                <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Performance recente</p><h3 id="ranked-history-heading" className="mt-1 text-lg font-black text-white">Últimas partidas</h3></div><span className="text-xs text-slate-500">{data.history.length} registro(s)</span></div>
                <div className="mt-4 space-y-2">
                  {data.history.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">Nenhuma partida ranqueada registrada nesta visão.</p>
                  ) : data.history.map((match) => (
                    <article key={match.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${match.won ? "border-emerald-400/15 bg-emerald-400/[.04]" : "border-red-400/15 bg-red-400/[.04]"}`}>
                      <div className="flex min-w-0 items-center gap-3"><span className="text-xl">{match.won ? "🏆" : "◆"}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-white">vs {match.opponentName}</p><p className="text-[10px] text-slate-500">{new Date(match.createdAt).toLocaleString("pt-BR", { timeStyle: "short", dateStyle: "short" })}</p></div></div>
                      <div className="text-right"><p className={`text-sm font-black ${match.mmrChange > 0 ? "text-emerald-300" : match.mmrChange < 0 ? "text-red-300" : "text-slate-300"}`}>{match.mmrChange > 0 ? "+" : ""}{match.mmrChange} MMR</p><p className="text-[10px] text-slate-500">{match.mmrBefore} → {match.mmrAfter}</p></div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-slate-950/45 p-4" aria-labelledby="ranked-leaderboard-heading">
                <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Classificação pública</p><h3 id="ranked-leaderboard-heading" className="mt-1 text-lg font-black text-white">Ranking global</h3></div><span className="text-xs text-slate-500">Top {data.leaderboard.length}</span></div>
                <div className="mt-4 space-y-2">
                  {data.leaderboard.map((player, index) => {
                    const tier = rankTierFor(data.tiers, player.mmr);
                    const isCurrent = player.id === data.player.id;
                    return (
                      <article key={player.id} className={`flex items-center gap-3 rounded-xl border p-3 ${isCurrent ? "border-amber-300/35 bg-amber-300/[.07]" : "border-white/10 bg-white/[.02]"}`}>
                        <span className="w-9 text-center text-lg font-black text-slate-400">{index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}</span>
                        <span className="text-xl">{player.avatar || "🎮"}</span>
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{player.name}{isCurrent ? " · você" : ""}</p><p className="truncate text-[10px] text-slate-500">{player.title}</p></div>
                        <div className="text-right"><p className={`text-sm font-black ${tier.color}`}>{tier.icon} {player.mmr}</p><p className="text-[10px] text-slate-500">{player.rankedWins}W · {player.rankedLosses}L</p></div>
                      </article>
                    );
                  })}
                  {data.leaderboard.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Leaderboard ainda sem participantes.</p>}
                </div>
              </section>
            </div>

            <section className="mt-6 rounded-2xl border border-white/10 bg-slate-950/45 p-4" aria-labelledby="rank-tiers-heading">
              <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Progressão competitiva</p><h3 id="rank-tiers-heading" className="mt-1 text-lg font-black text-white">Todas as ligas</h3></div>
              <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
                {data.tiers.map((tier) => (
                  <div key={tier.name} className={`rounded-xl border bg-gradient-to-br ${tier.gradient} p-3 text-center ${tier.name === data.player.tier.name ? "border-white/70 ring-1 ring-white/50" : "border-white/10 opacity-70"}`}>
                    <div className="text-3xl">{tier.icon}</div><p className="mt-1 font-black text-white">{tier.name}</p><p className="text-xs text-white/70">{tier.minMmr}+</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function StatusCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  const toneClass = tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : tone === "bad" ? "text-red-300" : "text-slate-100";
  return <div className="rounded-xl border border-white/10 bg-slate-950/45 p-4"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">{label}</p><p className={`mt-1 truncate text-xl font-black ${toneClass}`} title={value}>{value}</p><p className="mt-1 truncate text-xs text-slate-400" title={detail}>{detail}</p></div>;
}

function RankMetric({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return <div className="rounded-xl border border-white/10 bg-slate-950/25 px-3 py-2"><p className="text-[9px] font-black uppercase tracking-wider text-white/55">{label}</p><p className={`mt-1 text-xl font-black ${tone}`}>{value}</p></div>;
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-6 py-16 text-center"><div className="text-4xl">◇</div><h2 className="mt-3 text-xl font-black text-white">{title}</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">{text}</p>{action && <div className="mt-5 flex justify-center">{action}</div>}</div>;
}
