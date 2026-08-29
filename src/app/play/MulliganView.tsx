"use client";

import { useEffect, useState } from "react";
import CardTip from "@/components/CardTip";
import { getCard } from "@/game/cards";
import { mulliganPlan } from "@/game/archetypes";
import type { GameState } from "@/game/types";
import { PVP_CLIENT_STATUS_EVENT, type PvpClientStatusDetail } from "@/lib/pvp-client";

export function MulliganView({
  state,
  selection,
  onToggle,
  onConfirm,
}: {
  state: GameState;
  selection: string[];
  onToggle: (instanceId: string) => void;
  onConfirm: () => void;
}) {
  const [pvpStatus, setPvpStatus] = useState<PvpClientStatusDetail | null>(null);

  useEffect(() => {
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<PvpClientStatusDetail>).detail;
      if (detail) setPvpStatus(detail);
    };
    window.addEventListener(PVP_CLIENT_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(PVP_CLIENT_STATUS_EVENT, onStatus);
  }, []);

  const hand = state.players.player.hand;
  const manaCounts = Array(11).fill(0) as number[];
  hand.forEach((cardInstance) => {
    const cost = Math.min(10, getCard(cardInstance.defId).cost);
    manaCounts[cost] += 1;
  });
  const maxCount = Math.max(1, ...manaCounts);
  const coach = mulliganPlan(hand.map((card) => card.defId), state.players.player.deckId);
  const replacing = selection.length;
  const keeping = Math.max(0, hand.length - replacing);
  const sending = pvpStatus?.state === "sending" || pvpStatus?.state === "retrying";

  return (
    <main className="rf-app-page">
      <div className="rf-app-shell py-8 sm:py-10">
        <header className="rf-app-heading">
          <div>
            <p className="rf-eyebrow"><span /> ABERTURA DA PARTIDA</p>
            <h1>Prepare sua mão inicial</h1>
            <p>Marque apenas as cartas que deseja devolver ao deck. A confirmação abaixo é a única ação que conclui o mulligan.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3 text-right">
            <small className="block font-black uppercase tracking-[.16em] text-slate-500">Decisão atual</small>
            <strong className="mt-1 block text-lg text-white">{replacing ? `${replacing} para trocar` : "Mão mantida"}</strong>
            <span className="text-xs text-slate-400">{keeping} de {hand.length} permanecem</span>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_360px]" aria-label="Análise da mão inicial">
          <article className="rounded-3xl border border-white/10 bg-white/[.025] p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Curva da abertura</p>
                <h2 className="mt-1 text-xl font-black text-white">Distribuição de mana</h2>
              </div>
              <span className="text-xs text-slate-500">Custos 0–10+</span>
            </div>

            <div className="mt-5 flex h-28 items-end gap-1.5 rounded-2xl border border-white/5 bg-black/20 px-3 pb-3 pt-5" aria-label="Curva de mana da mão inicial">
              {manaCounts.map((count, cost) => {
                const pct = count > 0 ? Math.max(12, Math.round((count / maxCount) * 100)) : 5;
                return (
                  <div key={cost} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${count} carta(s) de custo ${cost === 10 ? "10+" : cost}`}>
                    <span className="mb-1 text-[9px] font-black text-slate-500 opacity-0 transition group-hover:opacity-100">{count || ""}</span>
                    <div className="flex min-h-0 w-full flex-1 items-end">
                      <i
                        data-mana-count={count}
                        className={count > 0 ? "block w-full rounded-t-md bg-sky-400/80" : "block w-full rounded-t-md bg-white/10"}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <b className="mt-1 text-[10px] text-slate-400">{cost === 10 ? "10+" : cost}</b>
                  </div>
                );
              })}
            </div>
          </article>

          <aside className="rounded-3xl border border-violet-300/15 bg-violet-300/[.045] p-5" aria-label="Conselho estratégico de mulligan">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-300/70">Conselheiro de abertura</p>
            <h2 className="mt-2 text-lg font-black text-white">{coach.reason}</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">O conselho é apenas uma sugestão. Marque as cartas que quer devolver; a troca só acontece quando você confirmar.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[.05] p-3 text-center">
                <strong className="block text-2xl text-emerald-300">{coach.keep.length}</strong>
                <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Sugestão: manter</span>
              </div>
              <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[.05] p-3 text-center">
                <strong className="block text-2xl text-amber-300">{coach.replace.length}</strong>
                <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Reconsiderar</span>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-6" aria-labelledby="mulligan-hand-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Sua mão</p>
              <h2 id="mulligan-hand-title" className="mt-1 text-xl font-black text-white">Escolha o que devolver</h2>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[.05] px-3 py-1.5 font-bold text-emerald-300">{keeping} mantendo</span>
              <span className="rounded-full border border-amber-300/15 bg-amber-300/[.05] px-3 py-1.5 font-bold text-amber-300">{replacing} trocando</span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3" aria-live="polite">
            {hand.map((card) => {
              const selected = selection.includes(card.instanceId);
              return (
                <div key={card.instanceId} className="relative">
                  <CardTip defId={card.defId} size="lg" selected={selected} onClick={() => onToggle(card.instanceId)} />
                  <span className={selected
                    ? "pointer-events-none absolute inset-x-2 -bottom-2 rounded-full border border-amber-300/30 bg-slate-950/95 px-2 py-1 text-center text-[10px] font-black uppercase tracking-wide text-amber-200"
                    : "pointer-events-none absolute inset-x-2 -bottom-2 rounded-full border border-emerald-300/20 bg-slate-950/95 px-2 py-1 text-center text-[10px] font-black uppercase tracking-wide text-emerald-200"}
                  >
                    {selected ? "Trocar" : "Manter"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-10 flex flex-col items-center" aria-label="Confirmar mulligan">
          <p className="mb-3 max-w-xl text-center text-xs text-slate-400">
            {replacing > 0
              ? `Você devolverá ${replacing} carta(s) e manterá ${keeping}.`
              : "Nenhuma carta está marcada para troca; confirmar manterá a mão atual."}
          </p>
          <button onClick={onConfirm} disabled={sending} className="btn-primary min-w-[240px] text-base disabled:cursor-wait disabled:opacity-60">
            {sending ? "⌛ Confirmando…" : replacing > 0 ? `🔄 Confirmar troca de ${replacing}` : "✓ Manter mão inicial"}
          </button>
          {pvpStatus ? (
            <div
              className={`pvp-status mt-3 max-w-xl rounded-xl border px-3 py-2 text-center text-xs ${pvpStatus.state === "error" ? "border-rose-300/20 bg-rose-300/[.06] text-rose-200" : pvpStatus.state === "confirmed" ? "border-emerald-300/20 bg-emerald-300/[.06] text-emerald-200" : "border-sky-300/20 bg-sky-300/[.06] text-sky-200"}`}
              role="status"
              aria-live="polite"
            >
              {pvpStatus.message}{pvpStatus.status != null ? ` · HTTP ${pvpStatus.status}` : ""}
            </div>
          ) : null}
          <span className="mt-2 text-[10px] uppercase tracking-[.14em] text-slate-600">Uma única confirmação encerra esta fase</span>
        </section>
      </div>
    </main>
  );
}