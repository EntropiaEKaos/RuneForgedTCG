"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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


export default function RankedClient() {
  const [playerName, setPlayerName] = useState("");
  const [data, setData] = useState<RankedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState("");
  const [selectedDeck, setSelectedDeck] = useState("");
  const queueAbortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (name: string) => {
    setLoading(true);
    try {
      const profile = await ensurePlayerSession(name);
      if (profile?.ok && profile.player?.name) setPlayerName(profile.player.name);
      const res = await fetch("/api/ranked", { cache: "no-store" });
      const d = await res.json();
      if (d.ok) {
        setData(d);
        setPlayerName(d.player.name);
        if (Array.isArray(d.certifiedDecks) && d.certifiedDecks.length) {
          setSelectedDeck((current) => d.certifiedDecks.some((deck: { id: string }) => deck.id === current) ? current : d.certifiedDecks[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    const saved = localStorage.getItem("runeforge_playername") || "";
    setPlayerName(saved);
    load(saved);
  }, [load]);

  const winRate = data && data.player.rankedWins + data.player.rankedLosses > 0
    ? Math.round((data.player.rankedWins / (data.player.rankedWins + data.player.rankedLosses)) * 100)
    : 0;

  const searchMatch = async () => {
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
        const res = await fetch("/api/matchmaking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            deckId,
            mode: "ranked",
            waitSeconds,
          }),
        });
        const body = await res.json().catch(() => ({}));
        return { ...body, httpStatus: res.status };
      };

      let attempt = 0;
      while (!controller.signal.aborted) {
        const d = await trySearch();
        if (!d.ok) {
          if (d.httpStatus >= 500 || d.httpStatus === 429) {
            setSearchMsg("⚠️ Serviço temporariamente indisponível. Tentando novamente…");
          } else {
            setSearchMsg(`❌ ${d.error || "Matchmaking recusado"}`);
            break;
          }
        }
        if (d.status === "matched" && d.opponent?.isHuman) {
          setSearchMsg(`🎮 Oponente humano encontrado: ${d.opponent.name}! Redirecionando...`);
          window.location.href = `/play?pvpRoom=${encodeURIComponent(d.opponent.roomCode)}`;
          return;
        }
        if (d.status === "queued") {
          attempt += 1;
          setSearchMsg(`⌛ Na fila · faixa ±${d.range} MMR · ${Math.floor((Date.now() - startedAt) / 1000)}s · consulta ${attempt}`);
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
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#1e293b,#0f172a_55%,#020617)] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4">
            <Link href="/" className="text-sm text-slate-400 hover:text-white">← Home</Link>
            <Link href="/play" className="text-sm text-slate-400 hover:text-white">Play</Link>
            <Link href="/profile" className="text-sm text-slate-400 hover:text-white">Profile</Link>
            <Link href="/store" className="text-sm text-slate-400 hover:text-white">Store</Link>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold">{data?.player.avatar || "🎮"} {playerName}</div>
        </div>

        <h1 className="mb-4 text-3xl font-black text-amber-300">🏆 Modo Ranqueado</h1>

        {data && !data.rankedEnabled && (
          <div className="mb-5 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            🔒 Ranked está temporariamente bloqueado pelo gate competitivo. PvP casual continua disponível.
          </div>
        )}

        {data && (
          <>
            {/* Player Rank Card */}
            <div className={`mb-6 rounded-2xl border-2 border-white/10 bg-gradient-to-br ${data.player.tier.gradient} p-6${searching ? " ranked-queue-beacon" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="text-6xl">{data.player.tier.icon}</div>
                  <div>
                    <h2 className="text-3xl font-black text-white drop-shadow">
                      {data.player.tier.name}
                    </h2>
                    <p className="text-sm text-white/80">
                      {data.player.mmr} MMR
                      {data.player.rankedGamesInPlacement > 0 && (
                        <span className="ml-2 rounded bg-amber-400/40 px-2 py-0.5 text-xs font-bold">
                          Placement: {data.player.rankedGamesInPlacement} restantes
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-white/70">
                      Pico: {data.player.peakMmr} ({data.player.peakTier.name} {data.player.peakTier.icon})
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-white/70">Vitórias</p>
                    <p className="text-2xl font-black text-emerald-300">{data.player.rankedWins}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/70">Derrotas</p>
                    <p className="text-2xl font-black text-red-300">{data.player.rankedLosses}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/70">Win Rate</p>
                    <p className="text-2xl font-black text-white">{winRate}%</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-col items-center gap-2">
                <label className="w-full max-w-md text-xs font-bold text-white/70">
                  Deck ranqueado
                  <select className="input mt-1" value={selectedDeck} onChange={(event) => setSelectedDeck(event.target.value)} disabled={searching}>
                    {data.certifiedDecks.map((deck) => <option key={deck.id} value={deck.id}>{deck.emoji} {deck.name}</option>)}
                  </select>
                </label>
                <p className="max-w-xl text-center text-xs text-white/60">
                  Season Zero usa apenas os {data.certifiedDecks.length} decks pré-construídos certificados do pool {data.rankedDeckPoolVersion}. Decks customizados continuam disponíveis no PvP casual.
                </p>
                <button
                  onClick={searchMatch}
                  disabled={searching || data?.rankedEnabled === false || !selectedDeck}
                  className={`rounded-xl px-8 py-2 font-black text-white backdrop-blur transition ${
                    searching ? "bg-white/10" : "bg-white/20 hover:bg-white/30 animate-pulse"
                  }`}
                >
                  {searching ? "🔍 Procurando..." : "⚔️ Buscar Partida Ranqueada"}
                </button>
                {searching && <button onClick={cancelSearch} className="btn-ghost !px-4 !py-1 text-xs">Cancelar fila</button>}
                {searchMsg && <p className="text-sm text-amber-200">{searchMsg}</p>}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Match History */}
              <section>
                <h3 className="mb-3 text-lg font-black text-amber-200">📊 Últimas Partidas</h3>
                <div className="space-y-1">
                  {data.history.length === 0 ? (
                    <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-500">
                      Nenhuma partida ranqueada ainda
                    </p>
                  ) : data.history.map((m) => (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between rounded-lg border p-2 ${
                        m.won ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{m.won ? "🏆" : "💀"}</span>
                        <div>
                          <p className="text-sm font-bold">vs {m.opponentName}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(m.createdAt).toLocaleString("pt-BR", { timeStyle: "short", dateStyle: "short" })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-black ${m.mmrChange > 0 ? "text-emerald-300" : "text-red-300"}`}>
                          {m.mmrChange > 0 ? "+" : ""}{m.mmrChange}
                        </p>
                        <p className="text-xs text-slate-500">{m.mmrBefore} → {m.mmrAfter}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Leaderboard */}
              <section>
                <h3 className="mb-3 text-lg font-black text-amber-200">🌟 Ranking Global</h3>
                <div className="space-y-1">
                  {data.leaderboard.map((p, i) => {
                    const tier = rankTierFor(data.tiers, p.mmr);
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-2 rounded-lg border p-2 ${
                          p.name === playerName ? "border-amber-400 bg-amber-500/10" : "border-white/10 bg-white/[0.02]"
                        }`}
                      >
                        <span className="w-8 text-center text-lg font-black text-slate-400">
                          {i + 1 === 1 ? "🥇" : i + 1 === 2 ? "🥈" : i + 1 === 3 ? "🥉" : `#${i + 1}`}
                        </span>
                        <span className="text-xl">{p.avatar || "🎮"}</span>
                        <div className="flex-1 truncate">
                          <p className="text-sm font-bold">{p.name}</p>
                          <p className="text-xs text-slate-500">{p.title}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${tier.color}`}>{tier.icon} {p.mmr}</p>
                          <p className="text-xs text-slate-500">{p.rankedWins}W {p.rankedLosses}L</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* All Tiers Display */}
            <section className="mt-6">
              <h3 className="mb-3 text-lg font-black text-amber-200">🏅 Todas as Ligas</h3>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
                {data.tiers.map((t) => (
                  <div
                    key={t.name}
                    className={`rounded-xl border-2 bg-gradient-to-br ${t.gradient} p-3 text-center ${
                      t.name === data.player.tier.name ? "ring-2 ring-white shadow-2xl" : "opacity-70"
                    }`}
                  >
                    <div className="text-3xl">{t.icon}</div>
                    <p className="mt-1 font-black text-white">{t.name}</p>
                    <p className="text-xs text-white/70">{t.minMmr}+</p>
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
