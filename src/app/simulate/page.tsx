"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import SiteNav from "@/components/SiteNav";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { PRESET_DECK_OPTIONS } from "@/game/preset-deck-options";
import { ensurePlayerSession } from "@/lib/client-player-session";

type SimResult = {
  final: {
    winner: string;
    rounds: number;
    playerNexus: number;
    aiNexus: number;
  };
  replay: {
    id: number;
    seed: number;
    playerName: string;
    deckName: string;
    deckId?: string | null;
    aiDeckName: string;
    aiDeckId?: string | null;
    playerFirst: boolean;
    won: boolean;
    engineVersion?: string | null;
    rulesetVersion?: string | null;
    contentVersion?: string | null;
  };
  log: string[];
};

type SimPayload = Partial<SimResult> & { ok?: boolean; error?: string };

const REGION_GRADIENTS: Record<string, string> = {
  Emberhold: "from-orange-500/25 to-red-950/40",
  Tidecall: "from-cyan-400/20 to-blue-950/40",
  Ironwood: "from-emerald-400/20 to-green-950/40",
  Voidborn: "from-fuchsia-500/20 to-purple-950/40",
};

const DECKS = PRESET_DECK_OPTIONS;

function isSimResult(value: unknown): value is SimResult & { ok: true } {
  if (!value || typeof value !== "object") return false;
  const data = value as SimPayload;
  return data.ok === true
    && Boolean(data.final && typeof data.final.winner === "string" && typeof data.final.rounds === "number")
    && Boolean(data.replay && typeof data.replay.id === "number" && typeof data.replay.deckName === "string")
    && Array.isArray(data.log);
}

function payloadError(value: unknown, fallback: string): string {
  if (value && typeof value === "object" && "error" in value && typeof (value as { error?: unknown }).error === "string") {
    return String((value as { error: string }).error);
  }
  return fallback;
}

function regionGradient(deckId?: string | null): string {
  const deck = DECKS.find((candidate) => candidate.id === deckId);
  if (!deck) return "from-slate-500/15 to-slate-950/40";
  return REGION_GRADIENTS[deck.regions[0]] ?? "from-slate-500/15 to-slate-950/40";
}

export default function SimulatePage() {
  const [deckId, setDeckId] = useState(DECKS[0]?.id ?? "");
  const [aiDeckId, setAiDeckId] = useState(DECKS.find((deck) => deck.id !== DECKS[0]?.id)?.id ?? "");
  const [playerName, setPlayerName] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState("");

  const playerDeck = useMemo(() => DECKS.find((deck) => deck.id === deckId) ?? DECKS[0], [deckId]);
  const opponentDeck = useMemo(
    () => DECKS.find((deck) => deck.id === aiDeckId) ?? DECKS.find((deck) => deck.id !== deckId) ?? DECKS[0],
    [aiDeckId, deckId],
  );

  useDeferredEffect(async () => {
    setSessionLoading(true);
    setSessionError("");
    const profile = await ensurePlayerSession();
    if (!profile.ok || !profile.player?.name) {
      setPlayerName("");
      setSessionError(profile.error || "Não foi possível estabelecer uma sessão estável.");
      setSessionLoading(false);
      return;
    }
    setPlayerName(String(profile.player.name));
    setSessionLoading(false);
  }, []);

  const choosePlayerDeck = (nextDeckId: string) => {
    setDeckId(nextDeckId);
    if (nextDeckId === aiDeckId) {
      setAiDeckId(DECKS.find((deck) => deck.id !== nextDeckId)?.id ?? "");
    }
  };

  const chooseOpponentDeck = (nextDeckId: string) => {
    if (nextDeckId !== deckId) setAiDeckId(nextDeckId);
  };

  const run = async () => {
    if (!playerName || !deckId || !aiDeckId || deckId === aiDeckId || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId, aiDeckId }),
      });
      const payload = await response.json().catch(() => null) as unknown;
      if (!response.ok || !isSimResult(payload)) {
        throw new Error(payloadError(payload, "A simulação autoritativa não pôde ser concluída."));
      }
      setResult(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha inesperada ao executar a simulação.");
    } finally {
      setBusy(false);
    }
  };

  const canRun = Boolean(playerName && deckId && aiDeckId && deckId !== aiDeckId && !busy && !sessionLoading);
  const resultDeckId = result?.replay.deckId ?? deckId;

  return (
    <main className="rf-app-page min-h-screen text-slate-100">
      <SiteNav />
      <div className="rf-app-shell mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/65 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="border-b border-white/10 bg-gradient-to-br from-amber-400/10 via-slate-950/20 to-cyan-400/10 px-5 py-7 sm:px-8 sm:py-9">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="max-w-3xl">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-200/80">
                  <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1">Laboratório de batalha</span>
                  <span>Authoritative Match Simulator</span>
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Simulador autoritativo</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  Compare decks oficiais em uma partida headless executada pelo servidor. Seed, ordem de início, regras do engine, resultado e persistência do replay continuam fora do controle do cliente.
                </p>
              </div>
              <div className="grid min-w-[220px] gap-2 text-xs">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
                  <p className="font-black uppercase tracking-wider text-emerald-200">Autoridade</p>
                  <p className="mt-1 text-emerald-50">Execução server-side</p>
                </div>
                <div aria-label="Player Name" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="font-black uppercase tracking-wider text-slate-400">Identidade</p>
                  <p className="mt-1 font-semibold text-white">{sessionLoading ? "Sincronizando…" : playerName || "Indisponível"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[1.4fr_0.8fr]">
            <div className="space-y-6">
              <section>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Seu lado</p>
                    <h2 className="mt-1 text-xl font-black text-white">Escolha o deck de referência</h2>
                  </div>
                  <span className="text-xs text-slate-500">Deck</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {DECKS.map((deck) => {
                    const selected = deck.id === deckId;
                    return (
                      <button
                        key={deck.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => choosePlayerDeck(deck.id)}
                        className={`rounded-2xl border p-4 text-left transition ${selected ? "border-cyan-300/60 bg-cyan-300/10 shadow-lg shadow-cyan-950/30" : "border-white/10 bg-white/[0.035] hover:border-white/25 hover:bg-white/[0.06]"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-2xl" aria-hidden="true">{deck.emoji}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${selected ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-slate-400"}`}>
                            {selected ? "Selecionado" : "Escolher"}
                          </span>
                        </div>
                        <p className="mt-3 font-black text-white">{deck.name}</p>
                        <p className="mt-1 text-xs text-slate-400">{deck.regions.join(" + ")}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-fuchsia-300">Oponente automatizado</p>
                    <h2 className="mt-1 text-xl font-black text-white">Defina o matchup</h2>
                  </div>
                  <span className="text-xs text-slate-500">Deck adversário</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {DECKS.filter((deck) => deck.id !== deckId).map((deck) => {
                    const selected = deck.id === aiDeckId;
                    return (
                      <button
                        key={deck.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => chooseOpponentDeck(deck.id)}
                        className={`rounded-2xl border p-4 text-left transition ${selected ? "border-fuchsia-300/60 bg-fuchsia-300/10 shadow-lg shadow-fuchsia-950/30" : "border-white/10 bg-white/[0.035] hover:border-white/25 hover:bg-white/[0.06]"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-2xl" aria-hidden="true">{deck.emoji}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${selected ? "bg-fuchsia-300 text-slate-950" : "bg-white/10 text-slate-400"}`}>
                            {selected ? "Selecionado" : "Testar"}
                          </span>
                        </div>
                        <p className="mt-3 font-black text-white">{deck.name}</p>
                        <p className="mt-1 text-xs text-slate-400">{deck.regions.join(" + ")}</p>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Matchup preparado</p>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Jogador</p>
                    <p className="mt-1 font-black text-white">{playerDeck?.emoji} {playerDeck?.name}</p>
                  </div>
                  <div className="text-center text-xs font-black uppercase tracking-[0.2em] text-slate-600">versus</div>
                  <div className="rounded-xl border border-fuchsia-300/15 bg-fuchsia-300/[0.06] p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-fuchsia-300">Adversário</p>
                    <p className="mt-1 font-black text-white">{opponentDeck?.emoji} {opponentDeck?.name}</p>
                  </div>
                </div>
                <button type="button" onClick={run} className="btn-primary mt-5 w-full" disabled={!canRun} title="Run Server Simulation">
                  {busy ? "Executando no servidor…" : "Executar simulação"}
                </button>
                <p className="mt-3 text-xs leading-5 text-slate-500">A seed e quem começa são sorteados pelo servidor. O cliente envia somente os decks desejados para o matchup.</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-xs leading-5 text-slate-400">
                <p className="font-black uppercase tracking-[0.14em] text-slate-300">O que esta ferramenta prova</p>
                <p className="mt-2">A partida completa é processada pela mesma camada de engine autoritativa, e o resultado é persistido como replay consultável.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/hall" className="rounded-lg border border-white/10 px-3 py-2 font-semibold text-slate-200 hover:bg-white/5">Hall de partidas</Link>
                  <Link href="/leaderboard" className="rounded-lg border border-white/10 px-3 py-2 font-semibold text-slate-200 hover:bg-white/5">Leaderboard</Link>
                  <Link href="/profile" className="rounded-lg border border-white/10 px-3 py-2 font-semibold text-slate-200 hover:bg-white/5">Perfil</Link>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {sessionError && (
          <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100">
            <p className="font-bold">Sessão indisponível</p>
            <p className="mt-1 text-red-200/80">{sessionError}</p>
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100" role="alert">
            <p className="font-bold">A simulação não terminou.</p>
            <p className="mt-1 text-red-200/80">{error}</p>
          </div>
        )}

        {result && (
          <section className="mt-6 space-y-5">
            <div className={`overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br ${regionGradient(resultDeckId)} p-5 shadow-xl shadow-black/20 sm:p-7`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-200">Resultado persistido</p>
                  <h2 className="mt-1 text-2xl font-black text-white">{result.final.winner === "player" ? "Vitória do deck de referência" : "Vitória do adversário"}</h2>
                  <p className="mt-1 text-sm text-slate-300">{result.replay.deckName} vs {result.replay.aiDeckName}</p>
                </div>
                <Link href={`/replays/${result.replay.id}`} className="btn-primary">Abrir replay #{result.replay.id}</Link>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Winner</p>
                  <p className="mt-1 text-xl font-black text-white">{result.final.winner === "player" ? "Jogador" : "Adversário"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Rounds</p>
                  <p className="mt-1 text-xl font-black text-white">{result.final.rounds}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Player Nexus</p>
                  <p className="mt-1 text-xl font-black text-white">{result.final.playerNexus}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">AI Nexus</p>
                  <p className="mt-1 text-xl font-black text-white">{result.final.aiNexus}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-slate-300">
                <span>seed <strong className="font-mono text-amber-200">{result.replay.seed}</strong></span>
                <span>{result.replay.playerFirst ? "jogador começou" : "adversário começou"}</span>
                {result.replay.engineVersion && <span>engine {result.replay.engineVersion}</span>}
                {result.replay.rulesetVersion && <span>ruleset {result.replay.rulesetVersion}</span>}
                {result.replay.contentVersion && <span>conteúdo {result.replay.contentVersion}</span>}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-slate-950/65 p-5 shadow-xl shadow-black/20 sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Deterministic Battle Log</p>
                  <h2 className="mt-1 text-xl font-black text-amber-100">Registro da simulação</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-400">{result.log.length} eventos retornados</span>
              </div>
              {result.log.length === 0 ? (
                <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">O servidor não retornou linhas de log para esta simulação.</p>
              ) : (
                <ol className="mt-4 space-y-1.5">
                  {result.log.map((line, index) => (
                    <li key={`${index}-${line}`} className="grid grid-cols-[2.5rem_1fr] gap-2 rounded-xl border border-transparent px-3 py-2 text-sm text-slate-300 hover:border-white/5 hover:bg-white/[0.03]">
                      <span className="font-mono text-xs text-slate-600">{String(index + 1).padStart(2, "0")}</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
