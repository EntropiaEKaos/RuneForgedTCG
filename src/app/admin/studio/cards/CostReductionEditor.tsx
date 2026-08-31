"use client";

import {
  COST_REDUCTION_CONTRACTS,
  COST_REDUCTION_KINDS,
} from "@/game/card-authoring";
import { F, Panel } from "./CardAuthoringFields";
import type { CardAuthoringModel } from "./CardAuthoringModel";

export default function CostReductionEditor({ model }: { model: CardAuthoringModel }) {
  const { card, set } = model;
  const kind = (card.costReduction?.kind || "creatures") as (typeof COST_REDUCTION_KINDS)[number];
  const contract = COST_REDUCTION_CONTRACTS[kind];

  return (
    <Panel title="Redução de Custo" eyebrow="STATIC COST CONTRACT">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black text-slate-200">Habilidade estática de Affinity</div>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            O custo efetivo é recalculado pelo motor autoritativo no momento de jogar a carta.
          </p>
        </div>
        <button
          type="button"
          onClick={() => set("costReduction", card.costReduction ? undefined : { kind: "creatures", per: 1 })}
          className={`rounded-full border px-3 py-1.5 text-xs font-black ${card.costReduction ? "border-cyan-300/50 bg-cyan-300 text-slate-950" : "border-white/10 text-slate-400"}`}
        >
          {card.costReduction ? "✓ Ativa" : "+ Adicionar"}
        </button>
      </div>

      {card.costReduction && (
        <div className="mt-4 space-y-3 rounded-xl border border-cyan-400/15 bg-cyan-400/[.04] p-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <F l="Regra">
              <select
                className="input"
                value={kind}
                onChange={(e) => {
                  const nextKind = e.target.value as (typeof COST_REDUCTION_KINDS)[number];
                  const current = card.costReduction || {};
                  set(
                    "costReduction",
                    nextKind === "power"
                      ? {
                          kind: nextKind,
                          per: current.per ?? 1,
                          threshold: current.threshold ?? 4,
                          ...(current.max !== undefined ? { max: current.max } : {}),
                        }
                      : {
                          kind: nextKind,
                          per: current.per ?? 1,
                          ...(current.max !== undefined ? { max: current.max } : {}),
                        },
                  );
                }}
              >
                {COST_REDUCTION_KINDS.map((item) => (
                  <option key={item} value={item}>{COST_REDUCTION_CONTRACTS[item].label}</option>
                ))}
              </select>
            </F>

            <F l="Redução por unidade válida">
              <input
                className="input"
                type="number"
                min={1}
                step={1}
                value={card.costReduction.per ?? contract.defaults.per ?? 1}
                onChange={(e) => set("costReduction", {
                  ...card.costReduction,
                  per: Math.max(1, Math.trunc(Number(e.target.value) || 1)),
                })}
              />
            </F>

            {kind === "power" && (
              <F l="Poder mínimo">
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={1}
                  value={card.costReduction.threshold ?? COST_REDUCTION_CONTRACTS.power.defaults.threshold}
                  onChange={(e) => set("costReduction", {
                    ...card.costReduction,
                    threshold: Math.max(0, Math.trunc(Number(e.target.value) || 0)),
                  })}
                />
              </F>
            )}

            <F l="Redução máxima">
              <input
                className="input"
                type="number"
                min={0}
                step={1}
                placeholder="Sem limite"
                value={card.costReduction.max ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const next = { ...card.costReduction };
                  if (raw === "") delete next.max;
                  else next.max = Math.max(0, Math.trunc(Number(raw) || 0));
                  set("costReduction", next);
                }}
              />
            </F>
          </div>

          <p className="text-[11px] leading-5 text-cyan-100/70">
            {contract.description} O desconto regional é aplicado separadamente pelo motor e o custo final nunca fica abaixo de 0.
          </p>
          {kind === "creatures" && (
            <p className="text-[10px] leading-4 text-emerald-300/70">
              `threshold` não faz parte deste contrato e não será publicado silenciosamente.
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
