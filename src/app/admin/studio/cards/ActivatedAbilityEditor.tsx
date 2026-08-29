"use client";

import { EffectEditor, F, Panel } from "./CardAuthoringFields";
import type { CardAuthoringModel } from "./CardAuthoringModel";
import type { ActivatedAbility } from "@/game/activated-ability-types";

const SUPPORTED_SOURCE_TYPES = new Set(["Unit", "Enchantment", "Artifact", "Sentinela"]);

function cloneAbilities(value: ActivatedAbility[] | undefined): ActivatedAbility[] {
  return structuredClone(value ?? []);
}

export default function ActivatedAbilityEditor({ model }: { model: CardAuthoringModel }) {
  const { card, set, classes } = model;
  if (!SUPPORTED_SOURCE_TYPES.has(card.type)) return null;

  const abilities = card.activatedAbilities ?? [];
  const replace = (next: ActivatedAbility[]) => set("activatedAbilities", next.length ? next : undefined);
  const update = (index: number, patch: Partial<ActivatedAbility>) => {
    const next = cloneAbilities(abilities);
    next[index] = { ...next[index], ...patch };
    replace(next);
  };
  const updateCost = (index: number, patch: Record<string, unknown>) => {
    const current = abilities[index]?.cost ?? {};
    const nextCost = { ...current, ...patch } as ActivatedAbility["cost"];
    for (const key of Object.keys(nextCost ?? {})) {
      if ((nextCost as Record<string, unknown>)[key] === undefined || (nextCost as Record<string, unknown>)[key] === false || (nextCost as Record<string, unknown>)[key] === 0) {
        delete (nextCost as Record<string, unknown>)[key];
      }
    }
    update(index, { cost: nextCost && Object.keys(nextCost).length ? nextCost : undefined });
  };

  return (
    <Panel title="Habilidades ativadas" eyebrow="COST → TARGET → EFFECT">
      <p className="mb-4 max-w-4xl text-xs leading-5 text-slate-400">
        Crie ações voluntárias para cartas que permanecem no campo. O motor valida custo, dono, limite de uso,
        Hexproof e alvo no servidor. Mana é sempre mana regular; pagar vida do Nexus nunca pode ser letal.
        Habilidades que miram a pilha permanecem bloqueadas até o protocolo autoritativo de reação suportá-las.
      </p>

      <div className="space-y-3">
        {abilities.map((ability, index) => {
          const unlimited = ability.maxUsesPerRound === null;
          return (
            <section key={index} className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.025] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[240px] flex-1">
                  <F l={`Habilidade ${index + 1} · descrição`}>
                    <input
                      className="input"
                      maxLength={200}
                      value={ability.description}
                      onChange={(event) => update(index, { description: event.target.value })}
                      placeholder="Ex.: Canalizar: cause 2 de dano a uma unidade inimiga."
                    />
                  </F>
                </div>
                <button
                  type="button"
                  className="rounded bg-red-500/20 px-2 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/30"
                  onClick={() => {
                    const next = cloneAbilities(abilities);
                    next.splice(index, 1);
                    replace(next);
                  }}
                  aria-label={`Remover habilidade ${index + 1}`}
                >
                  ✕
                </button>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <F l="Mana regular">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={20}
                    value={ability.cost?.mana ?? 0}
                    onChange={(event) => updateCost(index, { mana: Math.max(0, Math.min(20, Number(event.target.value) || 0)) })}
                  />
                </F>
                <F l="Vida do Nexus">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={20}
                    value={ability.cost?.nexusHealth ?? 0}
                    onChange={(event) => updateCost(index, { nexusHealth: Math.max(0, Math.min(20, Number(event.target.value) || 0)) })}
                  />
                </F>
                {card.type === "Sentinela" && (
                  <F l="Δ Lealdade">
                    <input
                      className="input"
                      type="number"
                      min={-20}
                      max={20}
                      value={ability.cost?.loyaltyDelta ?? 0}
                      onChange={(event) => updateCost(index, { loyaltyDelta: Math.max(-20, Math.min(20, Number(event.target.value) || 0)) })}
                    />
                  </F>
                )}
                <F l="Usos / rodada">
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={10}
                    disabled={unlimited}
                    value={unlimited ? 1 : ability.maxUsesPerRound ?? 1}
                    onChange={(event) => update(index, { maxUsesPerRound: Math.max(1, Math.min(10, Number(event.target.value) || 1)) })}
                  />
                </F>
                <div className="flex flex-col justify-end gap-2 pb-1 text-xs text-slate-300">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(ability.cost?.exhaustSelf)}
                      onChange={(event) => updateCost(index, { exhaustSelf: event.target.checked })}
                    />
                    Exaurir fonte
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(ability.cost?.sacrificeSelf)}
                      onChange={(event) => updateCost(index, { sacrificeSelf: event.target.checked })}
                    />
                    Sacrificar fonte
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={unlimited}
                      onChange={(event) => update(index, { maxUsesPerRound: event.target.checked ? null : 1 })}
                    />
                    Sem limite por rodada
                  </label>
                </div>
              </div>

              <div className="mt-4">
                <EffectEditor
                  value={ability.effect}
                  classes={classes}
                  onChange={(effect: ActivatedAbility["effect"]) => {
                    // Keep unsupported stack targeting out of draft data instead of
                    // letting the designer discover the restriction only at publish.
                    update(index, {
                      effect: effect.target === "spellOnStack" ? { ...effect, target: "none" } : effect,
                    });
                  }}
                />
              </div>
            </section>
          );
        })}

        {abilities.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">
            Nenhuma habilidade ativada genérica. A carta continuará usando apenas keywords, triggers e demais contratos existentes.
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={abilities.length >= 4}
        onClick={() => replace([
          ...cloneAbilities(abilities),
          {
            description: "Nova habilidade ativada",
            cost: { mana: 1 },
            maxUsesPerRound: 1,
            effect: { kind: "draw", amount: 1, target: "none" },
          },
        ])}
        className="btn-primary mt-4 text-xs disabled:cursor-not-allowed disabled:opacity-40"
      >
        + Adicionar habilidade ativada
      </button>
      <p className="mt-2 text-[10px] text-slate-500">Máximo de 4 habilidades genéricas por carta. Sentinelas podem manter também suas habilidades clássicas de lealdade.</p>
    </Panel>
  );
}
