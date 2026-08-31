"use client";

import CardTip from "@/components/CardTip";
import type { GameState } from "@/game/types";

export interface PendingActivatedDiscard {
  sourceInstanceId: string;
  abilityIndex: number;
  required: number;
  selectedIds: string[];
  target?: string;
  modeId?: string;
}

export function ActivatedDiscardPicker({
  state,
  pending,
  onToggle,
  onConfirm,
  onCancel,
}: {
  state: GameState;
  pending: PendingActivatedDiscard;
  onToggle: (instanceId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const hand = state.players.player.hand;
  const complete = pending.selectedIds.length === pending.required;
  return (
    <div
      data-activated-discard-picker="true"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Selecionar cartas para descartar como custo"
    >
      <div className="w-full max-w-5xl rounded-3xl border border-amber-300/25 bg-slate-950/95 p-5 shadow-2xl shadow-black/60">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">Custo de habilidade ativada</div>
            <h2 className="mt-1 text-xl font-black text-white">Escolha {pending.required} carta{pending.required === 1 ? "" : "s"} para descartar</h2>
            <p className="mt-1 text-xs text-slate-400">
              O descarte é pago antes do efeito. A seleção exata será gravada no replay/PvP por instanceId.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs font-bold text-slate-200">
            {pending.selectedIds.length}/{pending.required} selecionada{pending.selectedIds.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="mt-5 flex max-h-[58vh] flex-wrap items-start justify-center gap-3 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-4">
          {hand.map((card) => {
            const selected = pending.selectedIds.includes(card.instanceId);
            const canSelect = selected || pending.selectedIds.length < pending.required;
            return (
              <div
                key={card.instanceId}
                data-discard-card-id={card.instanceId}
                data-discard-selected={selected ? "true" : "false"}
                className={selected ? "rounded-2xl ring-4 ring-amber-300" : canSelect ? "rounded-2xl ring-1 ring-white/10 hover:ring-2 hover:ring-amber-300/70" : "opacity-45"}
              >
                <CardTip
                  defId={card.defId}
                  state={state}
                  size="md"
                  selected={selected}
                  dimmed={!canSelect}
                  onClick={canSelect ? () => onToggle(card.instanceId) : undefined}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancelar</button>
          <button
            data-confirm-activated-discard="true"
            type="button"
            className="btn-primary"
            disabled={!complete}
            onClick={onConfirm}
          >
            Confirmar descarte e ativar
          </button>
        </div>
      </div>
    </div>
  );
}
