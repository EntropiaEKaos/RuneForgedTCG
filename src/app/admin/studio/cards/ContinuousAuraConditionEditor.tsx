"use client";

import { CARD_RACES } from "@/game/card-authoring";
import {
  CONDITION_MAX_SUPPORTED_DEPTH,
  conditionCanAddChild,
  conditionKindsAtDepth,
} from "@/game/condition-contract";
import type { MechanicCondition } from "@/game/types";

const auraKindsAtDepth = (depth: number, allowSelfDamaged: boolean) =>
  conditionKindsAtDepth(depth).filter((kind) => allowSelfDamaged || kind !== "selfDamaged");

function defaultAuraCondition(kind: string): MechanicCondition {
  if (kind === "and" || kind === "or") {
    return { kind, children: [{ kind: "always" }, { kind: "allyRace", race: "Dragon", min: 1 }] } as MechanicCondition;
  }
  if (kind === "not") return { kind: "not", child: { kind: "allyRace", race: "Dragon", min: 1 } };
  if (kind === "selfDamaged") return { kind: "selfDamaged" };
  if (kind === "allyRace" || kind === "enemyRace") return { kind, race: "Dragon", min: 1 } as MechanicCondition;
  if (kind === "allyClass" || kind === "enemyClass") return { kind, classKey: "mage", min: 1 } as MechanicCondition;
  if (kind === "nexusBelow" || kind === "opponentNexusBelow" || kind === "manaAtLeast") return { kind, amount: 1 } as MechanicCondition;
  return { kind: "always" };
}

export default function ContinuousAuraConditionEditor({
  value,
  onChange,
  depth = 0,
  allowSelfDamaged = false,
}: {
  value: MechanicCondition;
  onChange: (value: MechanicCondition) => void;
  depth?: number;
  allowSelfDamaged?: boolean;
}) {
  const availableKinds = auraKindsAtDepth(depth, allowSelfDamaged);
  const safeValue = availableKinds.includes(value.kind as typeof availableKinds[number]) ? value : ({ kind: "always" } as MechanicCondition);
  const kind = safeValue.kind;
  const depthLimited = depth >= CONDITION_MAX_SUPPORTED_DEPTH;

  const groupChildren = kind === "and" || kind === "or" ? safeValue.children : [];
  const canAddGroupChild = (kind === "and" || kind === "or") && conditionCanAddChild({ kind, children: groupChildren }, depth);

  return (
    <div data-aura-condition-editor data-condition-depth={depth} className={`rounded-xl border ${depth ? "border-cyan-300/15 bg-cyan-300/[.03]" : "border-amber-300/15 bg-amber-300/[.03]"} p-3`}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="label">{depth ? `Condição #${depth + 1}` : "Condição da Aura"}</span>
          <select className="input" value={kind} onChange={(event) => onChange(defaultAuraCondition(event.target.value))}>
            {availableKinds.map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}
          </select>
        </label>

        {kind === "selfDamaged" && <div className="rounded-lg border border-rose-300/15 bg-rose-300/5 px-3 py-2 text-[10px] leading-4 text-rose-100/80">Ativa enquanto a própria Unit-fonte tiver dano marcado: vida atual menor que a vida máxima.</div>}

        {(kind === "allyRace" || kind === "enemyRace") && <>
          <label className="block"><span className="label">{kind === "allyRace" ? "Raça aliada" : "Raça inimiga"}</span><select className="input" value={safeValue.race} onChange={(event) => onChange({ ...safeValue, race: event.target.value as typeof safeValue.race })}>{CARD_RACES.map((race) => <option key={race}>{race}</option>)}</select></label>
          <label className="block"><span className="label">Mínimo</span><input className="input" type="number" min={1} max={6} value={safeValue.min} onChange={(event) => onChange({ ...safeValue, min: Number(event.target.value) })} /></label>
        </>}

        {(kind === "allyClass" || kind === "enemyClass") && <>
          <label className="block"><span className="label">{kind === "allyClass" ? "Classe aliada" : "Classe inimiga"}</span><input className="input font-mono" value={safeValue.classKey} onChange={(event) => onChange({ ...safeValue, classKey: event.target.value })} placeholder="mage" /></label>
          <label className="block"><span className="label">Mínimo</span><input className="input" type="number" min={1} max={6} value={safeValue.min} onChange={(event) => onChange({ ...safeValue, min: Number(event.target.value) })} /></label>
        </>}

        {(kind === "nexusBelow" || kind === "opponentNexusBelow" || kind === "manaAtLeast") && <label className="block"><span className="label">{kind === "nexusBelow" ? "Seu Nexus ≤" : kind === "opponentNexusBelow" ? "Nexus inimigo ≤" : "Mana ≥"}</span><input className="input" type="number" min={0} max={20} value={safeValue.amount} onChange={(event) => onChange({ ...safeValue, amount: Number(event.target.value) })} /></label>}
      </div>

      {depthLimited && <p className="mt-3 text-[10px] leading-4 text-amber-100/75">Profundidade máxima do contrato atingida; apenas folhas válidas permanecem disponíveis.</p>}

      {(kind === "and" || kind === "or") && <div className="mt-3 space-y-2">
        {groupChildren.map((child, index) => (
          <div key={index} className="relative">
            <ContinuousAuraConditionEditor
              value={child}
              depth={depth + 1}
              allowSelfDamaged={allowSelfDamaged}
              onChange={(nextChild) => onChange({ kind, children: groupChildren.map((candidate, childIndex) => childIndex === index ? nextChild : candidate) })}
            />
            {groupChildren.length > 1 && <button type="button" className="btn-ghost absolute right-2 top-2 !px-2 !py-1 text-[10px] text-red-300" onClick={() => onChange({ kind, children: groupChildren.filter((_, childIndex) => childIndex !== index) })}>Remover</button>}
          </div>
        ))}
        {canAddGroupChild ? <button type="button" className="btn-ghost text-xs" onClick={() => onChange({ kind, children: [...groupChildren, { kind: "always" }] })}>＋ Condição</button> : <span className="text-[10px] text-slate-500">Limite estrutural do grupo atingido.</span>}
      </div>}

      {kind === "not" && <div className="mt-3"><ContinuousAuraConditionEditor value={safeValue.child} depth={depth + 1} allowSelfDamaged={allowSelfDamaged} onChange={(child) => onChange({ kind: "not", child })} /></div>}
    </div>
  );
}
