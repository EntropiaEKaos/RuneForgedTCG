"use client";

import CardTip from "@/components/CardTip";
import { getCard } from "@/game/cards";
import { mulliganPlan } from "@/game/archetypes";
import type { GameState } from "@/game/types";

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
  const manaCounts = Array(11).fill(0) as number[];
  state.players.player.hand.forEach((cardInstance) => {
    const cost = Math.min(10, getCard(cardInstance.defId).cost);
    manaCounts[cost] += 1;
  });
  const maxCount = Math.max(1, ...manaCounts);
  const coach = mulliganPlan(state.players.player.hand.map((card) => card.defId), state.players.player.deckId);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#1e293b,#0f172a_60%,#020617)] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-black text-amber-300">🃏 Fase de Mulligan</h1>
        <p className="mt-2 text-sm text-slate-400">
          Clique nas cartas que deseja trocar. Elas voltarão para o seu deck e você comprará substitutas.
        </p>

        <div className="mx-auto mt-6 max-w-md rounded-xl border border-white/10 bg-black/40 p-4">
          <p className="mb-2 text-center text-xs font-bold text-amber-200 uppercase tracking-wider">
            📊 Curva de Mana da Mão Inicial
          </p>
          <div className="flex h-16 items-end justify-between gap-1 px-2">
            {manaCounts.map((count, cost) => {
              const pct = (count / maxCount) * 100;
              return (
                <div key={cost} className="group relative flex flex-1 flex-col items-center">
                  <div className="w-full rounded-t bg-sky-500 transition-all hover:bg-sky-400" style={{ height: `${pct || 4}%`, opacity: count > 0 ? 1 : 0.2 }} />
                  <span className="mt-1 font-mono text-[9px] text-slate-400">{cost}</span>
                  {count > 0 && <span className="pointer-events-none absolute -top-5 rounded bg-slate-900 px-1 text-[8px] font-bold text-white opacity-0 group-hover:opacity-100">{count}x</span>}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="mulligan-coach" aria-label="Conselho estratégico de mulligan">
          <div><small>CONSELHEIRO DE ABERTURA</small><b>{coach.reason}</b></div>
          <span><strong>{coach.keep.length}</strong> manter</span><span><strong>{coach.replace.length}</strong> reconsiderar</span>
        </aside>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {state.players.player.hand.map((card) => {
            const selected = selection.includes(card.instanceId);
            return <CardTip key={card.instanceId} defId={card.defId} size="lg" selected={selected} onClick={() => onToggle(card.instanceId)} />;
          })}
        </div>
        <div className="mt-8 flex justify-center gap-4">
          <button onClick={onConfirm} className="btn-primary text-base animate-pulse">
            {selection.length > 0 ? `🔄 Trocar ${selection.length} carta(s)` : "✅ Manter Mão"}
          </button>
        </div>
      </div>
    </div>
  );
}
