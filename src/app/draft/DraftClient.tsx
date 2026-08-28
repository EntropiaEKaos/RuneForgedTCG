"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import CardTip from "@/components/CardTip";
import SiteNav from "@/components/SiteNav";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { getCard } from "@/game/cards";
import type { CardDef } from "@/game/types";
import { ensurePlayerSession } from "@/lib/client-player-session";

type DraftPayload = {
  ok: boolean;
  step?: number;
  total?: number;
  deck?: string[];
  regions?: string[];
  pool?: unknown[];
  complete?: boolean;
  isBombPick?: boolean;
  error?: string;
};

function isCardDef(value: unknown): value is CardDef {
  return Boolean(value && typeof value === "object" && "defId" in value && typeof (value as { defId?: unknown }).defId === "string");
}

export default function DraftClient() {
  const [playerName, setPlayerName] = useState("");
  const [step, setStep] = useState(0);
  const [total, setTotal] = useState(40);
  const [deck, setDeck] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [pool, setPool] = useState<CardDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingCardId, setSelectingCardId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);
  const [isBombPick, setIsBombPick] = useState(false);

  const applySnapshot = useCallback((payload: DraftPayload) => {
    const nextTotal = typeof payload.total === "number" && payload.total > 0 ? payload.total : total;
    const nextStep = typeof payload.step === "number" ? payload.step : 0;
    setStep(nextStep);
    setTotal(nextTotal);
    setDeck(Array.isArray(payload.deck) ? payload.deck.map(String) : []);
    setRegions(Array.isArray(payload.regions) ? payload.regions.map(String) : []);
    setPool(Array.isArray(payload.pool) ? payload.pool.filter(isCardDef) : []);
    setComplete(Boolean(payload.complete) || nextStep >= nextTotal);
    setIsBombPick(Boolean(payload.isBombPick));
  }, [total]);

  const loadDraft = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/draft", { cache: "no-store" });
      const payload = await response.json() as DraftPayload;
      if (!payload.ok) {
        setMessage(`❌ ${payload.error || "Não foi possível carregar o draft."}`);
        return;
      }
      applySnapshot(payload);
    } catch {
      setMessage("❌ Não foi possível sincronizar sua sessão de Draft.");
    } finally {
      setLoading(false);
    }
  }, [applySnapshot]);

  useDeferredEffect(() => {
    let cancelled = false;
    void ensurePlayerSession(localStorage.getItem("runeforge_playername") || "")
      .then(async (profile) => {
        if (cancelled) return;
        if (profile.player?.name) setPlayerName(String(profile.player.name));
        await loadDraft();
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setMessage("❌ Não foi possível estabelecer a identidade do jogador.");
        }
      });
    return () => { cancelled = true; };
  }, [loadDraft]);

  const selectCard = async (cardId: string) => {
    if (selectingCardId || loading || complete) return;
    setSelectingCardId(cardId);
    setMessage("");
    try {
      const response = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });
      const payload = await response.json() as DraftPayload;
      if (!payload.ok) {
        setMessage(`❌ ${payload.error || "Escolha recusada pelo servidor."}`);
        return;
      }

      applySnapshot(payload);
      if (payload.complete) {
        setPool([]);
        setIsBombPick(false);
        setMessage("🎉 Draft completo! O deck foi validado e salvo em seus decks customizados.");
      }
    } catch {
      setMessage("❌ Não foi possível confirmar essa escolha. O draft não foi avançado no cliente.");
    } finally {
      setSelectingCardId(null);
    }
  };

  const restartDraft = async () => {
    setComplete(false);
    setDeck([]);
    setPool([]);
    setRegions([]);
    setStep(0);
    await loadDraft();
  };

  const sortedDeck = useMemo(() => {
    const counts = new Map<string, number>();
    for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([id, count]) => {
        try {
          return { def: getCard(id), count };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is { def: CardDef; count: number } => entry !== null)
      .sort((a, b) => a.def.cost - b.def.cost || a.def.name.localeCompare(b.def.name, "pt-BR"));
  }, [deck]);

  const averageCost = useMemo(() => {
    if (deck.length === 0) return "0.0";
    const totalCost = sortedDeck.reduce((sum, entry) => sum + entry.def.cost * entry.count, 0);
    return (totalCost / deck.length).toFixed(1);
  }, [deck.length, sortedDeck]);

  const progress = total > 0 ? Math.min(100, Math.max(0, (step / total) * 100)) : 0;
  const choiceNumber = Math.min(total, step + 1);

  return (
    <main className="rf-app-page">
      <SiteNav />
      <div className="rf-app-shell max-w-7xl">
        <header className="rf-app-heading">
          <div>
            <p className="rf-eyebrow"><span /> FORMATO LIMITADO</p>
            <h1>Arena Draft</h1>
            <p>Construa um deck escolha por escolha. O servidor preserva as regras do início da sessão, limita cópias e regiões e valida o deck antes de salvá-lo.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/modes" className="rf-button rf-button-secondary">◇ MODOS</Link>
            <Link href="/forge" className="rf-button rf-button-primary">◆ MEUS DECKS</Link>
          </div>
        </header>

        {message && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100" role="status" aria-live="polite">
            <span>{message}</span>
            <button type="button" className="text-xs font-bold text-amber-200 underline underline-offset-4" onClick={() => setMessage("")}>Fechar</button>
          </div>
        )}

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Estado do Draft">
          <SummaryCard label="Forjador" value={playerName || "Sincronizando…"} copy="identidade da sessão" />
          <SummaryCard label="Progresso" value={`${step}/${total}`} copy="escolhas confirmadas" />
          <SummaryCard label="Regiões" value={regions.length > 0 ? regions.length : "—"} copy={regions.length > 0 ? regions.join(" + ") : "ainda abertas"} />
          <SummaryCard label="Custo médio" value={averageCost} copy={`${sortedDeck.length} cartas únicas`} />
        </section>

        {complete ? (
          <section className="relative overflow-hidden rounded-2xl border border-emerald-300/25 bg-[radial-gradient(circle_at_top,rgba(16,185,129,.12),transparent_28rem),linear-gradient(145deg,rgba(255,255,255,.04),rgba(255,255,255,.012))] p-7 text-center sm:p-10" aria-labelledby="draft-complete-heading">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-500/[0.08] text-4xl" aria-hidden="true">🏆</div>
            <p className="mt-5 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300/65">SESSÃO CONCLUÍDA</p>
            <h2 id="draft-complete-heading" className="mt-1 text-3xl font-black text-slate-50">Draft completo</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">Seu deck de {deck.length} cartas foi validado pelo servidor e salvo na Forja. A identidade final usa {regions.length || 0} região{regions.length === 1 ? "" : "ões"}.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link href="/forge" className="rf-button rf-button-primary">◆ VER DECK NA FORJA</Link>
              <button type="button" onClick={() => void restartDraft()} disabled={loading} className="rf-button rf-button-secondary">↻ NOVO DRAFT</button>
            </div>
          </section>
        ) : loading && pool.length === 0 ? (
          <EmptyState busy title="Preparando o Draft…" copy="Sincronizando regras imutáveis, escolhas atuais e identidade regional da sessão." />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section aria-labelledby="draft-pick-heading">
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.015))] p-5 sm:p-6">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/35 to-transparent" aria-hidden="true" />
                <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300/65">ESCOLHA ATUAL</p>
                    <h2 id="draft-pick-heading" className="mt-1 text-2xl font-black text-slate-100">Escolha {choiceNumber} de {total}</h2>
                    <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">Selecione uma das opções apresentadas pelo servidor. A escolha só entra no deck depois da confirmação autoritativa.</p>
                  </div>
                  {regions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5" aria-label="Regiões da identidade atual">
                      {regions.map((region) => <span key={region} className="rounded-full border border-amber-300/15 bg-amber-300/[0.05] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-amber-100">{region}</span>)}
                    </div>
                  )}
                </div>

                {isBombPick && (
                  <div className="mt-5 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] px-4 py-3 text-center" role="status">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-200">✦ ESCOLHA DE DESTAQUE</p>
                    <p className="mt-1 text-xs text-slate-400">Este pacote contém pelo menos uma carta Rara, Épica ou Lendária.</p>
                  </div>
                )}

                {pool.length === 0 ? (
                  <EmptyState title="Nenhuma escolha disponível" copy="A sessão não retornou um pool utilizável. Recarregue o snapshot antes de continuar." action={<button className="rf-button rf-button-secondary" onClick={() => void loadDraft()}>RECARREGAR DRAFT</button>} />
                ) : (
                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    {pool.map((card) => {
                      const selecting = selectingCardId === card.defId;
                      return (
                        <button
                          key={card.defId}
                          type="button"
                          onClick={() => void selectCard(card.defId)}
                          disabled={selectingCardId !== null || loading}
                          className="group relative flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/15 p-4 transition hover:-translate-y-1 hover:border-amber-300/30 hover:bg-amber-300/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 disabled:cursor-not-allowed disabled:opacity-55"
                          aria-label={`Escolher ${card.name}, custo ${card.cost}, ${card.rarity}`}
                        >
                          <span className="mb-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">{selecting ? "CONFIRMANDO…" : "ESCOLHER"}</span>
                          <CardTip defId={card.defId} size="lg" />
                          <span className="mt-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{card.region} · {card.rarity}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                    <span>Construção do deck</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full border border-white/[0.06] bg-black/35" role="progressbar" aria-label="Progresso do Draft" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
                    <div className="h-full bg-gradient-to-r from-amber-600 via-amber-300 to-orange-300 shadow-[0_0_12px_rgba(251,191,36,.2)] transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            </section>

            <aside className="self-start xl:sticky xl:top-24" aria-labelledby="draft-deck-heading">
              <div className="rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.04),rgba(255,255,255,.015))] p-4 shadow-[0_20px_60px_rgba(0,0,0,.2)]">
                <div className="flex items-end justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">CONSTRUÇÃO ATUAL</p>
                    <h2 id="draft-deck-heading" className="mt-1 text-lg font-black text-slate-100">Seu deck</h2>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs font-bold text-slate-300">{deck.length}/{total}</span>
                </div>

                {deck.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="text-3xl text-amber-200/50" aria-hidden="true">◇</div>
                    <p className="mt-3 text-xs text-slate-500">A primeira escolha aparecerá aqui.</p>
                  </div>
                ) : (
                  <div className="mt-3 max-h-[560px] space-y-1.5 overflow-y-auto pr-1">
                    {sortedDeck.map(({ def, count }) => (
                      <div key={def.defId} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2 text-xs">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-sky-300/15 bg-sky-500/15 font-black text-sky-200">{def.cost}</span>
                        <span className="text-lg" aria-hidden="true">{def.emoji}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold text-slate-200" title={def.name}>{def.name}</span>
                        <span className="rounded border border-white/[0.07] bg-black/30 px-1.5 py-0.5 text-[10px] font-black text-slate-500">×{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function SummaryCard({ label, value, copy }: { label: string; value: string | number; copy: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">{label}</p>
      <p className="mt-2 truncate text-xl font-black text-slate-100" title={String(value)}>{value}</p>
      <p className="mt-1 truncate text-xs text-slate-500" title={copy}>{copy}</p>
    </div>
  );
}

function EmptyState({ title, copy, busy = false, action }: { title: string; copy: string; busy?: boolean; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center" aria-busy={busy || undefined}>
      {busy ? <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-amber-300" aria-hidden="true" /> : <div className="text-3xl text-amber-200/65" aria-hidden="true">◇</div>}
      <p className="mt-3 font-bold text-slate-300">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">{copy}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
