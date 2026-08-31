"use client";

import {
  CARD_EFFECT_CONTRACTS,
  CARD_EFFECT_KINDS,
  CARD_KEYWORDS,
  CARD_RACES,
  MECHANIC_CONDITION_KINDS,
} from "@/game/card-authoring";
import type { CardEffectContract } from "@/game/card-authoring";
import { ABILITY_GRAMMAR_CATALOG } from "@/game/ability-system";
import type { ActivatedAbilityCost } from "@/game/activated-ability-types";
import { keywordIsGrantable } from "@/game/keywords";
import type { CardEffect, EffectKind, MechanicCondition, TargetKind } from "@/game/types";

const DEFAULT_EFFECT: CardEffect = { kind: "draw", amount: 1, target: "none" };
const GRANTABLE_KEYWORDS = CARD_KEYWORDS.filter((keyword) => keywordIsGrantable(keyword));

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="label">{label}</span>{children}</label>;
}

function Select({ value, options, onChange, disabled = false }: { value: string; options: readonly string[]; onChange: (value: string) => void; disabled?: boolean }) {
  return <select className="input" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>{options.map((option) => <option key={option}>{option}</option>)}</select>;
}

function contractFor(kind: EffectKind): CardEffectContract {
  return CARD_EFFECT_CONTRACTS[kind];
}

function supportedTargets(kind: EffectKind, blockedTargets: readonly TargetKind[]) {
  return contractFor(kind).targets.filter((target) => !blockedTargets.includes(target));
}

export function availableEffectKinds(blockedTargets: readonly TargetKind[] = []): EffectKind[] {
  return CARD_EFFECT_KINDS.filter((kind) => supportedTargets(kind, blockedTargets).length > 0);
}

export function normalizeEffectKind(value: CardEffect | undefined, kind: EffectKind, blockedTargets: readonly TargetKind[] = []): CardEffect {
  const contract = contractFor(kind);
  const targets = supportedTargets(kind, blockedTargets);
  if (!targets.length) return { ...DEFAULT_EFFECT };
  const target = targets.includes(value?.target as TargetKind) ? value!.target : targets[0];
  const amount = contract.amount === "positive" ? Math.max(1, value?.amount ?? 1) : contract.amount === "nonNegative" ? Math.max(0, value?.amount ?? 0) : 0;
  const next: CardEffect = { kind, amount, target };
  const required = new Set(contract.requires ?? []);
  if (required.has("keyword")) {
    next.keyword = value?.keyword && keywordIsGrantable(value.keyword) ? value.keyword : GRANTABLE_KEYWORDS[0];
  }
  if (required.has("tokenDefId") && value?.tokenDefId) next.tokenDefId = value.tokenDefId;
  if (required.has("equipmentDefId") && value?.equipmentDefId) next.equipmentDefId = value.equipmentDefId;
  if (required.has("race")) {
    if (value?.race) next.race = value.race;
    if (value?.races?.length) next.races = value.races;
  }
  if (required.has("classKey")) {
    if (value?.classKey) next.classKey = value.classKey;
    if (value?.classKeys?.length) next.classKeys = value.classKeys;
  }
  if (required.has("buff")) {
    next.buffPower = value?.buffPower ?? 1;
    if (value?.buffHealth !== undefined) next.buffHealth = value.buffHealth;
  }
  if (value?.also) next.also = value.also;
  return next;
}

export function StudioEffectEditor({
  value,
  onChange,
  classes = [],
  blockedTargets = [],
  depth = 0,
}: {
  value?: CardEffect;
  onChange: (value: CardEffect) => void;
  classes?: string[];
  blockedTargets?: readonly TargetKind[];
  depth?: number;
}) {
  const v = value ?? DEFAULT_EFFECT;
  const kinds = availableEffectKinds(blockedTargets);
  const kind = kinds.includes(v.kind) ? v.kind : kinds[0] ?? "draw";
  const contract = contractFor(kind);
  const targets = supportedTargets(kind, blockedTargets);
  const safeValue = kind === v.kind && targets.includes(v.target) ? v : normalizeEffectKind(v, kind, blockedTargets);
  const required = new Set(contract.requires ?? []);
  const set = (key: keyof CardEffect, nextValue: unknown) => onChange({ ...safeValue, [key]: nextValue });
  const amountMin = contract.amount === "positive" ? 1 : contract.amount === "nonNegative" ? 0 : undefined;
  const safeKeyword = safeValue.keyword && keywordIsGrantable(safeValue.keyword) ? safeValue.keyword : GRANTABLE_KEYWORDS[0];

  return <div data-studio-effect-composer="semantic" className={`rounded-xl border ${depth ? "border-violet-400/20 bg-violet-400/[.03]" : "border-cyan-400/15 bg-cyan-400/[.03]"} p-4`}>
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
      <Field label="Primitive">
        <Select value={kind} options={kinds} onChange={(nextKind) => onChange(normalizeEffectKind(safeValue, nextKind as EffectKind, blockedTargets))} />
      </Field>
      <Field label="Target">
        {targets.length === 1 ? <div className="input flex items-center text-slate-300">{targets[0]}</div> : <Select value={safeValue.target} options={targets} onChange={(target) => set("target", target as TargetKind)} />}
      </Field>
      {contract.amount !== "any" && <Field label="Amount"><input className="input" type="number" min={amountMin} value={safeValue.amount ?? amountMin ?? 0} onChange={(event) => set("amount", Number(event.target.value))} /></Field>}
      {required.has("keyword") && <Field label="Keyword"><Select value={safeKeyword} options={GRANTABLE_KEYWORDS} onChange={(keyword) => set("keyword", keyword)} /></Field>}
      {required.has("buff") && <>
        <Field label="Power buff"><input className="input" type="number" value={safeValue.buffPower ?? ""} onChange={(event) => set("buffPower", event.target.value === "" ? undefined : Number(event.target.value))} /></Field>
        <Field label="Health buff"><input className="input" type="number" value={safeValue.buffHealth ?? ""} onChange={(event) => set("buffHealth", event.target.value === "" ? undefined : Number(event.target.value))} /></Field>
      </>}
      {required.has("tokenDefId") && <Field label="Token defId"><input className="input font-mono" value={safeValue.tokenDefId ?? ""} onChange={(event) => set("tokenDefId", event.target.value || undefined)} /></Field>}
      {required.has("equipmentDefId") && <Field label="Equipment defId"><input className="input font-mono" value={safeValue.equipmentDefId ?? ""} onChange={(event) => set("equipmentDefId", event.target.value || undefined)} /></Field>}
      {required.has("race") && <>
        <Field label="Race"><select className="input" value={safeValue.race ?? ""} onChange={(event) => set("race", event.target.value || undefined)}><option value="">None</option>{CARD_RACES.map((race) => <option key={race}>{race}</option>)}</select></Field>
        <Field label="Races (multi)"><input className="input" value={(safeValue.races ?? []).join(", ")} onChange={(event) => set("races", event.target.value.split(",").map((item) => item.trim()).filter((item) => (CARD_RACES as readonly string[]).includes(item)))} /></Field>
      </>}
      {required.has("classKey") && <>
        <Field label="Class">
          {classes.length ? <select className="input" value={safeValue.classKey ?? ""} onChange={(event) => set("classKey", event.target.value || undefined)}><option value="">None</option>{classes.map((classKey) => <option key={classKey}>{classKey}</option>)}</select> : <input className="input font-mono" value={safeValue.classKey ?? ""} onChange={(event) => set("classKey", event.target.value || undefined)} placeholder="mage" />}
        </Field>
        <Field label="Classes (multi)"><input className="input" value={(safeValue.classKeys ?? []).join(", ")} onChange={(event) => set("classKeys", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></Field>
      </>}
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {!safeValue.also && depth < 12 && <button type="button" className="btn-ghost text-xs" onClick={() => set("also", { ...DEFAULT_EFFECT })}>＋ Follow-up effect</button>}
      {safeValue.also && <button type="button" className="btn-ghost text-xs text-red-300" onClick={() => set("also", undefined)}>Remove follow-up</button>}
      <span className="text-[10px] text-slate-500">Targets permitidos: {targets.join(", ")}</span>
    </div>
    {safeValue.also && depth < 12 && <div className="mt-3"><div className="label mb-2">Follow-up #{depth + 1}</div><StudioEffectEditor value={safeValue.also} onChange={(also) => set("also", also)} classes={classes} blockedTargets={blockedTargets} depth={depth + 1} /></div>}
  </div>;
}

export function defaultMechanicCondition(kind: string): MechanicCondition {
  if (kind === "and" || kind === "or") return { kind, children: [{ kind: "always" }, { kind: "selfDamaged" }] } as MechanicCondition;
  if (kind === "not") return { kind: "not", child: { kind: "selfDamaged" } };
  if (kind === "allyRace") return { kind: "allyRace", race: "Dragon", min: 1 };
  if (kind === "allyClass") return { kind: "allyClass", classKey: "mage", min: 1 };
  if (kind === "nexusBelow" || kind === "manaAtLeast") return { kind, amount: 1 } as MechanicCondition;
  return { kind: kind as "always" | "selfDamaged" };
}

export function StudioConditionEditor({ value, onChange, depth = 0 }: { value: MechanicCondition; onChange: (value: MechanicCondition) => void; depth?: number }) {
  const kind = value?.kind ?? "always";
  const setKind = (nextKind: string) => onChange(defaultMechanicCondition(nextKind));
  return <div data-studio-condition-composer="semantic" className={`rounded-xl border ${depth ? "border-violet-400/20 bg-violet-400/[.03]" : "border-white/10 bg-black/10"} p-3`}>
    <div className="grid gap-3 md:grid-cols-2">
      <Field label={depth ? `Condition #${depth + 1}` : "Condition"}><Select value={kind} options={MECHANIC_CONDITION_KINDS} onChange={setKind} /></Field>
      {kind === "allyRace" && <Field label="Race"><Select value={(value as Extract<MechanicCondition, { kind: "allyRace" }>).race} options={CARD_RACES} onChange={(race) => onChange({ ...(value as Extract<MechanicCondition, { kind: "allyRace" }>), race: race as typeof CARD_RACES[number] })} /></Field>}
      {kind === "allyRace" && <Field label="Minimum"><input className="input" type="number" min={1} max={6} value={(value as Extract<MechanicCondition, { kind: "allyRace" }>).min ?? 1} onChange={(event) => onChange({ ...(value as Extract<MechanicCondition, { kind: "allyRace" }>), min: Number(event.target.value) })} /></Field>}
      {kind === "allyClass" && <>
        <Field label="Class key"><input className="input font-mono" value={(value as Extract<MechanicCondition, { kind: "allyClass" }>).classKey} onChange={(event) => onChange({ ...(value as Extract<MechanicCondition, { kind: "allyClass" }>), classKey: event.target.value })} /></Field>
        <Field label="Minimum"><input className="input" type="number" min={1} max={6} value={(value as Extract<MechanicCondition, { kind: "allyClass" }>).min ?? 1} onChange={(event) => onChange({ ...(value as Extract<MechanicCondition, { kind: "allyClass" }>), min: Number(event.target.value) })} /></Field>
      </>}
      {(kind === "nexusBelow" || kind === "manaAtLeast") && <Field label="Amount"><input className="input" type="number" min={0} max={20} value={(value as Extract<MechanicCondition, { kind: "nexusBelow" | "manaAtLeast" }>).amount} onChange={(event) => onChange({ ...(value as Extract<MechanicCondition, { kind: "nexusBelow" | "manaAtLeast" }>), amount: Number(event.target.value) })} /></Field>}
    </div>
    {(kind === "and" || kind === "or") && <div className="mt-3 space-y-2">
      {(value as Extract<MechanicCondition, { kind: "and" | "or" }>).children.map((child, index, children) => <div key={index} className="relative"><StudioConditionEditor value={child} depth={depth + 1} onChange={(nextChild) => onChange({ kind, children: children.map((candidate, childIndex) => childIndex === index ? nextChild : candidate) } as MechanicCondition)} />{children.length > 1 && <button type="button" className="btn-ghost absolute right-2 top-2 !px-2 !py-1 text-[10px] text-red-300" onClick={() => onChange({ kind, children: children.filter((_, childIndex) => childIndex !== index) } as MechanicCondition)}>Remove</button>}</div>)}
      {(value as Extract<MechanicCondition, { kind: "and" | "or" }>).children.length < 8 && <button type="button" className="btn-ghost text-xs" onClick={() => onChange({ kind, children: [...(value as Extract<MechanicCondition, { kind: "and" | "or" }>).children, { kind: "always" }] } as MechanicCondition)}>＋ Condition</button>}
    </div>}
    {kind === "not" && <div className="mt-3"><StudioConditionEditor value={(value as Extract<MechanicCondition, { kind: "not" }>).child} depth={depth + 1} onChange={(child) => onChange({ kind: "not", child })} /></div>;
  </div>;
}

export function StudioAbilityCostEditor({ value, onChange, showLoyalty = false }: { value?: ActivatedAbilityCost; onChange: (value: ActivatedAbilityCost | undefined) => void; showLoyalty?: boolean }) {
  const cost = value ?? {};
  const update = (patch: Partial<ActivatedAbilityCost>) => {
    const next: ActivatedAbilityCost = { ...cost, ...patch };
    for (const key of Object.keys(next) as (keyof ActivatedAbilityCost)[]) {
      if (next[key] === undefined || next[key] === false || next[key] === 0) delete next[key];
    }
    onChange(Object.keys(next).length ? next : undefined);
  };
  return <div data-studio-cost-composer="semantic" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
    <Field label="Mana regular"><input className="input" type="number" min={0} max={20} value={cost.mana ?? 0} onChange={(event) => update({ mana: Math.max(0, Math.min(20, Number(event.target.value) || 0)) })} /></Field>
    <Field label="Vida do Nexus"><input className="input" type="number" min={0} max={20} value={cost.nexusHealth ?? 0} onChange={(event) => update({ nexusHealth: Math.max(0, Math.min(20, Number(event.target.value) || 0)) })} /></Field>
    {showLoyalty && <Field label="Δ Lealdade"><input className="input" type="number" min={-20} max={20} value={cost.loyaltyDelta ?? 0} onChange={(event) => update({ loyaltyDelta: Math.max(-20, Math.min(20, Number(event.target.value) || 0)) })} /></Field>}
    <label className="flex cursor-pointer items-center gap-2 self-end pb-3 text-xs text-slate-300"><input type="checkbox" checked={Boolean(cost.exhaustSelf)} onChange={(event) => update({ exhaustSelf: event.target.checked })} />Exaurir fonte</label>
    <label className="flex cursor-pointer items-center gap-2 self-end pb-3 text-xs text-slate-300"><input type="checkbox" checked={Boolean(cost.sacrificeSelf)} onChange={(event) => update({ sacrificeSelf: event.target.checked })} />Sacrificar fonte</label>
  </div>;
}

export function AbilityGrammarReadiness() {
  return <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[.035] p-4">
    <div className="studio-kicker">ABILITY SYSTEM 2.0</div>
    <div className="mt-2 flex flex-wrap gap-2">{ABILITY_GRAMMAR_CATALOG.kinds.map((kind) => {
      const support = ABILITY_GRAMMAR_CATALOG.kindSupport[kind];
      return <span key={kind} className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${support === "supported" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : support === "partial" ? "border-amber-300/20 bg-amber-300/10 text-amber-200" : "border-white/10 bg-white/[.03] text-slate-500"}`}>{kind} · {support}</span>;
    })}</div>
    <p className="mt-3 text-[10px] leading-4 text-slate-500">Somente contratos suportados devem virar opções publicáveis. Famílias partial/planned permanecem visíveis como mapa técnico, não como promessa de runtime.</p>
  </div>;
}
