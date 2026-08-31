"use client";
import RuleBuilder from "../RuleBuilder";
import { StudioEffectEditor } from "../AbilityComposerFields";
import { F, Json, Panel } from "./CardAuthoringFields";
import ActivatedAbilityEditor from "./ActivatedAbilityEditor";
import CostReductionEditor from "./CostReductionEditor";
import {
  CARD_KEYWORDS as KWS,
  CARD_LEVEL_UP_TYPES as LEVEL_UP_TYPES,
} from "@/game/card-authoring";
import { MAX_EQUIPMENT_PER_UNIT } from "@/game/equipment-link-contract";
import { keywordIsGrantable } from "@/game/keywords";
import { isTriggerSupported, supportedTriggerEvents } from "@/game/trigger-contract";

import type { CardAuthoringModel } from "./CardAuthoringModel";

const COUNTER_RULES = [
  { kind: "unit", key: "counter_unit", label: "Unidades" },
  { kind: "spell", key: "counter_spell", label: "Magias" },
  { kind: "sentinela", key: "counter_sentinela", label: "Sentinelas" },
] as const;
const UNCOUNTERABLE_RULE = "uncounterable";
const GRANTABLE_KWS = KWS.filter((keyword) => keywordIsGrantable(keyword));

export default function CardRulesTab({ model }: { model: CardAuthoringModel }) {
  const { card, set, classes, mechanicsCatalog } = model;
  const customKeywords = (card.customKeywords ?? []) as string[];
  const triggerEvents = supportedTriggerEvents(card.type);
  const currentTriggerSupported = Boolean(card.trigger && isTriggerSupported(card.type, card.trigger.when));
  const triggerEvent = currentTriggerSupported ? card.trigger.when : triggerEvents[0];
  const hasAutomaticTriggerContract = triggerEvents.length > 0;
  const staleTrigger = Boolean(card.trigger && !currentTriggerSupported);
  const setRule = (key: string, enabled: boolean) => {
    const next = customKeywords.filter((item) => item !== key);
    if (enabled) next.push(key);
    set("customKeywords", [...new Set(next)]);
  };
  const clearCounterFilters = () => {
    const counterKeys = new Set(COUNTER_RULES.map((rule) => rule.key));
    set("customKeywords", customKeywords.filter((item) => !counterKeys.has(item as typeof COUNTER_RULES[number]["key"])));
  };
  const hasSpecificCounterFilter = COUNTER_RULES.some((rule) => customKeywords.includes(rule.key));

  return (
    <div className="space-y-4">
      {card.type === "Sentinela" && (
        <Panel title="Sentinela (Planeswalker)" eyebrow="LOYALTY & ABILITIES">
          <p className="mb-4 text-xs leading-5 text-slate-400">
            Sentinelas ativam habilidades gastando lealdade em vez de mana. É obrigatório definir a lealdade
            inicial e pelo menos uma habilidade antes de conseguir publicar este tipo de carta.
          </p>
          <F l="Lealdade Inicial">
            <input
              type="number"
              className="input max-w-[140px]"
              min={1}
              max={20}
              value={card.sentinela?.startingLoyalty ?? 3}
              onChange={(e) => {
                const sen = card.sentinela || {};
                set("sentinela", { startingLoyalty: Number(e.target.value) || 1, abilities: sen.abilities ?? [] });
              }}
            />
          </F>
          <div className="mt-5 label">Habilidades (custo de lealdade + efeito)</div>
          <div className="mt-2 space-y-2">
            {(card.sentinela?.abilities ?? []).map((ab: any, i: number) => (
              <div
                key={i}
                className="grid items-end gap-2 rounded-xl border border-white/10 bg-white/[.02] p-3 sm:grid-cols-[100px_1fr_auto]"
              >
                <F l="Custo">
                  <input
                    type="number"
                    className="input"
                    value={ab.cost}
                    onChange={(e) => {
                      const sen = card.sentinela || {};
                      const abilities = [...(sen.abilities ?? [])];
                      abilities[i] = { ...abilities[i], cost: Number(e.target.value) || 0 };
                      set("sentinela", { ...sen, abilities });
                    }}
                  />
                </F>
                <F l="Descrição">
                  <input
                    className="input"
                    value={ab.description}
                    onChange={(e) => {
                      const sen = card.sentinela || {};
                      const abilities = [...(sen.abilities ?? [])];
                      abilities[i] = { ...abilities[i], description: e.target.value };
                      set("sentinela", { ...sen, abilities });
                    }}
                  />
                </F>
                <button
                  type="button"
                  aria-label={`Remover habilidade ${i + 1}`}
                  onClick={() => {
                    const sen = card.sentinela || {};
                    const abilities = [...(sen.abilities ?? [])];
                    abilities.splice(i, 1);
                    set("sentinela", { ...sen, abilities });
                  }}
                  className="rounded bg-red-500/20 px-2 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/30"
                >
                  ✕
                </button>
                <div className="sm:col-span-3">
                  <StudioEffectEditor
                    value={ab.effect || { kind: "draw", amount: 1, target: "none" }}
                    classes={classes}
                    onChange={(effect) => {
                      const sen = card.sentinela || {};
                      const abilities = [...(sen.abilities ?? [])];
                      abilities[i] = { ...abilities[i], effect };
                      set("sentinela", { ...sen, abilities });
                    }}
                  />
                </div>
              </div>
            ))}
            {!(card.sentinela?.abilities ?? []).length && (
              <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">
                Nenhuma habilidade ainda. Adicione ao menos uma para poder publicar.
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              const sen = card.sentinela || {};
              const abilities = [...(sen.abilities ?? [])];
              abilities.push({ cost: 1, description: "Nova habilidade", effect: { kind: "draw", amount: 1, target: "none" } });
              set("sentinela", { startingLoyalty: sen.startingLoyalty ?? 3, abilities });
            }}
            className="mt-3 rounded-full bg-amber-400 px-4 py-1.5 text-xs font-black text-slate-950 hover:bg-amber-300"
          >
            + Adicionar habilidade
          </button>
        </Panel>
      )}

      <ActivatedAbilityEditor model={model} />
      <CostReductionEditor model={model} />

      <Panel title="Proteção contra Anulação" eyebrow="STACK IMMUNITY">
        <button
          type="button"
          onClick={() => setRule(UNCOUNTERABLE_RULE, !customKeywords.includes(UNCOUNTERABLE_RULE))}
          className={`rounded-xl border px-4 py-3 text-left text-xs font-bold ${customKeywords.includes(UNCOUNTERABLE_RULE) ? "border-amber-300/40 bg-amber-400/10 text-amber-200" : "border-white/10 bg-white/[.025] text-slate-400"}`}
        >
          <span className="mr-2">{customKeywords.includes(UNCOUNTERABLE_RULE) ? "✓" : "○"}</span>
          Não pode ser anulada
        </button>
        <p className="mt-2 text-[11px] leading-5 text-slate-500">
          Keyword semântica reservada do motor. Quando ativa, nenhuma anulação universal ou específica pode impedir esta carta de resolver.
        </p>
      </Panel>

      {card.type === "Spell" && (
        <Panel title="Spell Contract" eyebrow="SEMANTIC EFFECT AUTHORING">
          <StudioEffectEditor
            value={card.spell || { kind: "damageUnit", amount: 1, target: "enemyUnit" }}
            classes={classes}
            onChange={(effect) => set("spell", effect)}
          />
          {card.spell?.kind === "negateSpell" && (
            <div className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-400/[.04] p-4">
              <div className="studio-kicker">COUNTER TARGET CONTRACT</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={clearCounterFilters}
                  className={`rounded-full border px-3 py-1.5 text-xs font-black ${!hasSpecificCounterFilter ? "border-cyan-300/50 bg-cyan-300 text-slate-950" : "border-white/10 text-slate-400"}`}
                >
                  Qualquer ação
                </button>
                {COUNTER_RULES.map((rule) => {
                  const selected = customKeywords.includes(rule.key);
                  return (
                    <button
                      type="button"
                      key={rule.kind}
                      onClick={() => setRule(rule.key, !selected)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-black ${selected ? "border-violet-300/50 bg-violet-300 text-slate-950" : "border-white/10 text-slate-400"}`}
                    >
                      {selected ? "✓ " : ""}{rule.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-400">
                Sem filtros, a anulação é universal e pode anular Unidade, Magia ou Sentinela. Marque um ou mais tipos apenas para criar uma anulação específica.
              </p>
              <p className="mt-1 text-[11px] leading-5 text-emerald-300/80">
                O “Follow-up effect” acima só é executado quando a anulação realmente é bem-sucedida.
              </p>
            </div>
          )}
        </Panel>
      )}

      <Panel title="Trigger Contract" eyebrow="SEMANTIC TRIGGER AUTHORING">
        {hasAutomaticTriggerContract && triggerEvent ? (
          <>
            {staleTrigger && (
              <div className="mb-3 rounded-xl border border-amber-300/20 bg-amber-300/[.06] p-3 text-xs text-amber-100">
                O tipo da carta mudou e o trigger anterior não é executável nesta fonte. Escolha um evento suportado abaixo ou remova o trigger.
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-[240px_1fr]">
              <F l="Trigger event">
                <select
                  className="input"
                  value={triggerEvent}
                  onChange={(e) => set("trigger", { when: e.target.value, effect: card.trigger?.effect || { kind: "buffUnit", amount: 0, target: "allyUnit" } })}
                >
                  {triggerEvents.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </F>
              <StudioEffectEditor
                value={card.trigger?.effect || { kind: "buffUnit", amount: 0, target: "allyUnit" }}
                classes={classes}
                onChange={(effect) => set("trigger", { when: triggerEvent, effect })}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className="btn-ghost text-xs" onClick={() => set("trigger", undefined)}>Remove trigger</button>
              <span className="text-[10px] text-emerald-300/70">Eventos executáveis para {card.type}: {triggerEvents.join(", ")}</span>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[.025] p-4 text-xs leading-5 text-slate-400">
            <div className="font-black text-slate-200">{card.type} usa contratos estruturais próprios.</div>
            <p className="mt-1">O runtime não dispara Trigger Contract automático para este tipo de carta. O Studio não oferece eventos que seriam publicados sem execução.</p>
            {card.trigger && <button type="button" className="btn-ghost mt-3 text-xs text-amber-200" onClick={() => set("trigger", undefined)}>Remover trigger incompatível</button>}
          </div>
        )}
      </Panel>

      {card.type === "Equipment" && (
        <Panel title="Equipment Contract" eyebrow="VISUAL EQUIPMENT AUTHORING">
          <p className="mb-4 text-xs leading-5 text-slate-400">
            Equipment é vinculado a uma unidade aliada. Cada unidade pode sustentar no máximo {MAX_EQUIPMENT_PER_UNIT} Equipments; ao deixar o campo, os Equipments vinculados deixam o campo junto com ela.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <F l="Power bonus"><input className="input" type="number" value={card.equipment?.buffPower ?? 0} onChange={(e) => set("equipment", { ...(card.equipment || {}), buffPower: Number(e.target.value), buffHealth: card.equipment?.buffHealth ?? 0, keywords: card.equipment?.keywords || [] })} /></F>
            <F l="Health bonus"><input className="input" type="number" value={card.equipment?.buffHealth ?? 0} onChange={(e) => set("equipment", { ...(card.equipment || {}), buffPower: card.equipment?.buffPower ?? 0, buffHealth: Number(e.target.value), keywords: card.equipment?.keywords || [] })} /></F>
          </div>
          <div className="mt-3 label">Granted keywords</div>
          <div className="mt-2 flex flex-wrap gap-2">{GRANTABLE_KWS.map((x) => <button type="button" key={x} onClick={() => { const a=card.equipment?.keywords || []; set("equipment", { ...(card.equipment || { buffPower:0,buffHealth:0 }), keywords: a.includes(x) ? a.filter((k:string)=>k!==x) : [...a,x] }); }} className={`rounded-full border px-2 py-1 text-[10px] ${card.equipment?.keywords?.includes(x) ? "bg-cyan-400 text-slate-950" : "border-white/10"}`}>{x}</button>)}</div>
        </Panel>
      )}
      {card.isChampion && (
        <Panel title="Champion Level Up" eyebrow="VISUAL LEVEL-UP AUTHORING">
          <div className="grid gap-3 md:grid-cols-4">
            <F l="Condition"><select className="input" value={card.levelUp?.type || "nexusDamage"} onChange={(e) => set("levelUp", { ...(card.levelUp || { amount:1,toDefId:"",hint:"" }), type:e.target.value })}>{LEVEL_UP_TYPES.map(x=><option key={x}>{x}</option>)}</select></F>
            <F l="Amount"><input className="input" type="number" min={1} value={card.levelUp?.amount ?? 1} onChange={(e)=>set("levelUp",{...(card.levelUp||{type:"nexusDamage",toDefId:"",hint:""}),amount:Number(e.target.value)})}/></F>
            <F l="Transforms to defId"><input className="input font-mono" value={card.levelUp?.toDefId || ""} onChange={(e)=>set("levelUp",{...(card.levelUp||{type:"nexusDamage",amount:1,hint:""}),toDefId:e.target.value})}/></F>
            <F l="Hint"><input className="input" value={card.levelUp?.hint || ""} onChange={(e)=>set("levelUp",{...(card.levelUp||{type:"nexusDamage",amount:1,toDefId:""}),hint:e.target.value})}/></F>
          </div>
        </Panel>
      )}

      {hasAutomaticTriggerContract && triggerEvent ? (
        <Panel title="Card Rule Composer" eyebrow="ENGINE-BACKED AUTHORING">
          <p className="mb-4 text-xs leading-5 text-slate-400">
            Compose the behavior using the same Rule Graph contract used by Interaction Studio. Event selection is restricted to the executable Trigger Source Contract for this card type.
          </p>
          <RuleBuilder
            eventOptions={triggerEvents}
            value={{
              name: card.name,
              sourceType: "card",
              sourceKey: card.defId,
              event: triggerEvent,
              targetType: "anyUnit",
              targetKey: "",
              condition: {},
              effect: card.trigger?.effect || { kind: "buffUnit", target: "allyUnit", amount: 0 },
              testFixture: { sourceDefId: card.defId, targetDefId: card.defId, enemyDefId: "ember_drake" },
            }}
            setValue={(v: any) => {
              const nextEvent = v?.event || triggerEvent;
              if (v?.effect?.kind && isTriggerSupported(card.type, nextEvent)) {
                set("trigger", { when: nextEvent, effect: { ...v.effect } });
              }
            }}
          />
        </Panel>
      ) : (
        <Panel title="Card Rule Composer" eyebrow="ENGINE-BACKED AUTHORING">
          <p className="text-xs leading-5 text-slate-400">Rule Graph automático não é oferecido para {card.type}, porque este tipo não possui eventos automáticos no Trigger Source Contract atual.</p>
        </Panel>
      )}

      {!!(mechanicsCatalog.effects || []).length && <Panel title="Effect Library" eyebrow="COMPOSITE MACROS"><p className="mb-3 text-xs text-slate-400">Macros são expandidas para CardEffect nativos antes de salvar; replay e engine não dependem do nome da macro.</p><div className="flex flex-wrap gap-2">{mechanicsCatalog.effects.map((x:any)=><div key={x.key} className="rounded-xl border border-white/10 bg-white/[.025] p-3"><div className="text-xs font-black">{x.name}</div><div className="mt-2 flex gap-2">{card.type==="Spell"&&<button className="btn-ghost text-[10px]" onClick={()=>set("spell",structuredClone(x.definition.effect))}>Use as Spell</button>}{triggerEvent&&<button className="btn-ghost text-[10px]" onClick={()=>set("trigger",{when:triggerEvent,effect:structuredClone(x.definition.effect)})}>Use as Trigger</button>}</div></div>)}</div></Panel>}
      <Panel title="Raw Contracts" eyebrow="EXPERT / ROUND-TRIP FALLBACK">
        <Json title="Cost Reduction" value={card.costReduction} onChange={(v) => set("costReduction", v)} />
        <Json title="Spell" value={card.spell} onChange={(v) => set("spell", v)} />
        <Json title="Trigger" value={card.trigger} onChange={(v) => set("trigger", v)} />
        <Json title="Equipment" value={card.equipment} onChange={(v) => set("equipment", v)} />
        <Json title="Level Up" value={card.levelUp} onChange={(v) => set("levelUp", v)} />
        <Json title="Activated Abilities" value={card.activatedAbilities} onChange={(v) => set("activatedAbilities", v)} />
      </Panel>
    </div>
  );
}
