"use client";

import { CARD_RACES } from "@/game/card-authoring";
import { AURA_GRANTABLE_KEYWORDS } from "@/game/keywords";
import { F, Panel } from "./CardAuthoringFields";
import type { CardAuthoringModel } from "./CardAuthoringModel";

export default function PermanentAuraEditor({ model }: { model: CardAuthoringModel }) {
  const { card, set } = model;
  if (card.type !== "Enchantment" && card.type !== "Artifact") return null;
  const aura = card.aura as { buffPower: number; buffHealth: number; keywords?: string[]; races?: string[]; classes?: string[] } | undefined;
  const update = (patch: Record<string, unknown>) => set("aura", { ...(aura || { buffPower: 1, buffHealth: 0 }), ...patch });

  return (
    <Panel title="Continuous Aura" eyebrow="AURA 2.0 — STATS + KEYWORDS">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-xs leading-5 text-slate-400">
          Enquanto esta fonte permanecer em jogo, unidades aliadas elegíveis recebem atributos e/ou keywords contínuas. Ao remover a fonte, somente a contribuição da Aura sai; dano e grants duráveis são preservados.
        </p>
        <button type="button" className="btn-ghost text-xs" onClick={() => set("aura", aura ? undefined : { buffPower: 1, buffHealth: 0 })}>
          {aura ? "Remover Aura" : "+ Ativar Aura"}
        </button>
      </div>
      {aura && <div className="mt-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <F l="Bônus de Poder"><input className="input" type="number" min={0} max={20} value={aura.buffPower ?? 0} onChange={(e) => update({ buffPower: Number(e.target.value) })} /></F>
          <F l="Bônus de Vida"><input className="input" type="number" min={0} max={20} value={aura.buffHealth ?? 0} onChange={(e) => update({ buffHealth: Number(e.target.value) })} /></F>
        </div>
        <div>
          <div className="label">Keywords contínuas — opcional</div>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">Barrier e LastBreath ficam fora deste corte por dependerem de estado consumível/trigger próprio.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {AURA_GRANTABLE_KEYWORDS.map((keyword) => {
              const selected = (aura.keywords ?? []).includes(keyword);
              return <button type="button" key={keyword} onClick={() => update({ keywords: selected ? (aura.keywords ?? []).filter((item: string) => item !== keyword) : [...(aura.keywords ?? []), keyword] })} className={`rounded-full border px-2 py-1 text-[10px] ${selected ? "bg-violet-300 text-slate-950" : "border-white/10"}`}>{selected ? "✓ " : ""}{keyword}</button>;
            })}
          </div>
        </div>
        <div>
          <div className="label">Raças elegíveis — opcional</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {CARD_RACES.map((race) => {
              const selected = (aura.races ?? []).includes(race);
              return <button type="button" key={race} onClick={() => update({ races: selected ? (aura.races ?? []).filter((item: string) => item !== race) : [...(aura.races ?? []), race] })} className={`rounded-full border px-2 py-1 text-[10px] ${selected ? "bg-cyan-300 text-slate-950" : "border-white/10"}`}>{selected ? "✓ " : ""}{race}</button>;
            })}
          </div>
        </div>
        <F l="Classes elegíveis — IDs separados por vírgula">
          <input className="input font-mono text-xs" value={(aura.classes ?? []).join(", ")} onChange={(e) => update({ classes: e.target.value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean) })} placeholder="guardian, warrior" />
        </F>
        <p className="text-[11px] leading-5 text-slate-500">Dentro de cada filtro vale OU. Com raça e classe ao mesmo tempo, a unidade precisa satisfazer os dois grupos. Múltiplas Auras somam stats e unem keywords sem duplicatas.</p>
      </div>}
    </Panel>
  );
}
