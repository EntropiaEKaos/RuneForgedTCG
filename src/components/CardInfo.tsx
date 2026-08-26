import { getCard } from "@/game/cards";
import { championProgress } from "@/game/engine";
import { KEYWORD_INFO, RACE_INFO } from "@/game/keywords";
import { REGION_STYLE } from "./CardView";
import type { GameState, UnitInstance } from "@/game/types";

interface CardInfoProps {
  defId: string;
  unit?: UnitInstance;
  state?: GameState;
}

export default function CardInfo({ defId, unit, state }: CardInfoProps) {
  const def = getCard(defId);
  const style = REGION_STYLE[def.region];
  const power = unit ? unit.power : def.power;
  const health = unit ? unit.health : def.health;
  const keywords = unit ? unit.keywords : def.keywords ?? [];
  const prog = state && unit ? championProgress(state, unit) : null;

  return (
    <div
      className={`w-64 rounded-xl border-2 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-sm ${style.border}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black leading-tight text-white">
            {def.isChampion && <span className="mr-1">{unit?.leveled ? "✨" : "⭐"}</span>}
            {def.name}
          </p>
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${style.text}`}>
            {def.region} · {def.archetypeName || def.type} · {def.rarity}
            {(def.race || (def.secondaryRaces && def.secondaryRaces.length > 0)) && (
              <span className="ml-1 text-slate-300">
                · {[def.race, ...(def.secondaryRaces ?? [])].filter(Boolean).join("/")}
              </span>
            )}
          </p>
        </div>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white/70 bg-sky-600 text-sm font-black text-white">
          {def.cost}
        </span>
      </div>

      <p className="mt-2 text-xs leading-snug text-slate-200">{def.description}</p>

      {def.type === "Unit" && (
        <p className="mt-2 text-sm font-black text-amber-200">
          <span className="rounded bg-amber-400/20 px-1.5">{power}</span>
          {" / "}
          <span className="rounded bg-rose-400/20 px-1.5">{health}</span>
        </p>
      )}

      {def.speed && (
        <p className="mt-2 text-[11px] font-bold text-violet-300">
          ⚡ {def.speed}: {def.speed === "Burst" ? "may respond to any enemy spell or unit play." : "may respond to enemy unit plays."}
        </p>
      )}

      {def.costReduction && (
        <p className="mt-2 text-[11px] font-bold text-emerald-300">
          🔻 Affinity:{" "}
          {def.costReduction.kind === "creatures"
            ? `costs ${def.costReduction.per ?? 1} less per creature you control`
            : `costs ${def.costReduction.per ?? 1} less per unit with ${def.costReduction.threshold ?? 4}+ power`}
          {def.costReduction.max !== undefined ? ` (max -${def.costReduction.max})` : ""}.
        </p>
      )}

      {unit && unit.equipment.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-white/10 pt-2">
          <li className="text-[10px] font-bold text-cyan-300">⚙️ Equipment</li>
          {unit.equipment.map((eq, i) => {
            const edef = getCard(eq.defId);
            return (
              <li key={`${eq.instanceId}_${i}`} className="text-[11px] leading-snug text-slate-300">
                {edef.emoji} {edef.name} — {edef.description}
              </li>
            );
          })}
        </ul>
      )}

      {def.type === "Enchantment" || def.type === "Artifact" ? (
        <p className="mt-2 border-t border-white/10 pt-2 text-[11px] font-bold text-fuchsia-300">
          ✦ {def.archetypeName || def.type} — {def.maxHealth} HP. Targetable by spells.
        </p>
      ) : null}

      {def.type === "Equipment" && def.equipment && (
        <p className="mt-2 border-t border-white/10 pt-2 text-[11px] font-bold text-cyan-300">
          ⚙️ Equipment: {def.equipment.buffPower >= 0 ? "+" : ""}
          {def.equipment.buffPower}/{def.equipment.buffHealth >= 0 ? "+" : ""}
          {def.equipment.buffHealth}
          {def.equipment.keywords?.map((k) => ` +${k}`).join("")}
        </p>
      )}

      {keywords.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-white/10 pt-2">
          {keywords.map((k) => (
            <li key={k} className="text-[11px] leading-snug text-slate-300">
              <span className="font-bold text-amber-200">
                {KEYWORD_INFO[k].icon} {KEYWORD_INFO[k].name}:
              </span>{" "}
              {KEYWORD_INFO[k].desc}
            </li>
          ))}
        </ul>
      )}

      {prog && !prog.leveled && (
        <div className="mt-2 border-t border-white/10 pt-2">
          <p className="text-[11px] font-bold text-amber-200">
            Level Up: {prog.current}/{prog.goal} — {prog.hint}
          </p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-black/60">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-yellow-300"
              style={{ width: `${Math.round((prog.current / prog.goal) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
