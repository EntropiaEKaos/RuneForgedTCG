"use client";

import { CARD_RACES } from "@/game/card-authoring";
import { AURA_GRANTABLE_KEYWORDS } from "@/game/keywords";
import { F, Panel } from "./CardAuthoringFields";
import type { CardAuthoringModel } from "./CardAuthoringModel";

export default function PermanentAuraEditor({ model }: { model: CardAuthoringModel }) {
  const { card, set } = model;
  if (card.type !== "Enchantment" && card.type !== "Artifact") return null;
  const aura = card.aura as {
    buffPower: number;
    buffHealth: number;
    keywords?: string[];
    races?: string[];
    classes?: string[];
    affects?: "allies" | "enemies";
  } | undefined;
  const audience = aura?.affects ?? "allies";
  const enemyAura = audience === "enemies";
  const update = (patch: Record<string, unknown>) => set("aura", { ...(aura || { buffPower: 1, buffHealth: 0 }), ...patch });

  const setAudience = (next: "allies" | "enemies") => {
    if (!aura) return;
    if (next === "enemies") {
      let buffPower = aura.buffPower > 0 ? -aura.buffPower : aura.buffPower;
      const buffHealth = aura.buffHealth > 0 ? -aura.buffHealth : aura.buffHealth;
      if (buffPower === 0 && buffHealth === 0) buffPower = -1;
      set("aura", { ...aura, affects: "enemies", buffPower, buffHealth, keywords: [] });
      return;
    }
    set("aura", {
      ...aura,
      affects: "allies",
      buffPower: aura.buffPower < 0 ? Math.abs(aura.buffPower) : aura.buffPower,
      buffHealth: aura.buffHealth < 0 ? Math.abs(aura.buffHealth) : aura.buffHealth,
    });
  };

  return (
    <Panel title="Continuous Aura" eyebrow="AURA 2.1 — ALLY BUFFS + ENEMY DEBUFFS">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-xs leading-5 text-slate-400">
          Enquanto esta fonte permanecer em jogo, a Aura recalcula continuamente as unidades elegíveis. Auras aliadas concedem stats/keywords; Auras inimigas aplicam apenas reduções de Power/Health. Dano marcado e grants duráveis são preservados quando a fonte entra ou sai.
        </p>
        <button type="button" className="btn-ghost text-xs" onClick={() => set("aura", aura ? undefined : { buffPower: 1, buffHealth: 0 })}>
          {aura ? "Remover Aura" : "+ Ativar Aura"}
        </button>
      </div>
      {aura && <div className="mt-4 space-y-4">
        <div>
          <div className="label">Afeta</div>
          <div className="mt-2 flex gap-2">
            {(["allies", "enemies"] as const).map((value) => {
              const selected = audience === value;
              return <button type="button" key={value} onClick={() => setAudience(value)} className={`rounded-full border px-3 py-1 text-[11px] ${selected ? "bg-amber-300 text-slate-950" : "border-white/10"}`}>{selected ? "✓ " : ""}{value === "allies" ? "Unidades aliadas" : "Unidades inimigas"}</button>;
            })}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <F l={enemyAura ? "Modificador de Poder" : "Bônus de Poder"}>
            <input className="input" type="number" min={enemyAura ? -20 : 0} max={enemyAura ? 0 : 20} value={aura.buffPower ?? 0} onChange={(e) => update({ buffPower: Number(e.target.value) })} />
          </F>
          <F l={enemyAura ? "Modificador de Vida" : "Bônus de Vida"}>
            <input className="input" type="number" min={enemyAura ? -20 : 0} max={enemyAura ? 0 : 20} value={aura.buffHealth ?? 0} onChange={(e) => update({ buffHealth: Number(e.target.value) })} />
          </F>
        </div>
        {!enemyAura ? <div>
          <div className="label">Keywords contínuas — opcional</div>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">Barrier e LastBreath ficam fora deste corte por dependerem de estado consumível/trigger próprio.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {AURA_GRANTABLE_KEYWORDS.map((keyword) => {
              const selected = (aura.keywords ?? []).includes(keyword);
              return <button type="button" key={keyword} onClick={() => update({ keywords: selected ? (aura.keywords ?? []).filter((item: string) => item !== keyword) : [...(aura.keywords ?? []), keyword] })} className={`rounded-full border px-2 py-1 text-[10px] ${selected ? "bg-violet-300 text-slate-950" : "border-white/10"}`}>{selected ? "✓ " : ""}{keyword}</button>;
            })}
          </div>
        </div> : <p className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-[11px] leading-5 text-amber-100/80">Aura 2.1 não remove nem concede keywords a inimigos. Esse comportamento exige o futuro sistema genérico de layers/sub-layers.</p>}
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
        <p className="text-[11px] leading-5 text-slate-500">Dentro de cada filtro vale OU; raça + classe combinam como E. Múltiplas Auras somam os modificadores. Reduções de Power do layer contínuo nunca levam o Power efetivo abaixo de 0.</p>
      </div>}
    </Panel>
  );
}
