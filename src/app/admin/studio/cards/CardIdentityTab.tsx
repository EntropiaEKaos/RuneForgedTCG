"use client";
import { F, Panel } from "./CardAuthoringFields";
import {
  CARD_REGIONS as REGIONS,
  CARD_TYPES as TYPES,
  CARD_RARITIES as RARITIES,
  CARD_REGIONAL_PERKS as REGIONAL_PERKS,
} from "@/game/card-authoring";
import { REGION_IDENTITY_STYLE } from "@/game/region-identity";

import type { CardAuthoringModel } from "./CardAuthoringModel";

export default function CardIdentityTab({ model }: { model: CardAuthoringModel }) {
  const { card, id, set, setPrimaryRegion, authoredRegions, toggleAuthoredRegion, regionIdentity } = model;
  return (
    <Panel title="Identity" eyebrow="CARD DEFINITION">
      <div className="grid gap-3 md:grid-cols-3">
        <F l="Name">
          <input
            className="input"
            value={card.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Fire Drake"
          />
        </F>
        <F l="defId">
          <input
            className="input font-mono"
            value={card.defId}
            disabled={id !== null}
            onChange={(e) => set("defId", e.target.value)}
            placeholder="fire_drake"
          />
        </F>
        <F l="Emoji">
          <input className="input" value={card.emoji} onChange={(e) => set("emoji", e.target.value)} />
        </F>
        <F l="Region">
          <select className="input" value={card.region} onChange={(e) => setPrimaryRegion(e.target.value)}>
            {REGIONS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </F>
        <F l="Regional identity" x="md:col-span-2">
          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[.04] p-4">
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((region) => {
                const active = authoredRegions.includes(region);
                const primary = card.region === region;
                return <button type="button" key={region} onClick={() => toggleAuthoredRegion(region)} disabled={primary}
                  className={["rounded-full border px-3 py-1.5 text-[10px] font-black transition", active ? "border-cyan-300/50 bg-cyan-400 text-slate-950" : "border-white/10 bg-white/[.03] text-slate-400"].join(" ")}>
                  {REGION_IDENTITY_STYLE[region].sigil} {region}{primary ? " · PRIMARY" : ""}
                </button>;
              })}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px]">
              <div><small className="font-black tracking-[.15em] text-cyan-300">{regionIdentity.tier.toUpperCase()} IDENTITY</small><b className="mt-1 block text-sm text-white">{regionIdentity.sigils} {regionIdentity.name}</b><p className="mt-1 text-[10px] text-slate-400">{regionIdentity.description}</p></div>
              <label className="text-[10px] font-black text-slate-400">MASTERY REWARD<select className="input mt-1" value={card.regionalPerk || "convergence"} onChange={(event) => set("regionalPerk", event.target.value)} disabled={authoredRegions.length < 2}>{REGIONAL_PERKS.map((perk) => <option key={perk} value={perk}>{perk === "convergence" ? "Cost -1" : perk === "assault" ? "+1 Power" : "+1 Health"}</option>)}</select></label>
            </div>
            <p className="mt-3 text-[9px] text-amber-200/80">A Maestria só ativa quando a identidade completa do deck coincide exatamente com a identidade desta carta.</p>
          </div>
        </F>
        <F l="Type">
          <select className="input" value={card.type} onChange={(e) => set("type", e.target.value)}>
            {TYPES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </F>
        <F l="Rarity">
          <select className="input" value={card.rarity} onChange={(e) => set("rarity", e.target.value)}>
            {RARITIES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </F>
        <F l="Cost">
          <input
            type="number"
            className="input"
            min="0"
            max="20"
            value={card.cost}
            onChange={(e) => set("cost", Number(e.target.value))}
          />
        </F>
        <F l="Art URL">
          <input
            className="input"
            value={card.art || ""}
            onChange={(e) => set("art", e.target.value)}
            placeholder="https://…"
          />
        </F>
      </div>
      <F l="Description" x="mt-4">
        <textarea
          className="input min-h-28"
          value={card.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Describe what the player sees and what the card does."
        />
      </F>
      <F l="Flavor / lore" x="mt-4">
        <textarea
          className="input min-h-20 italic"
          value={card.flavor || ""}
          maxLength={280}
          onChange={(e) => set("flavor", e.target.value)}
          placeholder="Texto narrativo da carta — não altera regras."
        />
      </F>
    </Panel>
  );
}
