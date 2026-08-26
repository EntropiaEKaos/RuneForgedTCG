"use client";
import type { CardDef } from "@/game/types";
import { strategicRoleForCard, STRATEGIC_ROLE_IDENTITIES } from "@/game/card-role";
import { EMPTY } from "./useCardAuthoringModel";
import { F, Panel, ToggleField } from "./CardAuthoringFields";
import {
  CARD_RACES as RACES,
  CARD_KEYWORDS as KWS,
  CARD_STRATEGIC_ROLES as STRATEGIC_ROLES,
  CARD_DOCTRINES as DOCTRINES,
} from "@/game/card-authoring";

import type { CardAuthoringModel } from "./CardAuthoringModel";

export default function CardClassificationTab({ model }: { model: CardAuthoringModel }) {
  const { card, mechanicsCatalog, applyArchetypeItem, set, toggle, classes, toggleCustomKeyword } = model;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Combat Profile" eyebrow="STATS & IDENTITY">
        <F l="Card archetype / custom type">
          <select className="input mb-4" value={card.archetypeKey || ""} onChange={(e) => applyArchetypeItem(mechanicsCatalog.archetypes?.find((x:any)=>x.key===e.target.value))}>
            <option value="">Native type ({card.type})</option>
            {(mechanicsCatalog.archetypes || []).map((x:any)=><option key={x.key} value={x.key}>{x.name} → {x.baseType}</option>)}
          </select>
        </F>
        <div className="grid gap-3 md:grid-cols-3">
          <F l="Power">
            <input
              className="input"
              type="number"
              value={card.power ?? 0}
              onChange={(e) => set("power", Number(e.target.value))}
            />
          </F>
          <F l="Health">
            <input
              className="input"
              type="number"
              value={card.health ?? 1}
              onChange={(e) => set("health", Number(e.target.value))}
            />
          </F>
          <F l="Race">
            <select
              className="input"
              value={card.race || ""}
              onChange={(e) => set("race", e.target.value || undefined)}
            >
              <option value="">None</option>
              {RACES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </F>
          <F l="Max health / Permanent HP">
            <input
              className="input"
              type="number"
              min={1}
              value={card.maxHealth ?? ""}
              onChange={(e) => set("maxHealth", e.target.value === "" ? undefined : Number(e.target.value))}
            />
          </F>
        </div>
        <div className="mt-5 label">Secondary races</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {RACES.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => toggle("secondaryRaces", x)}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-bold ${(card.secondaryRaces || []).includes(x) ? "border-violet-300/40 bg-violet-400 text-slate-950" : "border-white/10 bg-white/[.04] text-slate-300"}`}
            >
              {x}
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <ToggleField label="Collectible" checked={card.collectible !== false} onChange={(v) => set("collectible", v)} />
          <ToggleField label="Legendary" checked={!!card.isLegend} onChange={(v) => set("isLegend", v)} />
          <ToggleField label="Champion" checked={!!card.isChampion} onChange={(v) => set("isChampion", v)} />
          <F l="Spell speed">
            <select className="input" value={card.speed || ""} onChange={(e) => set("speed", e.target.value || undefined)}>
              <option value="">Normal</option><option value="Fast">Fast</option><option value="Burst">Burst</option>
            </select>
          </F>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <F l="Strategic role">
            <select className="input" value={card.strategicRole || ""} onChange={(e) => set("strategicRole", e.target.value || undefined)}>
              <option value="">Automatic · {strategicRoleForCard({ ...EMPTY, ...card } as CardDef).label}</option>
              {STRATEGIC_ROLES.map((role) => <option key={role} value={role}>{STRATEGIC_ROLE_IDENTITIES[role].icon} {STRATEGIC_ROLE_IDENTITIES[role].label}</option>)}
            </select>
          </F>
          <div className="rounded-xl border border-white/10 bg-black/10 p-3 text-[10px] leading-4 text-slate-400">
            <b className="text-slate-200">Automático por padrão.</b> Use o override somente quando a intenção estratégica não puder ser inferida pelos efeitos, custo ou palavras-chave.
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-white/10 bg-black/10 p-3">
          <div className="label">Cost reduction / Affinity</div>
          <div className="mt-2 grid gap-2 md:grid-cols-4">
            <select className="input" value={card.costReduction?.kind || ""} onChange={(e) => set("costReduction", e.target.value ? { ...(card.costReduction || {}), kind: e.target.value } : undefined)}>
              <option value="">None</option><option value="creatures">Creatures</option><option value="power">Power</option>
            </select>
            <input className="input" type="number" placeholder="per" value={card.costReduction?.per ?? ""} onChange={(e) => set("costReduction", { ...(card.costReduction || { kind: "creatures" }), per: e.target.value === "" ? undefined : Number(e.target.value) })} />
            <input className="input" type="number" placeholder="threshold" value={card.costReduction?.threshold ?? ""} onChange={(e) => set("costReduction", { ...(card.costReduction || { kind: "power" }), threshold: e.target.value === "" ? undefined : Number(e.target.value) })} />
            <input className="input" type="number" placeholder="max" value={card.costReduction?.max ?? ""} onChange={(e) => set("costReduction", { ...(card.costReduction || { kind: "creatures" }), max: e.target.value === "" ? undefined : Number(e.target.value) })} />
          </div>
        </div>
        <div className="mt-5 label">Classes</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {classes.map((x: string) => (
            <button
              key={x}
              onClick={() => toggle("classes", x)}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${(card.classes || []).includes(x) ? "border-amber-300/40 bg-amber-400 text-slate-950" : "border-white/10 bg-white/[.04] text-slate-300 hover:bg-white/10"}`}
            >
              {x}
            </button>
          ))}
        </div>
      </Panel>
      <Panel title="Keywords" eyebrow="RULE TAGS">
        <div className="flex flex-wrap gap-2">
          {KWS.map((x) => (
            <button
              key={x}
              onClick={() => toggle("keywords", x)}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${(card.keywords || []).includes(x) ? "border-cyan-300/40 bg-cyan-400 text-slate-950" : "border-white/10 bg-white/[.04] text-slate-300 hover:bg-white/10"}`}
            >
              {x}
            </button>
          ))}
        </div>
        {!!(mechanicsCatalog.keywords || []).length && <><div className="mt-5 label">Custom mechanics keywords</div><div className="mt-2 flex flex-wrap gap-2">{mechanicsCatalog.keywords.map((x:any)=><button type="button" key={x.key} onClick={()=>toggleCustomKeyword(x)} className={`rounded-full border px-3 py-1.5 text-[10px] font-bold ${(card.customKeywords||[]).includes(x.key)?"border-fuchsia-300/40 bg-fuchsia-400 text-slate-950":"border-white/10 bg-white/[.04] text-slate-300"}`}>{x.icon||"✦"} {x.name}</button>)}</div></>}
        <div className="mt-6 label">Deck doctrine affinity</div>
        <p className="mt-1 text-[10px] leading-4 text-slate-500">Marque em quais doutrinas oficiais esta carta atua como suporte ou assinatura.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {DOCTRINES.map((doctrine) => <button type="button" key={doctrine.id} onClick={() => toggle("doctrineAffinities", doctrine.id)} className={`rounded-xl border p-3 text-left text-[10px] transition ${(card.doctrineAffinities || []).includes(doctrine.id) ? "border-amber-300/40 bg-amber-400/15 text-amber-100" : "border-white/10 bg-white/[.025] text-slate-400 hover:bg-white/[.05]"}`}><b className="mr-2 text-base">{doctrine.icon}</b><span className="font-black">{doctrine.name}</span><small className="mt-1 block text-[8px] uppercase tracking-wider opacity-70">{doctrine.region}</small></button>)}
        </div>
      </Panel>
    </div>
  );
}
