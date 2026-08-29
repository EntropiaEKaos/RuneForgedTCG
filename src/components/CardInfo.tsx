import type { ReactNode } from "react";
import { getCard } from "@/game/cards";
import { championProgressView } from "@/game/champion-progress";
import { inspectRuntimeCard, type CardInspectionTone } from "@/game/card-inspection";
import { KEYWORD_INFO, RACE_INFO } from "@/game/keywords";
import { strategicRoleForCard } from "@/game/card-role";
import { getCardCollection } from "@/game/card-collections";
import { cardRegions, identityForRegions, regionalRuleText } from "@/game/region-identity";
import type { CardDef, GameState, SentinelaInstance, UnitInstance } from "@/game/types";
import { REGION_STYLE } from "./CardView";

interface CardInfoProps {
  defId: string;
  definition?: CardDef;
  unit?: UnitInstance;
  sentinela?: SentinelaInstance;
  state?: GameState;
  costOverride?: number;
}

const signed = (value: number) => value >= 0 ? `+${value}` : String(value);
const toneClasses: Record<CardInspectionTone, string> = {
  buff: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
  debuff: "border-rose-400/25 bg-rose-400/10 text-rose-100",
  state: "border-slate-400/20 bg-white/[.04] text-slate-200",
};

function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-[9px] font-black uppercase tracking-[.18em] text-slate-500">{children}</div>;
}

export default function CardInfo({ defId, definition, unit, sentinela, state, costOverride }: CardInfoProps) {
  const def = definition ?? getCard(defId);
  const style = REGION_STYLE[def.region];
  const keywords = unit ? unit.keywords : def.keywords ?? [];
  const prog = state && unit ? championProgressView(state, unit) : null;
  const runtime = inspectRuntimeCard(def, unit);
  const collection = getCardCollection(def.defId);
  const regions = cardRegions(def);
  const identity = identityForRegions(regions);
  const masteryText = regionalRuleText(def);
  const role = strategicRoleForCard(def);
  const currentCost = costOverride ?? def.cost;
  const costDelta = currentCost - def.cost;
  const races = [def.race, ...(def.secondaryRaces ?? [])].filter(Boolean) as string[];
  const classes = unit?.classes?.length ? unit.classes : def.classes ?? [];
  const mechanicNames = [...new Set((def.mechanics ?? []).map((mechanic) => mechanic.name).filter((name): name is string => Boolean(name)))];
  const inPlay = Boolean(unit || sentinela);
  const runtimeUnit = Boolean(runtime && def.type === "Unit");
  const runtimePermanent = Boolean(runtime && (def.type === "Enchantment" || def.type === "Artifact"));

  return (
    <div
      data-card-intelligence-panel="true"
      className={`w-full rounded-2xl border-2 bg-slate-950/98 p-4 shadow-2xl backdrop-blur-xl ${style.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-base font-black leading-tight text-white">
              {def.isChampion && <span className="mr-1">{unit?.leveled ? "✨" : "⭐"}</span>}
              {def.name}
            </p>
            {inPlay && <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-cyan-200">em jogo</span>}
            {def.collectible === false && <span className="rounded-full border border-slate-400/20 bg-white/[.04] px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-slate-300">não colecionável</span>}
          </div>
          <p className={`mt-1 text-[10px] font-semibold uppercase tracking-wider ${style.text}`}>
            {identity.sigils} {identity.name} · {def.archetypeName || def.type} · {def.rarity}
            {collection ? ` · ${collection.name} (${collection.code})` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] text-slate-300">
            <span className="rounded border border-white/10 bg-white/[.03] px-1.5 py-0.5">{role.icon} {role.label}</span>
            {races.map((race) => {
              const info = RACE_INFO[race];
              return <span key={race} className="rounded border border-white/10 bg-white/[.03] px-1.5 py-0.5">{info?.icon || "◆"} {info?.name || race}</span>;
            })}
            {classes.map((classKey) => <span key={classKey} className="rounded border border-white/10 bg-white/[.03] px-1.5 py-0.5">◇ {classKey}</span>)}
          </div>
        </div>
        <div className="shrink-0 text-center">
          <span className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/70 text-base font-black text-white ${costDelta < 0 ? "bg-emerald-600" : costDelta > 0 ? "bg-rose-600" : "bg-sky-600"}`}>{currentCost}</span>
          {costDelta !== 0 && <div className="mt-1 text-[8px] font-bold text-slate-400">impresso {def.cost} · {signed(costDelta)}</div>}
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-100">{def.description}</p>
      {def.flavor && <p className="mt-2 border-l-2 border-white/10 pl-2 text-[10px] italic leading-relaxed text-slate-500">“{def.flavor}”</p>}

      {runtimeUnit && runtime && (
        <section className="mt-4 border-t border-white/10 pt-3">
          <SectionTitle>Estado em jogo</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/[.06] p-2.5">
              <div className="text-[8px] font-black uppercase tracking-wider text-amber-300">Poder</div>
              <div className="mt-1 flex items-baseline gap-2"><b className="text-xl text-amber-100">{runtime.currentPower}</b><span className="text-[9px] text-slate-500">impresso {runtime.printedPower}</span></div>
              <div className={`text-[9px] font-bold ${runtime.powerDelta > 0 ? "text-emerald-300" : runtime.powerDelta < 0 ? "text-rose-300" : "text-slate-500"}`}>total {signed(runtime.powerDelta)}</div>
              {(runtime.equipmentPower !== 0 || runtime.otherPowerModifier !== 0) && <div className="mt-1 text-[8px] leading-relaxed text-slate-400">Equip. {signed(runtime.equipmentPower)} · Efeitos {signed(runtime.otherPowerModifier)}</div>}
            </div>
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/[.06] p-2.5">
              <div className="text-[8px] font-black uppercase tracking-wider text-rose-300">Vida</div>
              <div className="mt-1 flex items-baseline gap-2"><b className="text-xl text-rose-100">{runtime.currentHealth}/{runtime.currentMaxHealth}</b><span className="text-[9px] text-slate-500">impressa {runtime.printedHealth}</span></div>
              <div className="text-[9px] text-slate-400">máx. {signed(runtime.maxHealthDelta)} · dano sofrido {runtime.damageTaken}</div>
              {(runtime.equipmentHealth !== 0 || runtime.otherHealthModifier !== 0 || runtime.permanentHealthModifier !== 0) && <div className="mt-1 text-[8px] leading-relaxed text-slate-400">Equip. {signed(runtime.equipmentHealth)} · Efeitos {signed(runtime.otherHealthModifier)} · Permanente {signed(runtime.permanentHealthModifier)}</div>}
            </div>
          </div>

          {runtime.statuses.length > 0 && (
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {runtime.statuses.map((status) => <div key={status.id} className={`rounded-lg border px-2 py-1.5 ${toneClasses[status.tone]}`}><div className="text-[9px] font-black">{status.label}</div><div className="mt-0.5 text-[8px] leading-relaxed opacity-75">{status.detail}</div></div>)}
            </div>
          )}
        </section>
      )}

      {runtimePermanent && runtime && (
        <section className="mt-4 border-t border-white/10 pt-3">
          <SectionTitle>Estado em jogo</SectionTitle>
          <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/[.06] p-2.5">
            <div className="text-[8px] font-black uppercase tracking-wider text-fuchsia-300">Integridade</div>
            <div className="mt-1 flex items-baseline gap-2"><b className="text-xl text-fuchsia-100">{runtime.currentHealth}/{runtime.currentMaxHealth}</b><span className="text-[9px] text-slate-500">impressa {runtime.printedHealth}</span></div>
            <div className="text-[9px] text-slate-400">dano sofrido {runtime.damageTaken}</div>
          </div>
        </section>
      )}

      {def.type === "Unit" && !runtime && (
        <div className="mt-3 flex gap-2 text-sm font-black">
          <span className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-amber-200">⚔ {def.power ?? 0} poder</span>
          <span className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-2 py-1 text-rose-200">♥ {def.health ?? 0} vida</span>
        </div>
      )}

      {def.type === "Sentinela" && def.sentinela && (
        <section className="mt-4 border-t border-white/10 pt-3">
          <SectionTitle>Sentinela</SectionTitle>
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/[.06] p-2.5">
            <div className="flex items-center justify-between gap-3">
              <div><div className="text-[8px] font-black uppercase tracking-wider text-amber-300">Lealdade</div><div className="mt-1 flex items-baseline gap-2"><b className="text-xl text-amber-100">{sentinela?.loyalty ?? def.sentinela.startingLoyalty}</b><span className="text-[9px] text-slate-500">inicial {def.sentinela.startingLoyalty}</span></div></div>
              {sentinela && <span className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-wider ${sentinela.activatedThisTurn ? "border-slate-400/20 bg-white/[.04] text-slate-400" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"}`}>{sentinela.activatedThisTurn ? "habilidade usada" : "habilidade disponível"}</span>}
            </div>
            {sentinela && sentinela.loyalty !== def.sentinela.startingLoyalty && <div className={`mt-1 text-[9px] font-bold ${sentinela.loyalty > def.sentinela.startingLoyalty ? "text-emerald-300" : "text-rose-300"}`}>alteração {signed(sentinela.loyalty - def.sentinela.startingLoyalty)}</div>}
          </div>
          <div className="mt-2 space-y-1.5">
            {def.sentinela.abilities.map((ability, index) => <div key={`${ability.cost}-${index}`} className="rounded-lg border border-white/10 bg-white/[.025] px-2 py-1.5 text-[9px] leading-relaxed text-slate-300"><b className={ability.cost >= 0 ? "text-emerald-200" : "text-rose-200"}>{ability.cost > 0 ? `+${ability.cost}` : ability.cost} lealdade</b> — {ability.description}</div>)}
          </div>
        </section>
      )}

      <section className="mt-4 border-t border-white/10 pt-3">
        <SectionTitle>Regras e propriedades</SectionTitle>
        <div className="space-y-1.5 text-[10px] leading-relaxed text-slate-300">
          {def.speed && <p><span className="font-black text-violet-300">⚡ {def.speed}:</span> {def.speed === "Burst" ? "pode responder a feitiços ou unidades inimigas." : "pode responder a unidades inimigas."}</p>}
          {def.costReduction && <p><span className="font-black text-emerald-300">🔻 Afinidade:</span> {def.costReduction.kind === "creatures" ? `custa ${def.costReduction.per ?? 1} a menos por criatura que você controla` : `custa ${def.costReduction.per ?? 1} a menos por unidade com ${def.costReduction.threshold ?? 4}+ de poder`}{def.costReduction.max !== undefined ? ` (máx. -${def.costReduction.max})` : ""}.</p>}
          {masteryText && <p><span className="font-black text-cyan-300">◆ Identidade regional:</span> {masteryText}</p>}
          {def.type === "Enchantment" || def.type === "Artifact" ? <p><span className="font-black text-fuchsia-300">✦ {def.archetypeName || def.type}:</span> {def.maxHealth ?? runtime?.printedHealth ?? 0} de vida · pode ser alvo de efeitos compatíveis.</p> : null}
          {def.type === "Equipment" && def.equipment && <p><span className="font-black text-cyan-300">⚙ Equipamento:</span> {signed(def.equipment.buffPower)}/{signed(def.equipment.buffHealth)}{def.equipment.keywords?.length ? ` · concede ${def.equipment.keywords.join(", ")}` : ""}.</p>}
          {def.customKeywords?.length ? <p><span className="font-black text-amber-300">✦ Habilidades customizadas:</span> {def.customKeywords.join(", ")}.</p> : null}
          {mechanicNames.length ? <p><span className="font-black text-sky-300">◈ Mecânicas adicionais:</span> {mechanicNames.join(", ")}.</p> : null}
          {def.doctrineAffinities?.length ? <p><span className="font-black text-indigo-300">◇ Sinergia de doutrina:</span> {def.doctrineAffinities.join(", ")}.</p> : null}
        </div>
      </section>

      {unit && unit.equipment.length > 0 && (
        <section className="mt-3 border-t border-white/10 pt-3">
          <SectionTitle>Equipamentos anexados</SectionTitle>
          <div className="space-y-1.5">
            {unit.equipment.map((equipment, index) => {
              const equipmentDef = getCard(equipment.defId);
              return <div key={`${equipment.instanceId}_${index}`} className="rounded-lg border border-cyan-400/15 bg-cyan-400/[.05] px-2 py-1.5 text-[9px] leading-relaxed text-slate-300"><b className="text-cyan-200">{equipmentDef.emoji} {equipmentDef.name}</b>{equipmentDef.equipment ? ` · ${signed(equipmentDef.equipment.buffPower)}/${signed(equipmentDef.equipment.buffHealth)}` : ""} — {equipmentDef.description}</div>;
            })}
          </div>
        </section>
      )}

      {keywords.length > 0 && (
        <section className="mt-3 border-t border-white/10 pt-3">
          <SectionTitle>Habilidades ativas</SectionTitle>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {keywords.map((keyword) => {
              const gained = runtime?.gainedKeywords.includes(keyword);
              return <div key={keyword} className={`rounded-lg border px-2 py-1.5 text-[9px] leading-relaxed ${gained ? "border-emerald-400/20 bg-emerald-400/[.06] text-emerald-100" : "border-white/10 bg-white/[.025] text-slate-300"}`}><b className={gained ? "text-emerald-200" : "text-amber-200"}>{KEYWORD_INFO[keyword].icon} {KEYWORD_INFO[keyword].name}{gained ? " · ganha" : ""}</b><div className="mt-0.5 opacity-75">{KEYWORD_INFO[keyword].desc}</div></div>;
            })}
          </div>
        </section>
      )}

      {prog && !prog.leveled && (
        <section className="mt-3 border-t border-white/10 pt-3">
          <SectionTitle>Evolução do campeão</SectionTitle>
          <p className="text-[10px] font-bold text-amber-200">{prog.current}/{prog.goal} — {prog.hint}</p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded bg-black/60"><div className="h-full bg-gradient-to-r from-amber-400 to-yellow-300" style={{ width: `${Math.min(100, Math.round((prog.current / prog.goal) * 100))}%` }} /></div>
        </section>
      )}
    </div>
  );
}
