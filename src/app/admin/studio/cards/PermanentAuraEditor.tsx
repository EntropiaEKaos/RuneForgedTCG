"use client";

import { CARD_RACES } from "@/game/card-authoring";
import { AURA_GRANTABLE_KEYWORDS, AURA_SUPPRESSIBLE_KEYWORDS } from "@/game/keywords";
import type { MechanicCondition } from "@/game/types";
import ContinuousAuraConditionEditor from "./ContinuousAuraConditionEditor";
import { F, Panel } from "./CardAuthoringFields";
import type { CardAuthoringModel } from "./CardAuthoringModel";

export default function PermanentAuraEditor({ model }: { model: CardAuthoringModel }) {
  const { card, set } = model;
  if (card.type !== "Unit" && card.type !== "Sentinela" && card.type !== "Enchantment" && card.type !== "Artifact") return null;
  const unitSource = card.type === "Unit";
  const sentinelaSource = card.type === "Sentinela";
  const aura = card.aura as {
    buffPower: number;
    buffHealth: number;
    keywords?: string[];
    suppressKeywords?: string[];
    races?: string[];
    classes?: string[];
    affects?: "allies" | "enemies";
    condition?: MechanicCondition;
  } | undefined;
  const audience = aura?.affects ?? "allies";
  const enemyAura = audience === "enemies";
  const update = (patch: Record<string, unknown>) => set("aura", { ...(aura || { buffPower: 1, buffHealth: 0 }), ...patch });

  const setAudience = (next: "allies" | "enemies") => {
    if (!aura) return;
    if (next === "enemies") {
      let buffPower = aura.buffPower > 0 ? -aura.buffPower : aura.buffPower;
      const buffHealth = aura.buffHealth > 0 ? -aura.buffHealth : aura.buffHealth;
      if (buffPower === 0 && buffHealth === 0 && !(aura.suppressKeywords?.length)) buffPower = -1;
      set("aura", {
        ...aura,
        affects: "enemies",
        buffPower,
        buffHealth,
        keywords: [],
      });
      return;
    }
    set("aura", {
      ...aura,
      affects: "allies",
      buffPower: aura.buffPower < 0 ? Math.abs(aura.buffPower) : aura.buffPower,
      buffHealth: aura.buffHealth < 0 ? Math.abs(aura.buffHealth) : aura.buffHealth,
      suppressKeywords: [],
    });
  };

  const sourceLabel = sentinelaSource ? "Sentinela Command Aura" : unitSource ? "Unit Lord Effect" : "Permanent Aura";

  return (
    <Panel title="Continuous Aura" eyebrow="CONDITION 2.9 — MATCH PROGRESS THRESHOLDS">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl space-y-2 text-xs leading-5 text-slate-400">
          <p>
            Enquanto esta fonte permanecer ativa e sua condição opcional for verdadeira, a Aura recalcula continuamente as unidades elegíveis. Auras aliadas concedem stats/keywords; Auras inimigas reduzem stats e/ou suprimem keywords. A origem durável nunca é apagada.
          </p>
          <p className="rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-cyan-100/80">
            {sourceLabel}: {unitSource
              ? "a própria Unit-fonte é sempre excluída do efeito; outras fontes podem afetá-la normalmente. `selfDamaged` pode observar o dano marcado desta Unit-fonte."
              : sentinelaSource
                ? "a Aura permanece disponível enquanto a Sentinela tiver Lealdade positiva no battlefield."
                : "a Aura permanece disponível enquanto a permanente estiver viva no battlefield."}
          </p>
        </div>
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
              const label = value === "allies"
                ? (unitSource ? "Outras unidades aliadas" : "Unidades aliadas")
                : "Unidades inimigas";
              return <button type="button" key={value} onClick={() => setAudience(value)} className={`rounded-full border px-3 py-1 text-[11px] ${selected ? "bg-amber-300 text-slate-950" : "border-white/10"}`}>{selected ? "✓ " : ""}{label}</button>;
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
          <div className="label">Keywords concedidas continuamente — opcional</div>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">Barrier e LastBreath ficam fora por dependerem de estado consumível/trigger próprio.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {AURA_GRANTABLE_KEYWORDS.map((keyword) => {
              const selected = (aura.keywords ?? []).includes(keyword);
              return <button type="button" key={keyword} onClick={() => update({ keywords: selected ? (aura.keywords ?? []).filter((item: string) => item !== keyword) : [...(aura.keywords ?? []), keyword] })} className={`rounded-full border px-2 py-1 text-[10px] ${selected ? "bg-violet-300 text-slate-950" : "border-white/10"}`}>{selected ? "✓ " : ""}{keyword}</button>;
            })}
          </div>
        </div> : <div>
          <div className="label">Keywords suprimidas continuamente — opcional</div>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">A supressão vence grants enquanto a fonte está ativa, mas não apaga sua origem. Barrier e LastBreath não são suprimíveis.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {AURA_SUPPRESSIBLE_KEYWORDS.map((keyword) => {
              const selected = (aura.suppressKeywords ?? []).includes(keyword);
              return <button type="button" key={keyword} onClick={() => update({ suppressKeywords: selected ? (aura.suppressKeywords ?? []).filter((item: string) => item !== keyword) : [...(aura.suppressKeywords ?? []), keyword] })} className={`rounded-full border px-2 py-1 text-[10px] ${selected ? "bg-rose-300 text-slate-950" : "border-white/10"}`}>{selected ? "✓ " : ""}{keyword}</button>;
            })}
          </div>
        </div>}

        <div className="rounded-xl border border-amber-300/10 bg-amber-300/[.02] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="label">Condição da fonte — opcional</div>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">{unitSource
                ? "Pode depender de raça/classe aliada ou inimiga, quantidade de Units vivas aliadas ou inimigas, quantidade de Permanents vivas aliadas ou inimigas, quantidade de Sentinelas com Lealdade positiva aliadas ou inimigas, progresso público da partida (feitiços conjurados, aliados invocados e dano ao Nexus próprios/inimigos), rodada atual, vida do próprio Nexus, vida do Nexus inimigo, mana normal própria/inimiga, mana de magia própria/inimiga, tamanho da própria mão ou da mão inimiga, dano marcado na própria Unit-fonte (`selfDamaged`) e composição AND/OR/NOT."
                : "Pode depender de raça/classe aliada ou inimiga, quantidade de Units vivas aliadas ou inimigas, quantidade de Permanents vivas aliadas ou inimigas, quantidade de Sentinelas com Lealdade positiva aliadas ou inimigas, progresso público da partida (feitiços conjurados, aliados invocados e dano ao Nexus próprios/inimigos), rodada atual, vida do próprio Nexus, vida do Nexus inimigo, mana normal própria/inimiga, mana de magia própria/inimiga, tamanho da própria mão ou da mão inimiga e composição AND/OR/NOT. `selfDamaged` é exclusivo de Unit-source porque Permanent e Sentinela não possuem o mesmo contrato de vida de Unit."}</p>
            </div>
            <button type="button" className="btn-ghost text-xs" onClick={() => update({ condition: aura.condition ? undefined : { kind: "allyRace", race: "Dragon", min: 1 } })}>{aura.condition ? "Remover condição" : "+ Condição"}</button>
          </div>
          {aura.condition && <div className="mt-3"><ContinuousAuraConditionEditor value={aura.condition} allowSelfDamaged={unitSource} onChange={(condition) => update({ condition })} /></div>}
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
        <p className="text-[11px] leading-5 text-slate-500">A condição decide se a fonte participa do layer; os filtros decidem quais Units ela afeta. Dentro de cada filtro vale OU; raça + classe combinam como E. Múltiplas Auras somam stats e unem grants/supressões sem duplicatas. Durable + grants são calculados antes das supressões hostis.{unitSource ? " A própria Unit-fonte nunca conta como alvo da sua Aura, e seu dano marcado controla `selfDamaged` sem ser criado por mudanças do teto de vida." : sentinelaSource ? " Lealdade 0 encerra a Command Aura na mesma transição de cleanup." : ""}</p>
      </div>}
    </Panel>
  );
}
