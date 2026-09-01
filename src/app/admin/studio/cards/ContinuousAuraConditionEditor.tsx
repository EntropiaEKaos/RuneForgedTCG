"use client";

import { CARD_RACES } from "@/game/card-authoring";
import {
  CONDITION_MAX_SUPPORTED_DEPTH,
  conditionCanAddChild,
  conditionKindsAtDepth,
} from "@/game/condition-contract";
import type { MechanicCondition } from "@/game/types";

const auraKindsAtDepth = (depth: number) => conditionKindsAtDepth(depth).filter((kind) => kind !== "selfDamaged");

function defaultAuraCondition(kind: string): MechanicCondition {
  if (kind === "and" || kind === "or") {
    return { kind, children: [{ kind: "always" }, { kind: "allyRace", race: "Dragon", min: 1 }] } as MechanicCondition;
  }
  if (kind === "not") return { kind: "not", child: { kind: "allyRace", race: "Dragon", min: 1 } };
  if (kind === "allyRace") return { kind: "allyRace", race: "Dragon", min: 1 };
  if (kind === "allyClass") return { kind: "allyClass", classKey: "mage", min: 1 };
  if (kind === "nexusBelow" || kind === "manaAtLeast") return { kind, amount: 1 } as MechanicCondition;
  return { kind: "always" };
}

export default function ContinuousAuraConditionEditor({
  value,
  onChange,
  depth = 0,
}: {
  value: MechanicCondition;
  onChange: (value: MechanicCondition) => void;
  depth?: number;
}) {
  const availableKinds = auraKindsAtDepth(depth);
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

        {kind === "allyRace" && <>
          <label className="block"><span className="label">Raça aliada</span><select className="input" value={safeValue.race} onChange={(event) => onChange({ ...safeValue, race: event.target.value as typeof safeValue.race })}>{CARD_RACES.map((race) => <option key={race}>{race}</option>)}</select></label>
          <label className="block"><span className="label">Mínimo</span><input className="input" type="number" min={1} max={6} value={safeValue.min} onChange={(event) => onChange({ ...safeValue, min: Number(event.target.value) })} /></label>
        </>}

        {kind === "allyClass" && <>
          <label className="block"><span className="label">Classe aliada</span><input className="input font-mono" value={safeValue.classKey} onChange={(event) => onChange({ ...safeValue, classKey: event.target.value })} placeholder="mage" /></label>
          <label className="block"><span className="label">Mínimo</span><input className="input" type="number" min={1} max={6} value={safeValue.min} onChange={(event) => onChange({ ...safeValue, min: Number(event.target.value) })} /></label>
        </>}

        {(kind === "nexusBelow" || kind === "manaAtLeast") && <label className="block"><span className="label">Valor</span><input className="input" type="number" min={0} max={20} value={safeValue.amount} onChange={(event) => onChange({ ...safeValue, amount: Number(event.target.value) })} /></label>}
      </div>

      {depthLimited && <p className="mt-3 text-[10px] leading-4 text-amber-100/75">Profundidade máxima do contrato atingida; apenas folhas válidas permanecem disponíveis.</p>}

      {(kind === "and" || kind === "or") && <div className="mt-3 space-y-2">
        {groupChildren.map((child, index) => (
          <div key={index} className="relative">
            <ContinuousAuraConditionEditor
              value={child}
              depth={depth + 1}
              onChange={(nextChild) => onChange({ kind, children: groupChildren.map((candidate, childIndex) => childIndex === index ? nextChild : candidate) })}
            />
            {groupChildren.length > 1 && <button type="button" className="btn-ghost absolute right-2 top-2 !px-2 !py-1 text-[10px] text-red-300" onClick={() => onChange({ kind, children: groupChildren.filter((_, childIndex) => childIndex !== index) })}>Remover</button>}
          </div>
        ))}
        {canAddGroupChild ? <button type="button" className="btn-ghost text-xs" onClick={() => onChange({ kind, children: [...groupChildren, { kind: "always" }] })}>＋ Condição</button> : <span className="text-[10px] text-slate-500">Limite estrutural do grupo atingido.</span>}
      </div>}

      {kind === "not" && <div className="mt-3"><ContinuousAuraConditionEditor value={safeValue.child} depth={depth + 1} onChange={(child) => onChange({ kind: "not", child })} /></div>}
    </div>
  );
}
