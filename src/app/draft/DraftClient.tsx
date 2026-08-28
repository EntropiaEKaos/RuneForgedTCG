"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import CardTip from "@/components/CardTip";
import { getCard } from "@/game/cards";
import type { CardDef } from "@/game/types";
import { ensurePlayerSession } from "@/lib/client-player-session";

export default function DraftClient() {
  const [playerName, setPlayerName] = useState("");
  const [step, setStep] = useState(0);
  const [total, setTotal] = useState(40);
  const [deck, setDeck] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [pool, setPool] = useState<CardDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);
  const [isBombPick, setIsBombPick] = useState(false);

  useDeferredEffect(() => {
    void ensurePlayerSession(localStorage.getItem("runeforge_playername") || "").then((profile) => {
      if (profile.player?.name) setPlayerName(String(profile.player.name));
    });
  }, []);

  const loadDraft = useCallback(async (name: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/draft?name=${encodeURIComponent(name)}`);
      const d = await res.json();
      if (d.ok) {
        setStep(d.step);
        setTotal(d.total ?? 40);
        setDeck(d.deck);
        setRegions(d.regions ?? []);
        setPool(d.pool || []);
        setComplete(d.step >= (d.total ?? 40));
        setIsBombPick(Boolean(d.isBombPick));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    if (playerName) loadDraft(playerName);
  }, [playerName, loadDraft]);

  const selectCard = async (cardId: string) => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: playerName, cardId }),
      });
      const d = await res.json();
      if (d.ok) {
        setStep(d.step);
        setDeck(d.deck);
        setRegions(d.regions ?? []);
        if (d.complete) {
          setComplete(true);
          setMessage("🎉 Draft completo! Seu deck foi salvo em seus decks customizados.");
        } else {
          setPool(d.pool || []);
          setIsBombPick(Boolean(d.isBombPick));
        }
      } else {
        setMessage(`❌ ${d.error}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const restartDraft = async () => {
    setComplete(false);
    setDeck([]);
    setStep(0);
    setRegions([]);
    // Força um draft novo no servidor (o GET cria um zerado se o anterior já
    // tiver sido concluído/removido, ou se não existir sessão ativa).
    await loadDraft(playerName);
  };

  const counts = new Map<string, number>();
  for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1);
  const sortedDeck = Array.from(counts.entries())
    .map(([id, count]) => {
      try { return { def: getCard(id), count }; } catch { return null; }
    })
    .filter((x): x is { def: CardDef; count: number } => x !== null)
    .sort((a, b) => a.def.cost - b.def.cost);

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#1e293b,#0f172a_55%,#020617)] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4">
            <Link href="/" className="text-sm text-slate-400 hover:text-white">← Home</Link>
            <Link href="/play" className="text-sm text-slate-400 hover:text-white">Play</Link>
            <Link href="/modes" className="text-sm text-slate-400 hover:text-white">Modos</Link>
          </div>
          <input
            className="input max-w-[180px]"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onBlur={() => { void ensurePlayerSession(playerName).then((profile) => { if (profile.player?.name) setPlayerName(String(profile.player.name)); }); }}
          />
        </div>

        <h1 className="mb-1 text-3xl font-black text-amber-300">⚔️ Arena Draft</h1>
        <p className="mb-6 text-sm text-slate-400">Monte um deck poderoso escolhendo 1 de 3 cartas por vez ({total} escolhas). Sua identidade pode reunir até três regiões; uma carta dupla ou tripla ocupa todas as regiões indicadas.</p>

        {message && (
          <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            {message}
          </div>
        )}

        {complete ? (
          <div className="text-center rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-8">
            <div className="text-5xl">🏆</div>
            <h2 className="mt-3 text-2xl font-black text-white">Draft Completo!</h2>
            <p className="mt-2 text-sm text-slate-300">Seu deck de {deck.length} cartas foi salvo na Forja.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/forge" className="btn-primary">
                🔨 Ver Meus Decks
              </Link>
              <button onClick={restartDraft} className="btn-ghost">
                🔄 Começar Novo Draft
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            {/* Pick panel */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-center text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                Escolha {step + 1} de {total}
              </h2>
              {isBombPick && (
                <p className="mb-3 animate-pulse text-center text-sm font-black uppercase tracking-wide text-amber-300">
                  ⭐ Pacote bônus — pelo menos uma carta Rara ou melhor garantida! ⭐
                </p>
              )}
              {regions.length > 0 && (
                <p className="mb-3 text-center text-xs text-slate-400">
                  Região(ões) travada(s): <span className="font-semibold text-amber-200">{regions.join(" + ")}</span>
                  {regions.length < 3 && " (cartas multirregionais comprometem todas as cores da própria identidade)"}
                </p>
              )}
              <div className="flex flex-wrap justify-center gap-4">
                {pool.map((card) => (
                  <button
                    key={card.defId}
                    onClick={() => selectCard(card.defId)}
                    disabled={loading}
                    className="transition-transform hover:scale-105 active:scale-95"
                  >
                    <CardTip defId={card.defId} size="lg" />
                  </button>
                ))}
              </div>
              <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all"
                  style={{ width: `${(step / total) * 100}%` }}
                />
              </div>
            </div>

            {/* Deck view sidebar */}
            <aside className="rounded-xl border border-white/10 bg-white/5 p-4 self-start max-h-[500px] overflow-y-auto">
              <h3 className="font-bold text-amber-200 mb-2">Seu Deck ({deck.length}/{total})</h3>
              <div className="space-y-1">
                {sortedDeck.map(({ def, count }) => (
                  <div key={def.defId} className="flex items-center gap-2 rounded bg-white/5 px-2 py-1 text-xs">
                    <span className="w-5 rounded bg-sky-600 text-center font-bold text-[10px]">{def.cost}</span>
                    <span className="text-sm">{def.emoji}</span>
                    <span className="flex-1 truncate font-semibold">{def.name}</span>
                    <span className="rounded bg-black/40 px-1 text-[9px] font-bold">x{count}</span>
                  </div>
                ))}
                {deck.length === 0 && (
                  <p className="text-center text-xs text-slate-500 py-12">Seu deck está vazio.</p>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
