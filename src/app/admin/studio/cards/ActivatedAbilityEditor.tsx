"use client";

import { F, Panel } from "./CardAuthoringFields";
import { AbilityGrammarReadiness, StudioAbilityCostEditor, StudioEffectEditor } from "../AbilityComposerFields";
import type { CardAuthoringModel } from "./CardAuthoringModel";
import type {
  ActivatedAbility,
  ActivatedAbilityCost,
  ActivatedAbilityMode,
  ReactionActivatedAbility,
} from "@/game/activated-ability-types";
import type { ReactionActionKind } from "@/game/counter-rules";

const SUPPORTED_SOURCE_TYPES = new Set(["Unit", "Enchantment", "Artifact", "Sentinela"]);
const DEFAULT_EFFECT = { kind: "draw" as const, amount: 1, target: "none" as const };
const REACTION_KINDS: Array<{ kind: ReactionActionKind; label: string }> = [
  { kind: "unit", label: "Unidade" },
  { kind: "spell", label: "Magia" },
  { kind: "sentinela", label: "Sentinela" },
];

function cloneAbilities<T extends ActivatedAbility>(value: T[] | undefined): T[] {
  return structuredClone(value ?? []);
}

function nextModeId(modes: ActivatedAbilityMode[] | undefined): string {
  const used = new Set((modes ?? []).map((mode) => mode.id));
  let index = 1;
  while (used.has(`mode-${index}`)) index += 1;
  return `mode-${index}`;
}

function patchCost(cost: ActivatedAbilityCost | undefined, patch: Partial<ActivatedAbilityCost>): ActivatedAbilityCost | undefined {
  const next: ActivatedAbilityCost = { ...(cost ?? {}), ...patch };
  for (const key of Object.keys(next) as (keyof ActivatedAbilityCost)[]) {
    if (next[key] === undefined || next[key] === false || next[key] === 0) delete next[key];
  }
  return Object.keys(next).length ? next : undefined;
}

function AbilityEditorBody({
  model,
  abilities,
  reaction,
  replace,
}: {
  model: CardAuthoringModel;
  abilities: ActivatedAbility[] | ReactionActivatedAbility[];
  reaction: boolean;
  replace: (next: any[]) => void;
}) {
  const { card, classes } = model;
  const update = (index: number, patch: Partial<ActivatedAbility> & Partial<ReactionActivatedAbility>) => {
    const next = structuredClone(abilities) as any[];
    next[index] = { ...next[index], ...patch };
    replace(next);
  };
  const replaceModes = (abilityIndex: number, modes: ActivatedAbilityMode[]) => update(abilityIndex, { modes });

  return (
    <>
      <div className="space-y-3">
        {abilities.map((ability, index) => {
          const unlimited = ability.maxUsesPerRound === null;
          const modal = Array.isArray(ability.modes);
          const modes = ability.modes ?? [];
          const reactionAbility = reaction ? ability as ReactionActivatedAbility : null;
          const blockedTargets = reaction
            ? (card.type === "Unit" ? [] : ["self"] as const)
            : (card.type === "Unit" ? ["spellOnStack"] as const : ["spellOnStack", "self"] as const);
          return (
            <section
              key={index}
              data-studio-ability-composer={reaction ? "reaction-activated" : "activated"}
              data-activated-modal={modal ? "true" : "false"}
              data-reaction-activated={reaction ? "true" : "false"}
              className={`rounded-2xl border p-4 ${reaction ? "border-violet-300/20 bg-violet-300/[.03]" : "border-cyan-300/15 bg-cyan-300/[.025]"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[240px] flex-1">
                  <F l={`${reaction ? "Reação" : "Habilidade"} ${index + 1} · descrição`}>
                    <input
                      className="input"
                      maxLength={200}
                      value={ability.description}
                      onChange={(event) => update(index, { description: event.target.value })}
                      placeholder={reaction ? "Ex.: Interceptar: responda ao oponente." : "Ex.: Canalizar: escolha um efeito."}
                    />
                  </F>
                </div>
                <button
                  type="button"
                  className="rounded bg-red-500/20 px-2 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/30"
                  onClick={() => {
                    const next = structuredClone(abilities) as any[];
                    next.splice(index, 1);
                    replace(next);
                  }}
                  aria-label={`Remover ${reaction ? "reação" : "habilidade"} ${index + 1}`}
                >✕</button>
              </div>

              {reactionAbility && (
                <div className="mt-3" data-reaction-responds-to="true">
                  <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-violet-200">Pode responder a</div>
                  <div className="flex flex-wrap gap-2">
                    {REACTION_KINDS.map(({ kind, label }) => {
                      const selected = reactionAbility.respondsTo.includes(kind);
                      return (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => {
                            const current = reactionAbility.respondsTo;
                            const next = selected ? current.filter((candidate) => candidate !== kind) : [...current, kind];
                            update(index, { respondsTo: next });
                          }}
                          className={`rounded-full border px-3 py-1.5 text-xs font-black ${selected ? "border-violet-300/50 bg-violet-300 text-slate-950" : "border-white/10 text-slate-400"}`}
                        >{selected ? "✓ " : ""}{label}</button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-slate-500">Ao menos um tipo é obrigatório. Anulações clássicas com alvo spellOnStack só podem responder a Magia; opções modais podem combinar respostas de board e stack.</p>
                </div>
              )}

              <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border border-violet-300/15 bg-violet-300/[.035] px-3 py-2 text-xs text-violet-100">
                <input
                  type="checkbox"
                  checked={modal}
                  onChange={(event) => {
                    if (event.target.checked) {
                      update(index, { effect: undefined, modes: [{ id: "mode-1", description: "Opção 1", effect: ability.effect ?? { ...DEFAULT_EFFECT } }] });
                    } else {
                      update(index, { effect: modes[0]?.effect ?? { ...DEFAULT_EFFECT }, modes: undefined });
                    }
                  }}
                />
                <span><b>Escolha um (modal)</b> · o jogador seleciona explicitamente uma opção antes de pagar o custo.</span>
              </label>

              <div className="mt-3">
                <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Custo compartilhado</div>
                <StudioAbilityCostEditor value={ability.cost} showLoyalty={card.type === "Sentinela"} onChange={(cost) => update(index, { cost })} />
                <div data-expanded-activated-costs="true" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <F l="Mana de feitiço">
                    <input className="input" type="number" min={0} max={20} value={ability.cost?.spellMana ?? 0} onChange={(event) => update(index, { cost: patchCost(ability.cost, { spellMana: Math.max(0, Math.min(20, Number(event.target.value) || 0)) }) })} />
                  </F>
                  <F l="Descartar da mão">
                    <input data-selected-discard-cost="true" className="input" type="number" min={0} max={10} value={ability.cost?.discardFromHand ?? 0} onChange={(event) => update(index, { cost: patchCost(ability.cost, { discardFromHand: Math.max(0, Math.min(10, Number(event.target.value) || 0)) }) })} />
                  </F>
                  {card.type === "Unit" && (
                    <label className="flex cursor-pointer items-center gap-2 self-end pb-3 text-xs text-slate-300">
                      <input type="checkbox" checked={Boolean(ability.cost?.consumeBarrier)} onChange={(event) => update(index, { cost: patchCost(ability.cost, { consumeBarrier: event.target.checked }) })} />
                      Consumir Barrier ativa
                    </label>
                  )}
                  <div className="self-end pb-3 text-[10px] leading-4 text-slate-500">Mana de feitiço é separada. Descarte exige seleção explícita por instanceId. Barrier só pode ser paga por Unit.</div>
                </div>
              </div>

              <div className="mt-3 grid max-w-xs gap-3">
                <F l="Usos / rodada (compartilhados)">
                  <input className="input" type="number" min={1} max={10} disabled={unlimited} value={unlimited ? 1 : ability.maxUsesPerRound ?? 1} onChange={(event) => update(index, { maxUsesPerRound: Math.max(1, Math.min(10, Number(event.target.value) || 1)) })} />
                </F>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={unlimited} onChange={(event) => update(index, { maxUsesPerRound: event.target.checked ? null : 1 })} />
                  Sem limite por rodada
                </label>
              </div>

              {!modal && (
                <div className="mt-4">
                  {reaction ? (
                    <StudioEffectEditor value={ability.effect} classes={classes} blockedTargets={blockedTargets as any} onChange={(effect) => update(index, { effect })} />
                  ) : (
                    <StudioEffectEditor value={ability.effect} classes={classes} blockedTargets={["spellOnStack"]} onChange={(effect) => update(index, { effect })} />
                  )}
                </div>
              )}

              {modal && (
                <div className="mt-4 space-y-3" data-studio-modal-choices="true">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-violet-200">Opções modais</div>
                      <div className="mt-1 text-[10px] text-slate-500">IDs são persistentes e não derivam da descrição visível.</div>
                    </div>
                    <button type="button" className="btn-ghost text-xs" disabled={modes.length >= 4} onClick={() => replaceModes(index, [...modes, { id: nextModeId(modes), description: `Opção ${modes.length + 1}`, effect: { ...DEFAULT_EFFECT } }])}>+ Adicionar opção</button>
                  </div>

                  {modes.map((mode, modeIndex) => (
                    <div key={mode.id} data-studio-modal-mode={mode.id} className="rounded-xl border border-violet-300/15 bg-violet-300/[.025] p-3">
                      <div className="mb-3 flex flex-wrap items-end gap-3">
                        <div className="min-w-[240px] flex-1">
                          <F l={`Opção ${modeIndex + 1} · descrição`}>
                            <input className="input" maxLength={200} value={mode.description} onChange={(event) => replaceModes(index, modes.map((candidate, candidateIndex) => candidateIndex === modeIndex ? { ...candidate, description: event.target.value } : candidate))} />
                          </F>
                        </div>
                        <div className="min-w-[150px]">
                          <div className="label">Mode ID</div>
                          <div className="input select-text font-mono text-xs text-violet-200">{mode.id}</div>
                        </div>
                        <button type="button" className="btn-ghost text-xs text-red-300" disabled={modes.length <= 1} onClick={() => replaceModes(index, modes.filter((_, candidateIndex) => candidateIndex !== modeIndex))} aria-label={`Remover opção ${modeIndex + 1}`}>Remover</button>
                      </div>
                      <StudioEffectEditor value={mode.effect} classes={classes} blockedTargets={blockedTargets as any} onChange={(effect) => replaceModes(index, modes.map((candidate, candidateIndex) => candidateIndex === modeIndex ? { ...candidate, effect } : candidate))} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        {abilities.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">
            {reaction ? "Nenhuma habilidade ativada de reação." : "Nenhuma habilidade ativada genérica. A carta continuará usando apenas keywords, triggers e demais contratos existentes."}
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={abilities.length >= 4}
        onClick={() => replace([
          ...structuredClone(abilities),
          reaction
            ? { description: "Nova reação ativada", respondsTo: ["spell"], cost: { mana: 1 }, maxUsesPerRound: 1, effect: { ...DEFAULT_EFFECT } }
            : { description: "Nova habilidade ativada", cost: { mana: 1 }, maxUsesPerRound: 1, effect: { ...DEFAULT_EFFECT } },
        ])}
        className="btn-primary mt-4 text-xs disabled:cursor-not-allowed disabled:opacity-40"
      >
        + Adicionar {reaction ? "reação ativada" : "habilidade ativada"}
      </button>
    </>
  );
}

export default function ActivatedAbilityEditor({ model }: { model: CardAuthoringModel }) {
  const { card, set } = model;
  if (!SUPPORTED_SOURCE_TYPES.has(card.type)) return null;

  const abilities: ActivatedAbility[] = card.activatedAbilities ?? [];
  const reactions: ReactionActivatedAbility[] = card.reactionActivatedAbilities ?? [];
  const replace = (next: ActivatedAbility[]) => set("activatedAbilities", next.length ? next : undefined);
  const replaceReactions = (next: ReactionActivatedAbility[]) => set("reactionActivatedAbilities", next.length ? next : undefined);

  return (
    <div className="space-y-4">
      <Panel title="Habilidades ativadas" eyebrow="ABILITY SYSTEM 2.0 · MAIN PHASE">
        <div className="mb-4 grid gap-4 xl:grid-cols-[1fr_420px]">
          <p className="max-w-4xl text-xs leading-5 text-slate-400">Crie ações voluntárias para cartas que permanecem no campo. Habilidades modais compartilham custo e limite. Cada opção recebe ID estável para replay/PvP. O alvo spellOnStack é deliberadamente bloqueado neste timing.</p>
          <AbilityGrammarReadiness />
        </div>
        <AbilityEditorBody model={model} abilities={abilities} reaction={false} replace={replace} />
        <p className="mt-2 text-[10px] text-slate-500">Máximo de 4 habilidades genéricas e 4 opções por habilidade modal. Custos e limites permanecem no nível da habilidade-base.</p>
      </Panel>

      <Panel title="Habilidades de reação" eyebrow="ABILITY SYSTEM 2.0 · AUTHORITATIVE REACTION STACK">
        <div data-studio-reaction-activated-authoring="true" className="mb-4 rounded-xl border border-violet-300/15 bg-violet-300/[.035] p-4 text-xs leading-5 text-slate-300">
          Estas habilidades só podem ser usadas quando existe uma ação adversária pendente na pilha autoritativa. Defina explicitamente a quais famílias elas respondem. Aqui, e somente aqui, <b>spellOnStack</b> é um alvo válido. Custos, descarte selecionado, modos e limite por rodada usam o mesmo contrato das habilidades de main phase.
          <div className="mt-2 text-[10px] text-cyan-200/80">Casual PvP usa prioridade persistida no servidor: a ação-base fica pré-resolução até resposta, passe ou timeout autoritativo, com reconexão, CAS de versão e replay determinístico. Encadeamento arbitrário de múltiplas respostas PvP ainda permanece fora do protocolo v1.</div>
        </div>
        <AbilityEditorBody model={model} abilities={reactions} reaction={true} replace={replaceReactions} />
      </Panel>
    </div>
  );
}
