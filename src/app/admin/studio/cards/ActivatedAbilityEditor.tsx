"use client";

import { F, Panel } from "./CardAuthoringFields";
import { AbilityGrammarReadiness, StudioAbilityCostEditor, StudioEffectEditor } from "../AbilityComposerFields";
import type { CardAuthoringModel } from "./CardAuthoringModel";
import type { ActivatedAbility } from "@/game/activated-ability-types";

const SUPPORTED_SOURCE_TYPES = new Set(["Unit", "Enchantment", "Artifact", "Sentinela"]);

function cloneAbilities(value: ActivatedAbility[] | undefined): ActivatedAbility[] {
  return structuredClone(value ?? []);
}

export default function ActivatedAbilityEditor({ model }: { model: CardAuthoringModel }) {
  const { card, set, classes } = model;
  if (!SUPPORTED_SOURCE_TYPES.has(card.type)) return null;

  const abilities: ActivatedAbility[] = card.activatedAbilities ?? [];
  const replace = (next: ActivatedAbility[]) => set("activatedAbilities", next.length ? next : undefined);
  const update = (index: number, patch: Partial<ActivatedAbility>) => {
    const next = cloneAbilities(abilities);
    next[index] = { ...next[index], ...patch };
    replace(next);
  };

  return (
    <Panel title="Habilidades ativadas" eyebrow="ABILITY SYSTEM 2.0 · COST → TARGET → EFFECT">
      <div className="mb-4 grid gap-4 xl:grid-cols-[1fr_420px]">
        <p className="max-w-4xl text-xs leading-5 text-slate-400">
          Crie ações voluntárias para cartas que permanecem no campo. O mesmo compositor semântico usado pelo
          Mechanics Studio limita cada primitiva aos targets aceitos pela engine. Mana é regular; pagar vida do
          Nexus nunca pode ser letal. Negar spell continua indisponível aqui até habilidades ativadas participarem
          do protocolo autoritativo de reação.
        </p>
        <AbilityGrammarReadiness />
      </div>

      <div className="space-y-3">
        {abilities.map((ability, index) => {
          const unlimited = ability.maxUsesPerRound === null;
          return (
            <section key={index} data-studio-ability-composer="activated" className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.025] p-4">
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

              <div className="mt-3">
                <StudioAbilityCostEditor
                  value={ability.cost}
                  showLoyalty={card.type === "Sentinela"}
                  onChange={(cost) => update(index, { cost })}
                />
              </div>

              <div className="mt-3 grid max-w-xs gap-3">
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
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={unlimited}
                    onChange={(event) => update(index, { maxUsesPerRound: event.target.checked ? null : 1 })}
                  />
                  Sem limite por rodada
                </label>
              </div>

              <div className="mt-4">
                <StudioEffectEditor
                  value={ability.effect}
                  classes={classes}
                  blockedTargets={["spellOnStack"]}
                  onChange={(effect) => update(index, { effect })}
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
