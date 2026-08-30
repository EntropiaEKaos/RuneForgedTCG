"use client";

import { useState } from "react";
import Link from "next/link";
import { StudioBreadcrumb, StudioCommandPalette } from "../StudioChrome";
import { CARD_TRIGGERS, CARD_TYPES } from "@/game/card-authoring";
import type { CardEffect, MechanicCondition } from "@/game/types";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import MechanicsImpactPreflight, { type MechanicsImpactReport } from "./MechanicsImpactPreflight";
import {
  AbilityGrammarReadiness,
  StudioConditionEditor,
  StudioEffectEditor,
} from "../AbilityComposerFields";

const baseEffect: CardEffect = { kind: "draw", amount: 1, target: "none" };
const baseCondition: MechanicCondition = { kind: "always" };

type MechanicsTab = "keyword" | "effect" | "archetype";

type KeywordDraft = {
  key: string;
  name: string;
  description: string;
  icon: string;
  trigger: string;
  condition: MechanicCondition;
  effect: CardEffect;
};

type EffectDraft = { key: string; name: string; description: string; effect: CardEffect };
type ArchetypeDraft = { key: string; name: string; description: string; baseType: string; definition: { defaults: Record<string, unknown> } };

const freshKeyword = (): KeywordDraft => ({ key: "", name: "", description: "", icon: "✦", trigger: "onSummon", condition: structuredClone(baseCondition), effect: structuredClone(baseEffect) });
const freshEffect = (): EffectDraft => ({ key: "", name: "", description: "", effect: structuredClone(baseEffect) });
const freshArchetype = (): ArchetypeDraft => ({ key: "", name: "", description: "", baseType: "Enchantment", definition: { defaults: { maxHealth: 3 } } });

export default function MechanicsStudio() {
  const [tab, setTab] = useState<MechanicsTab>("keyword");
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [impactReport, setImpactReport] = useState<MechanicsImpactReport | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState("");
  const [kw, setKw] = useState<KeywordDraft>(freshKeyword);
  const [fx, setFx] = useState<EffectDraft>(freshEffect);
  const [arch, setArch] = useState<ArchetypeDraft>(freshArchetype);
  const resource = tab === "keyword" ? "keywords" : tab === "effect" ? "effects" : "archetypes";

  async function load() {
    const response = await fetch(`/api/admin/studio/${resource}?limit=300`, { credentials: "include" });
    const data = await response.json();
    setRows(data.rows || []);
  }

  useDeferredEffect(() => {
    resetEditor();
    setImpactReport(null);
    setImpactError("");
    load().catch(() => {});
  }, [resource]);

  function resetEditor() {
    setEditingId(null);
    if (tab === "keyword") setKw(freshKeyword());
    else if (tab === "effect") setFx(freshEffect());
    else setArch(freshArchetype());
  }

  function editRow(row: any) {
    setEditingId(row.id);
    if (tab === "keyword") {
      setKw({
        key: row.key,
        name: row.name,
        description: row.description || "",
        icon: row.icon || "✦",
        trigger: row.behavior?.trigger || "onSummon",
        condition: row.behavior?.condition || structuredClone(baseCondition),
        effect: row.behavior?.effect || structuredClone(baseEffect),
      });
    } else if (tab === "effect") {
      setFx({ key: row.key, name: row.name, description: row.description || "", effect: row.schema?.effect || structuredClone(baseEffect) });
    } else {
      setArch({ key: row.key, name: row.name, description: row.description || "", baseType: row.baseType || "Enchantment", definition: row.definition || { defaults: { maxHealth: 3 } } });
    }
  }

  async function inspectImpact(row: any) {
    setImpactLoading(true);
    setImpactError("");
    setImpactReport(null);
    try {
      const query = new URLSearchParams({ kind: tab, key: String(row.key || "") });
      const response = await fetch(`/api/admin/studio/dependencies/impact?${query}`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Impact diagnostics unavailable");
      setImpactReport(data as MechanicsImpactReport);
    } catch (error) {
      setImpactError(error instanceof Error ? error.message : "Impact diagnostics unavailable");
    } finally {
      setImpactLoading(false);
    }
  }

  async function save() {
    let payload: Record<string, unknown>;
    if (tab === "keyword") {
      payload = { key: kw.key, name: kw.name, description: kw.description, icon: kw.icon, behavior: { version: 1, trigger: kw.trigger, condition: kw.condition, effect: kw.effect } };
    } else if (tab === "effect") {
      payload = { key: fx.key, name: fx.name, description: fx.description, kind: "composite", schema: { version: 1, effect: fx.effect } };
    } else {
      payload = { key: arch.key, name: arch.name, description: arch.description, baseType: arch.baseType, definition: { version: 1, baseType: arch.baseType, defaults: arch.definition?.defaults || {} } };
    }
    const url = editingId ? `/api/admin/studio/${resource}/${editingId}` : `/api/admin/studio/${resource}`;
    const response = await fetch(url, { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
    const data = await response.json();
    setMsg(data.ok ? (editingId ? "Draft atualizado." : "Draft criado. Valide/QA/publique pelo Production Studio.") : data.error || "Falha ao salvar");
    if (data.ok) {
      await load();
      resetEditor();
      setImpactReport(null);
    }
  }

  return <div className="studio-shell min-h-screen">
    <StudioCommandPalette />
    <header className="studio-topbar">
      <div className="studio-topbar-inner flex items-center justify-between">
        <div className="studio-brand">
          <div className="studio-brand-mark">⚙</div>
          <div>
            <div className="studio-kicker">RUNEFORGE // ABILITY SYSTEM 2.0</div>
            <div className="studio-title">Mechanics Studio <span className="text-amber-300">2.0</span></div>
          </div>
        </div>
        <Link href="/admin/studio" className="btn-ghost text-xs">Control Room</Link>
      </div>
    </header>
    <main className="studio-main">
      <StudioBreadcrumb section="Authoring" current="Mechanics Studio" />
      <section className="studio-hero mb-5">
        <p className="studio-kicker">SEMANTIC MECHANICS AUTHORING</p>
        <h2>Uma linguagem de gameplay, um único contrato de efeito.</h2>
        <p>Keywords compilam para trigger + condição + efeitos nativos. Effects são macros de primitivas. O compositor limita targets e campos conforme o mesmo contrato usado pela validação de engine.</p>
      </section>
      <div className="mb-5"><AbilityGrammarReadiness /></div>
      <div className="mb-5 flex gap-2">
        {[["keyword", "✦ Keyword"], ["effect", "⚡ Effect"], ["archetype", "🃏 Card Type"]].map(([key, label]) => <button key={key} onClick={() => setTab(key as MechanicsTab)} className={tab === key ? "btn-primary" : "btn-ghost"}>{label}</button>)}
      </div>
      {msg && <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">{msg}</div>}
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <section className="studio-section p-5">
          {tab === "keyword" && <>
            <Heading title="Keyword Composer" />
            <Grid>
              <Field label="Key"><input className="input font-mono" value={kw.key} onChange={(event) => setKw({ ...kw, key: event.target.value })} /></Field>
              <Field label="Name"><input className="input" value={kw.name} onChange={(event) => setKw({ ...kw, name: event.target.value })} /></Field>
              <Field label="Icon"><input className="input" maxLength={8} value={kw.icon} onChange={(event) => setKw({ ...kw, icon: event.target.value })} /></Field>
              <Field label="Trigger"><Select value={kw.trigger} options={CARD_TRIGGERS} onChange={(trigger) => setKw({ ...kw, trigger })} /></Field>
            </Grid>
            <Field label="Description"><textarea className="input min-h-20" value={kw.description} onChange={(event) => setKw({ ...kw, description: event.target.value })} /></Field>
            <div className="mt-4"><StudioConditionEditor value={kw.condition} onChange={(condition) => setKw({ ...kw, condition })} /></div>
            <div className="mt-4"><StudioEffectEditor value={kw.effect} onChange={(effect) => setKw({ ...kw, effect })} /></div>
          </>}
          {tab === "effect" && <>
            <Heading title="Effect Composer" />
            <Grid>
              <Field label="Key"><input className="input font-mono" value={fx.key} onChange={(event) => setFx({ ...fx, key: event.target.value })} /></Field>
              <Field label="Name"><input className="input" value={fx.name} onChange={(event) => setFx({ ...fx, name: event.target.value })} /></Field>
            </Grid>
            <Field label="Description"><textarea className="input min-h-20" value={fx.description} onChange={(event) => setFx({ ...fx, description: event.target.value })} /></Field>
            <div className="mt-4"><StudioEffectEditor value={fx.effect} onChange={(effect) => setFx({ ...fx, effect })} /></div>
          </>}
          {tab === "archetype" && <>
            <Heading title="Card Type / Archetype Composer" />
            <Grid>
              <Field label="Key"><input className="input font-mono" value={arch.key} onChange={(event) => setArch({ ...arch, key: event.target.value })} /></Field>
              <Field label="Display type"><input className="input" value={arch.name} onChange={(event) => setArch({ ...arch, name: event.target.value })} placeholder="Location" /></Field>
              <Field label="Structural base"><Select value={arch.baseType} options={CARD_TYPES} onChange={(baseType) => setArch({ ...arch, baseType })} /></Field>
              <Field label="Default max health"><input className="input" type="number" value={Number(arch.definition.defaults?.maxHealth ?? 3)} onChange={(event) => setArch({ ...arch, definition: { defaults: { ...arch.definition.defaults, maxHealth: Number(event.target.value) } } })} /></Field>
            </Grid>
            <p className="mt-4 text-xs text-slate-400">Um novo tipo herda zona e regras estruturais do baseType. Ex.: Location → Enchantment, Relic → Artifact, Vehicle → Unit. Uma zona completamente nova continua exigindo uma nova primitiva de engine.</p>
          </>}
          <div className="mt-5 flex gap-2">
            <button className="btn-primary" onClick={save}>{editingId ? "Update draft" : "Save draft mechanic"}</button>
            {editingId && <button className="btn-ghost" onClick={resetEditor}>Cancel edit</button>}
          </div>
        </section>
        <aside className="studio-section p-5">
          <Heading title={`Drafts / ${resource}`} />
          <div className="space-y-2">
            {rows.map((row) => <div key={row.id} className="rounded-xl border border-white/10 bg-white/[.025] p-3">
              <div className="flex items-start justify-between gap-2">
                <div><div className="font-bold">{row.name}</div><div className="font-mono text-[10px] text-slate-500">{row.key}</div><div className="mt-1 text-[10px] text-slate-400">{row.enabled ? "LIVE" : "DRAFT"}</div></div>
                <div className="flex gap-1"><button className="btn-ghost !px-2 !py-1 text-[10px]" onClick={() => inspectImpact(row)}>Impact</button>{!row.enabled && <button className="btn-ghost !px-2 !py-1 text-[10px]" onClick={() => editRow(row)}>Edit</button>}</div>
              </div>
            </div>)}
          </div>
          <Link href="/admin/studio/production" className="btn-ghost mt-4 inline-flex text-xs">Open Production Pipeline</Link>
        </aside>
      </div>
      <MechanicsImpactPreflight report={impactReport} loading={impactLoading} error={impactError} />
    </main>
  </div>;
}

function Heading({ title }: { title: string }) { return <><div className="studio-kicker">SAFE AUTHORING</div><h2 className="mb-4 mt-1 text-xl font-black">{title}</h2></>; }
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid gap-3 md:grid-cols-2">{children}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="mb-3 block"><span className="label">{label}</span>{children}</label>; }
function Select({ value, options, onChange }: { value: string; options: readonly string[]; onChange: (value: string) => void }) { return <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select>; }
