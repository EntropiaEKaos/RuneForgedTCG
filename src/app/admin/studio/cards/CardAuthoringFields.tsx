"use client";
import { useState } from "react";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import Link from "next/link";
import CardView from "@/components/CardView";
import type { CardDef } from "@/game/types";
import type { CardCollectionIdentity } from "@/game/card-collections";
import { strategicRoleForCard } from "@/game/card-role";
import CollectionSymbolMark from "@/components/CollectionSymbolMark";
import { CARD_EFFECT_KINDS as EFFECT_KINDS, CARD_EFFECT_CONTRACTS as EFFECT_CONTRACTS, CARD_KEYWORDS as KWS, CARD_RACES as RACES } from "@/game/card-authoring";
import { EMPTY } from "./useCardAuthoringModel";

export function Panel(p: any) {
  return (
    <section className="studio-section p-5">
      <div className="mb-4">
        <div className="studio-kicker">{p.eyebrow || "WORKSPACE"}</div>
        <h2 className="mt-1 text-lg font-black text-white">{p.title}</h2>
      </div>
      {p.children}
    </section>
  );
}
export function F(p: any) {
  return (
    <label className={`block ${p.x || ""}`}>
      <span className="label">{p.l}</span>
      {p.children}
    </label>
  );
}
export function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={`rounded-xl border p-3 text-left text-xs font-bold ${checked ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[.025] text-slate-500"}`}>
      <span className="mr-2">{checked ? "✓" : "○"}</span>{label}
    </button>
  );
}
export function EffectEditor({ value, onChange, classes, depth = 0 }: { value: any; onChange: (v: any) => void; classes: string[]; depth?: number }) {
  const v = value || { kind: "draw", amount: 1, target: "none" };
  const contract = EFFECT_CONTRACTS[v.kind as keyof typeof EFFECT_CONTRACTS] || EFFECT_CONTRACTS.draw;
  const setE = (k: string, x: any) => onChange({ ...v, [k]: x });
  const setKind = (kind: keyof typeof EFFECT_CONTRACTS) => {
    const nextContract = EFFECT_CONTRACTS[kind];
    const target = (nextContract.targets as readonly string[]).includes(v.target) ? v.target : nextContract.targets[0];
    onChange({ ...v, kind, target });
  };
  return (
    <div className={`rounded-xl border ${depth ? "border-violet-400/20 bg-violet-400/[.03]" : "border-white/10 bg-black/10"} p-3`}>
      <div className="grid gap-2 md:grid-cols-4">
        <F l="Effect kind"><select className="input" value={v.kind || "draw"} onChange={(e) => setKind(e.target.value as keyof typeof EFFECT_CONTRACTS)}>{EFFECT_KINDS.map(k => <option key={k}>{k}</option>)}</select></F>
        <F l="Target"><select className="input" value={v.target || contract.targets[0]} onChange={(e) => setE("target", e.target.value)}>{contract.targets.map(k => <option key={k}>{k}</option>)}</select></F>
        <F l="Amount"><input className="input" type="number" value={v.amount ?? 0} onChange={(e) => setE("amount", Number(e.target.value))}/></F>
        <F l="Keyword"><select className="input" value={v.keyword || ""} onChange={(e) => setE("keyword", e.target.value || undefined)}><option value="">None</option>{KWS.map(k => <option key={k}>{k}</option>)}</select></F>
        <F l="Power buff"><input className="input" type="number" value={v.buffPower ?? ""} onChange={(e) => setE("buffPower", e.target.value === "" ? undefined : Number(e.target.value))}/></F>
        <F l="Health buff"><input className="input" type="number" value={v.buffHealth ?? ""} onChange={(e) => setE("buffHealth", e.target.value === "" ? undefined : Number(e.target.value))}/></F>
        <F l="Token defId"><input className="input font-mono" value={v.tokenDefId || ""} onChange={(e) => setE("tokenDefId", e.target.value || undefined)}/></F>
        <F l="Equipment defId"><input className="input font-mono" value={v.equipmentDefId || ""} onChange={(e) => setE("equipmentDefId", e.target.value || undefined)}/></F>
        <F l="Race"><select className="input" value={v.race || ""} onChange={(e) => setE("race", e.target.value || undefined)}><option value="">None</option>{RACES.map(r => <option key={r}>{r}</option>)}</select></F>
        <F l="Class"><select className="input" value={v.classKey || ""} onChange={(e) => setE("classKey", e.target.value || undefined)}><option value="">None</option>{classes.map(c => <option key={c}>{c}</option>)}</select></F>
        <F l="Races (multi)"><input className="input" value={(v.races || []).join(", ")} onChange={(e) => setE("races", e.target.value.split(",").map((x:string)=>x.trim()).filter((x:string)=>(RACES as readonly string[]).includes(x)))}/></F>
        <F l="Classes (multi)"><input className="input" value={(v.classKeys || []).join(", ")} onChange={(e) => setE("classKeys", e.target.value.split(",").map((x:string)=>x.trim()).filter(Boolean))}/></F>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {!v.also && depth < 12 && <button type="button" className="btn-ghost text-xs" onClick={() => setE("also", { kind: "draw", amount: 1, target: "none" })}>＋ Follow-up effect</button>}
        {v.also && <button type="button" className="btn-ghost text-xs text-red-300" onClick={() => setE("also", undefined)}>Remove follow-up</button>}
      </div>
      {v.also && depth < 12 && <div className="mt-3"><div className="label mb-2">Follow-up #{depth + 1}</div><EffectEditor value={v.also} classes={classes} depth={depth + 1} onChange={(also) => setE("also", also)} /></div>}
    </div>
  );
}
export function Json({ title, value, onChange }: { title: string; value?: unknown; onChange: (v: unknown) => void }) {
  const [t, setT] = useState(value ? JSON.stringify(value, null, 2) : "");
  useDeferredEffect(() => setT(value ? JSON.stringify(value, null, 2) : ""), [value]);
  return (
    <div className="mt-4">
      <div className="label">{title}</div>
      <textarea
        className="input min-h-40 font-mono text-[11px]"
        value={t}
        onChange={(e) => {
          setT(e.target.value);
          try {
            onChange(e.target.value ? JSON.parse(e.target.value) : undefined);
          } catch {}
        }}
      />
    </div>
  );
}
export function Check({ ok, t }: { ok: boolean; t: string }) {
  return (
    <div
      className={`mb-2 flex items-center gap-3 rounded-xl border p-3 text-xs ${ok ? "border-emerald-400/15 bg-emerald-400/[.04] text-emerald-200" : "border-white/5 bg-white/[.025] text-slate-500"}`}
    >
      <span className="grid h-6 w-6 place-items-center rounded-full bg-black/20">{ok ? "✓" : "○"}</span>
      {t}
    </div>
  );
}
export function Preview({ card, status, collection, large = false }: { card: any; status: string; collection: CardCollectionIdentity | null; large?: boolean }) {
  const definition = { ...EMPTY, ...card, defId: card.defId || "studio_preview" } as CardDef;
  const role = strategicRoleForCard(definition);
  return (
    <div className={`relative grid place-items-center overflow-hidden rounded-[28px] border border-amber-300/20 bg-[radial-gradient(circle_at_50%_20%,rgba(245,158,11,.18),transparent_35%),linear-gradient(145deg,rgba(30,41,59,.9),rgba(2,6,23,.98))] p-5 pb-16 shadow-2xl ${large ? "min-h-[640px]" : "min-h-[320px]"}`}>
      <CardView defId={definition.defId} definition={definition} collection={collection} size="lg" />
      <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 backdrop-blur">
        <span className="font-mono text-[9px] font-black uppercase text-slate-400">{status}</span>
        <span className="flex items-center gap-1 text-[9px] font-black text-cyan-200">{collection ? <><CollectionSymbolMark symbol={collection.symbol} name={collection.name} className="h-3 w-3 rounded-full object-cover" /> {collection.code}</> : "SEM COLEÇÃO"}</span>
        <span className="text-[9px] font-black text-amber-200">{role.icon} {role.label}</span>
      </div>
    </div>
  );
}
export function CardTests(p: any) {
  const [scenario, setScenario] = useState(
    '{\n  "sourceDefId": "",\n  "targetDefId": "",\n  "seed": 424242,\n  "mana": 5\n}',
  );
  const [expected, setExpected] = useState('{\n  "eventTypes": []\n}');
  async function create() {
    if (!p.cardId) return;
    let sc = {},
      ex = {};
    try {
      sc = JSON.parse(scenario);
      ex = JSON.parse(expected);
    } catch {
      return p.setResult({ ok: false, error: "Invalid JSON" });
    }
    const r = await fetch("/api/admin/studio/card-tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ cardId: p.cardId, name: p.name || "Card regression test", scenario: sc, expected: ex }),
    });
    p.setResult(await r.json());
    p.reload();
  }
  async function run() {
    if (!p.cardId) return;
    p.setBusy(true);
    const r = await fetch("/api/admin/studio/card-tests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ cardId: p.cardId }),
    });
    const d = await r.json();
    p.setResult(d);
    p.setBusy(false);
  }
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <Panel title="Automated Card Tests" eyebrow="DETERMINISTIC QA">
        <p className="text-xs leading-5 text-slate-400">
          Regression cases execute through the same Runeforge engine and record engine/ruleset versions.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <F l="Test name">
            <input
              className="input"
              value={p.name}
              onChange={(e) => p.setName(e.target.value)}
              placeholder="Summon buff applies"
            />
          </F>
          <div className="flex items-end gap-2">
            <button className="btn-primary" onClick={create} disabled={!p.cardId}>
              Save test
            </button>
            <button className="btn-ghost" onClick={run} disabled={!p.cardId || p.busy}>
              {p.busy ? "Running…" : "Run all tests"}
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Json
            title="Scenario"
            value={JSON.parse(scenario || "{}")}
            onChange={(v) => setScenario(JSON.stringify(v, null, 2))}
          />
          <Json
            title="Expected"
            value={JSON.parse(expected || "{}")}
            onChange={(v) => setExpected(JSON.stringify(v, null, 2))}
          />
        </div>
        {p.result && (
          <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-black/30 p-4 text-[11px] text-slate-400">
            {JSON.stringify(p.result, null, 2)}
          </pre>
        )}
      </Panel>
      <Panel title="Regression Suite" eyebrow="COVERAGE">
        <div className="space-y-2">
          {p.tests.map((t: any) => (
            <div key={t.id} className="rounded-xl border border-white/5 bg-white/[.03] p-3">
              <div className="font-bold text-xs">{t.name}</div>
              <div className="mt-1 text-[10px] text-slate-500">
                {t.enabled ? "Enabled" : "Disabled"} · #{t.id}
              </div>
            </div>
          ))}
          {!p.tests.length && (
            <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">
              No tests yet. Add the first deterministic case.
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}


export function CardStudioHeader() {
  return (
    <header className="studio-topbar">
      <div className="studio-topbar-inner flex items-center justify-between gap-4">
        <div className="studio-brand">
          <div className="studio-brand-mark">🃏</div>
          <div>
            <div className="studio-kicker">RUNEFORGE // CONTENT ENGINEERING</div>
            <div className="studio-title">Card Authoring Studio <span className="text-amber-300">4.2.1</span></div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black text-emerald-300 md:inline">● ENGINE CONNECTED</span>
          <Link href="/admin/studio" className="btn-ghost text-xs">Control Room</Link>
          <Link href="/admin/studio/production" className="btn-ghost text-xs">Production</Link>
        </div>
      </div>
    </header>
  );
}

export function CardCatalogSidebar({ rows, id, reset, edit, collectionForDefId }: any) {
  return (
    <aside className="studio-sidebar studio-scroll">
      <button className="btn-primary mb-4 w-full" onClick={reset}>＋ New Card</button>
      <div className="mb-3 flex items-center justify-between"><span className="studio-kicker">CATALOG</span><span className="text-[10px] text-slate-500">{rows.length} cards</span></div>
      <div className="space-y-2">
        {rows.map((r: any) => (
          <button key={r.id} onClick={() => edit(r)} className={`group w-full rounded-2xl border p-3 text-left transition ${id === r.id ? "border-amber-300/40 bg-amber-400/[.10]" : "border-white/5 bg-white/[.025] hover:border-white/15 hover:bg-white/[.05]"}`}>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-black/30 text-xl">{r.data?.emoji || "🃏"}</div>
              <div className="min-w-0 flex-1"><div className="truncate text-xs font-black text-slate-100">{r.name}</div><div className="truncate font-mono text-[9px] text-slate-500">{r.defId}</div></div>
              <span className="text-sm font-black text-amber-300">{r.data?.cost}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[9px] text-slate-500">
              <span>{collectionForDefId(r.defId)?.code || "SEM COLEÇÃO"}</span><span>{r.data?.rarity || "Common"}</span><span className={r.enabled ? "text-emerald-300" : "text-slate-600"}>{r.enabled ? "LIVE" : "DRAFT"}</span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

export function CardWorkspaceHeader({ card, powerBudget, status, collectionIdentity, progress, tabs, tab, setTab }: any) {
  return (
    <div className="mb-5 grid gap-4 xl:grid-cols-[1fr_320px]">
      <section className="studio-section overflow-hidden p-0">
        <div className="bg-gradient-to-r from-amber-400/[.12] via-transparent to-cyan-400/[.08] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><div className="studio-kicker">AUTHORING WORKSPACE</div><h1 className="mt-2 text-3xl font-black tracking-tight">{card.name || "Untitled Card"}</h1><p className="mt-1 text-xs text-slate-400">{card.defId || "Create a stable CardDef identity before publishing."}</p></div>
            <div className="flex items-center gap-2">
              <span className={["rounded-full border px-3 py-1 text-[10px] font-black", powerBudget.band === "healthy" ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : powerBudget.band === "high" ? "border-rose-300/30 bg-rose-400/10 text-rose-200" : "border-cyan-300/30 bg-cyan-400/10 text-cyan-200"].join(" ")} title={powerBudget.note}>POWER Δ {powerBudget.delta > 0 ? "+" : ""}{powerBudget.delta}</span>
              <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${status === "published" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-amber-400/20 bg-amber-400/10 text-amber-200"}`}>{status}</span>
              <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${collectionIdentity ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200" : "border-red-400/20 bg-red-400/10 text-red-200"}`} title={collectionIdentity?.name || "Escolha a coleção de lançamento"}>{collectionIdentity ? <span className="inline-flex items-center gap-1"><CollectionSymbolMark symbol={collectionIdentity.symbol} name={collectionIdentity.name} className="h-3 w-3 rounded-full object-cover" />{collectionIdentity.code}</span> : "SEM COLEÇÃO"}</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-black text-slate-400">{progress}/5 ready</span>
            </div>
          </div>
        </div>
        <div className="flex overflow-x-auto border-t border-white/10">
          {tabs.map(([key, label, num]: string[]) => <button key={key} onClick={() => setTab(key)} className={`relative min-w-[110px] flex-1 px-3 py-4 text-left text-[10px] font-black uppercase tracking-wider transition ${tab === key ? "bg-white/[.05] text-white" : "text-slate-500 hover:bg-white/[.025] hover:text-slate-300"}`}><span className="mr-2 text-amber-300/70">{num}</span>{label}{tab === key && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-amber-300" />}</button>)}
        </div>
      </section>
      <Preview card={card} status={status} collection={collectionIdentity} />
    </div>
  );
}
