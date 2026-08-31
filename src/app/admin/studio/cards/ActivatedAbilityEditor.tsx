"use client";

import { F, Panel } from "./CardAuthoringFields";
import { AbilityGrammarReadiness, StudioAbilityCostEditor, StudioEffectEditor } from "../AbilityComposerFields";
import type { CardAuthoringModel } from "./CardAuthoringModel";
import type { ActivatedAbility, ActivatedAbilityMode } from "@/game/activated-ability-types";

const SUPPORTED_SOURCE_TYPES = new Set(["Unit", "Enchantment", "Artifact", "Sentinela"]);
const DEFAULT_EFFECT = { kind: "draw" as const, amount: 1, target: "none" as const };

function cloneAbilities(value: ActivatedAbility[] | undefined): ActivatedAbility[] {
  return structuredClone(value ?? []);
}

function nextModeId(modes: ActivatedAbilityMode[] | undefined): string {
  const used = new Set((modes ?? []).map((mode) => mode.id));
  let index = 1;
  while (used.has(`mode-${index}`)) index += 1;
  return `mode-${index}`;
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
  const replaceModes = (abilityIndex: number, modes: ActivatedAbilityMode[]) => update(abilityIndex, { modes });

  return (
    <Panel title="Habilidades ativadas" eyebrow="ABILITY SYSTEM 2.0 · COST → CHOICE → TARGET → EFFECT">
      <div className="mb-4 grid gap-4 xl:grid-cols-[1fr_420px]">
        <p className="max-w-4xl text-xs leading-5 text-slate-400">
          Crie ações voluntárias para cartas que permanecem no campo. Habilidades podem ter um efeito direto ou
          oferecer uma escolha modal. Em habilidades modais, custo e limite de usos pertencem à habilidade-base e
          são compartilhados por todas as opções. Cada opção recebe um ID estável para replay/PvP. Mana é regular;
          pagar vida do Nexus nunca pode ser letal. Negar spell continua indisponível aqui até habilidades ativadas
          participarem do protocolo autoritativo de reação.
        </p>
        <AbilityGrammarReadiness />
      </div>

      <div className="space-y-3">
        {abilities.map((ability, index) => {
          const unlimited = ability.maxUsesPerRound === null;
          const modal = Array.isArray(ability.modes);
          const modes = ability.modes ?? [];
          return (
            <section key={index} data-studio-ability-composer="activated" data-activated-modal={modal ? "true" : "false"} className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.025] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[240px] flex-1">
                  <F l={`Habilidade ${index + 1} · descrição`}>
                    <input
                      className="input"
                      maxLength={200}
                      value={ability.description}
                      onChange={(event) => update(index, { description: event.target.value })}
                      placeholder="Ex.: Canalizar: escolha um efeito."
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

              <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border border-violet-300/15 bg-violet-300/[.035] px-3 py-2 text-xs text-violet-100">
                <input
                  type="checkbox"
                  checked={modal}
                  onChange={(event) => {
                    if (event.target.checked) {
                      update(index, {
                        effect: undefined,
                        modes: [{ id: "mode-1", description: "Opção 1", effect: ability.effect ?? { ...DEFAULT_EFFECT } }],
                      });
                    } else {
                      update(index, {
                        effect: modes[0]?.effect ?? { ...DEFAULT_EFFECT },
                        modes: undefined,
                      });
                    }
                  }}
                />
                <span><b>Escolha um (modal)</b> · o jogador seleciona explicitamente uma opção antes de pagar o custo.</span>
              </label>

              <div className="mt-3">
                <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Custo compartilhado</div>
                <StudioAbilityCostEditor
                  value={ability.cost}
                  showLoyalty={card.type === "Sentinela"}
                  onChange={(cost) => update(index, { cost })}
                />
              </div>

              <div className="mt-3 grid max-w-xs gap-3">
                <F l="Usos / rodada (compartilhados)">
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

              {!modal && (
                <div className="mt-4">
                  <StudioEffectEditor
                    value={ability.effect}
                    classes={classes}
                    blockedTargets={["spellOnStack"]}
                    onChange={(effect) => update(index, { effect })}
                  />
                </div>
              )}

              {modal && (
                <div className="mt-4 space-y-3" data-studio-modal-choices="true">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-violet-200">Opções modais</div>
                      <div className="mt-1 text-[10px] text-slate-500">IDs são persistentes e não derivam da descrição visível.</div>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      disabled={modes.length >= 4}
                      onClick={() => replaceModes(index, [...modes, {
                        id: nextModeId(modes),
                        description: `Opção ${modes.length + 1}`,
                        effect: { ...DEFAULT_EFFECT },
                      }])}
                    >
                      + Adicionar opção
                    </button>
                  </div>

                  {modes.map((mode, modeIndex) => (
                    <div key={mode.id} data-studio-modal-mode={mode.id} className="rounded-xl border border-violet-300/15 bg-violet-300/[.025] p-3">
                      <div className="mb-3 flex flex-wrap items-end gap-3">
                        <div className="min-w-[240px] flex-1">
                          <F l={`Opção ${modeIndex + 1} · descrição`}>
                            <input
                              className="input"
                              maxLength={200}
                              value={mode.description}
                              onChange={(event) => replaceModes(index, modes.map((candidate, candidateIndex) => candidateIndex === modeIndex ? { ...candidate, description: event.target.value } : candidate))}
                            />
                          </F>
                        </div>
                        <div className="min-w-[150px]">
                          <div className="label">Mode ID</div>
                          <div className="input select-text font-mono text-xs text-violet-200">{mode.id}</div>
                        </div>
                        <button
                          type="button"
                          className="btn-ghost text-xs text-red-300"
                          disabled={modes.length <= 1}
                          onClick={() => replaceModes(index, modes.filter((_, candidateIndex) => candidateIndex !== modeIndex))}
                          aria-label={`Remover opção ${modeIndex + 1}`}
                        >
                          Remover
                        </button>
                      </div>
                      <StudioEffectEditor
                        value={mode.effect}
                        classes={classes}
                        blockedTargets={["spellOnStack"]}
                        onChange={(effect) => replaceModes(index, modes.map((candidate, candidateIndex) => candidateIndex === modeIndex ? { ...candidate, effect } : candidate))}
                      />
                    </div>
                  ))}
                </div>
              )}
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
            effect: { ...DEFAULT_EFFECT },
          },
        ])}
        className="btn-primary mt-4 text-xs disabled:cursor-not-allowed disabled:opacity-40"
      >
        + Adicionar habilidade ativada
      </button>
      <p className="mt-2 text-[10px] text-slate-500">Máximo de 4 habilidades genéricas por carta e 4 opções por habilidade modal. Custos e limites permanecem no nível da habilidade-base. Sentinelas podem manter também suas habilidades clássicas de lealdade.</p>
    </Panel>
  );
}
