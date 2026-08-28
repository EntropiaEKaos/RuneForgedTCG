"use client";
import RuleBuilder from "../RuleBuilder";
import { EffectEditor, F, Json, Panel } from "./CardAuthoringFields";
import {
  CARD_KEYWORDS as KWS,
  CARD_EFFECT_KINDS as EFFECT_KINDS,
  CARD_TRIGGERS as TRIGGERS,
  CARD_LEVEL_UP_TYPES as LEVEL_UP_TYPES,
} from "@/game/card-authoring";

import type { CardAuthoringModel } from "./CardAuthoringModel";

export default function CardRulesTab({ model }: { model: CardAuthoringModel }) {
  const { card, set, classes, mechanicsCatalog } = model;
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
                className="grid items-end gap-2 rounded-xl border border-white/10 bg-white/[.02] p-3 sm:grid-cols-[80px_1fr_1fr_90px_auto]"
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
                <F l="Efeito (kind)">
                  <select
                    className="input"
                    value={ab.effect?.kind || "draw"}
                    onChange={(e) => {
                      const sen = card.sentinela || {};
                      const abilities = [...(sen.abilities ?? [])];
                      abilities[i] = { ...abilities[i], effect: { ...abilities[i].effect, kind: e.target.value } };
                      set("sentinela", { ...sen, abilities });
                    }}
                  >
                    {EFFECT_KINDS.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </F>
                <F l="Qtd">
                  <input
                    type="number"
                    className="input"
                    value={ab.effect?.amount ?? 0}
                    onChange={(e) => {
                      const sen = card.sentinela || {};
                      const abilities = [...(sen.abilities ?? [])];
                      abilities[i] = { ...abilities[i], effect: { ...abilities[i].effect, amount: Number(e.target.value) || 0 } };
                      set("sentinela", { ...sen, abilities });
                    }}
                  />
                </F>
                <button
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
                <div className="sm:col-span-5">
                  <EffectEditor
                    value={ab.effect || { kind: "draw", amount: 1, target: "none" }}
                    classes={classes}
                    onChange={(effect: any) => {
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
      {card.type === "Spell" && (
        <Panel title="Spell Contract" eyebrow="VISUAL EFFECT AUTHORING">
          <EffectEditor value={card.spell || { kind: "damageUnit", amount: 1, target: "enemyUnit" }} classes={classes} onChange={(v: any) => set("spell", v)} />
        </Panel>
      )}
      <Panel title="Trigger Contract" eyebrow="VISUAL TRIGGER AUTHORING">
        <div className="grid gap-3 md:grid-cols-[240px_1fr]">
          <F l="Trigger event">
            <select className="input" value={card.trigger?.when || "onSummon"} onChange={(e) => set("trigger", { when: e.target.value, effect: card.trigger?.effect || { kind: "buffUnit", amount: 0, target: "allyUnit" } })}>
              {TRIGGERS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </F>
          <div>
            <EffectEditor value={card.trigger?.effect || { kind: "buffUnit", amount: 0, target: "allyUnit" }} classes={classes} onChange={(effect: any) => set("trigger", { when: card.trigger?.when || "onSummon", effect })} />
          </div>
        </div>
        <button type="button" className="btn-ghost mt-3 text-xs" onClick={() => set("trigger", undefined)}>Remove trigger</button>
      </Panel>
      {card.type === "Equipment" && (
        <Panel title="Equipment Contract" eyebrow="VISUAL EQUIPMENT AUTHORING">
          <div className="grid gap-3 md:grid-cols-2">
            <F l="Power bonus"><input className="input" type="number" value={card.equipment?.buffPower ?? 0} onChange={(e) => set("equipment", { ...(card.equipment || {}), buffPower: Number(e.target.value), buffHealth: card.equipment?.buffHealth ?? 0, keywords: card.equipment?.keywords || [] })} /></F>
            <F l="Health bonus"><input className="input" type="number" value={card.equipment?.buffHealth ?? 0} onChange={(e) => set("equipment", { ...(card.equipment || {}), buffPower: card.equipment?.buffPower ?? 0, buffHealth: Number(e.target.value), keywords: card.equipment?.keywords || [] })} /></F>
          </div>
          <div className="mt-3 label">Granted keywords</div>
          <div className="mt-2 flex flex-wrap gap-2">{KWS.map((x) => <button type="button" key={x} onClick={() => { const a=card.equipment?.keywords || []; set("equipment", { ...(card.equipment || { buffPower:0,buffHealth:0 }), keywords: a.includes(x) ? a.filter((k:string)=>k!==x) : [...a,x] }); }} className={`rounded-full border px-2 py-1 text-[10px] ${card.equipment?.keywords?.includes(x) ? "bg-cyan-400 text-slate-950" : "border-white/10"}`}>{x}</button>)}</div>
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
      <Panel title="Card Rule Composer" eyebrow="ENGINE-BACKED AUTHORING">
        <p className="mb-4 text-xs leading-5 text-slate-400">
          Compose the behavior using the same Rule Graph contract used by Interaction Studio. The preview is
          editorial; execution remains authoritative inside the Runeforge engine.
        </p>
        <RuleBuilder
          value={{
            name: card.name,
            sourceType: "card",
            sourceKey: card.defId,
            event: card.trigger?.when || "onSummon",
            targetType: "anyUnit",
            targetKey: "",
            condition: {},
            effect: card.trigger?.effect || { kind: "buffUnit", target: "allyUnit", amount: 0 },
            testFixture: { sourceDefId: card.defId, targetDefId: card.defId, enemyDefId: "ember_drake" },
          }}
          setValue={(v: any) => {
            if (v?.effect?.kind) set("trigger", { when: v.event || "onSummon", effect: { ...v.effect } });
          }}
        />
      </Panel>
      {!!(mechanicsCatalog.effects || []).length && <Panel title="Effect Library" eyebrow="COMPOSITE MACROS"><p className="mb-3 text-xs text-slate-400">Macros são expandidas para CardEffect nativos antes de salvar; replay e engine não dependem do nome da macro.</p><div className="flex flex-wrap gap-2">{mechanicsCatalog.effects.map((x:any)=><div key={x.key} className="rounded-xl border border-white/10 bg-white/[.025] p-3"><div className="text-xs font-black">{x.name}</div><div className="mt-2 flex gap-2">{card.type==="Spell"&&<button className="btn-ghost text-[10px]" onClick={()=>set("spell",structuredClone(x.definition.effect))}>Use as Spell</button>}<button className="btn-ghost text-[10px]" onClick={()=>set("trigger",{when:card.trigger?.when||"onSummon",effect:structuredClone(x.definition.effect)})}>Use as Trigger</button></div></div>)}</div></Panel>}
      <Panel title="Raw Contracts" eyebrow="EXPERT / ROUND-TRIP FALLBACK">
        <Json title="Spell" value={card.spell} onChange={(v) => set("spell", v)} />
        <Json title="Trigger" value={card.trigger} onChange={(v) => set("trigger", v)} />
        <Json title="Equipment" value={card.equipment} onChange={(v) => set("equipment", v)} />
        <Json title="Level Up" value={card.levelUp} onChange={(v) => set("levelUp", v)} />
      </Panel>
    </div>
  );
}
