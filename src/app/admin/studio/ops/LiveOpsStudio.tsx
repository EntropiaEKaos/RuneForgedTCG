"use client";
import { useState } from "react";
import Link from "next/link";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { StudioCommandPalette, StudioBreadcrumb } from "../StudioChrome";
type Form = {
  key: string;
  name: string;
  description: string;
  type: string;
  status: string;
  startsAt: string;
  endsAt: string;
  rules: any;
  rewards: any;
  conditions: any;
  offers: any;
  metadata: any;
};
const empty = (kind: string): Form => ({
  key: "",
  name: "",
  description: "",
  type: kind,
  status: "draft",
  startsAt: "",
  endsAt: "",
  rules: { mode: "", eligibility: {}, missions: [] },
  rewards: [],
  conditions: {},
  offers: [],
  metadata: {},
});
export default function LiveOpsStudio() {
  const [metrics, setMetrics] = useState<any>(null),
    [kind, setKind] = useState<"event" | "promotion">("event"),
    [form, setForm] = useState<Form>(empty("event")),
    [rows, setRows] = useState<any[]>([]),
    [notice, setNotice] = useState("");
  async function load() {
    const [a, b] = await Promise.all([
      fetch("/api/admin/studio/analytics", { credentials: "include" }),
      fetch(`/api/admin/studio/${kind === "event" ? "events" : "promotions"}`, { credentials: "include" }),
    ]);
    if (a.ok) setMetrics((await a.json()).metrics);
    if (b.ok) setRows((await b.json()).rows || []);
  }
  useDeferredEffect(() => {
    load().catch(() => {});
  }, [kind]);
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  async function save() {
    const resource = kind === "event" ? "events" : "promotions";
    const body =
      kind === "event"
        ? {
            key: form.key,
            name: form.name,
            description: form.description,
            type: form.type,
            status: form.status,
            startsAt: form.startsAt,
            endsAt: form.endsAt,
            rules: form.rules,
            rewards: form.rewards,
            metadata: form.metadata,
          }
        : {
            key: form.key,
            name: form.name,
            description: form.description,
            type: form.type,
            status: form.status,
            startsAt: form.startsAt,
            endsAt: form.endsAt,
            conditions: form.conditions,
            offers: form.offers,
            metadata: form.metadata,
          };
    const r = await fetch(`/api/admin/studio/${resource}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const d = await r.json();
    setNotice(d.ok ? "Saved. Run validation/QA before publishing." : d.error || "Save failed");
    if (d.ok) {
      setForm(empty(kind));
      load();
    }
  }
  return (
    <div className="studio-shell">
      <StudioCommandPalette />
      <header className="studio-topbar">
        <div className="studio-topbar-inner flex items-center justify-between gap-4">
          <div className="studio-brand">
            <div className="studio-brand-mark">⚡</div>
            <div>
              <div className="studio-kicker">Runeforge // Live Operations</div>
              <div className="studio-title">Events · Promotions · Analytics</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/studio" className="btn-ghost text-xs">
              Control Room
            </Link>
            <Link href="/admin/studio/cards" className="btn-ghost text-xs">
              Card Studio
            </Link>
          </div>
        </div>
      </header>
      <main className="studio-main mx-auto max-w-[1500px]">
        <StudioBreadcrumb section="Operations" current="Events & Promotions" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {[
            ["Players", metrics?.players, "👤"],
            ["Matches", metrics?.matches, "⚔️"],
            ["Cards", metrics?.cards, "🃏"],
            ["Events", metrics?.activeEvents, "🎪"],
            ["Promos", metrics?.activePromotions, "🎁"],
            ["Collections", metrics?.collections, "📚"],
            ["Test runs", metrics?.testRuns, "🧪"],
            ["Wins", metrics?.wins, "🏆"],
            ["Win rate", `${metrics?.winRate ?? 0}%`, "📈"],
          ].map(([l, v, i]) => (
            <div key={String(l)} className="studio-metric">
              <div className="text-xl">{i}</div>
              <div className="mt-2 text-2xl font-black">{v ?? "—"}</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500">{l}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_420px]">
          <section className="studio-section p-5">
            <div className="mb-4 flex gap-2">
              <button
                className={kind === "event" ? "btn-primary" : "btn-ghost"}
                onClick={() => {
                  setKind("event");
                  setForm(empty("event"));
                }}
              >
                🎪 Event Builder
              </button>
              <button
                className={kind === "promotion" ? "btn-primary" : "btn-ghost"}
                onClick={() => {
                  setKind("promotion");
                  setForm(empty("promotion"));
                }}
              >
                🎁 Promotion Builder
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Stable key" value={form.key} onChange={(v) => set("key", v)} />
              <Field label="Name" value={form.name} onChange={(v) => set("name", v)} />
              <Field label="Type" value={form.type} onChange={(v) => set("type", v)} />
              <Field label="Status" value={form.status} onChange={(v) => set("status", v)} />
              <Field label="Starts at" value={form.startsAt} onChange={(v) => set("startsAt", v)} />
              <Field label="Ends at" value={form.endsAt} onChange={(v) => set("endsAt", v)} />
            </div>
            <Field label="Description" value={form.description} onChange={(v) => set("description", v)} />
            {kind === "event" ? (
              <>
                <Json label="Rules / eligibility / missions" value={form.rules} onChange={(v) => set("rules", v)} />
                <Json label="Rewards" value={form.rewards} onChange={(v) => set("rewards", v)} />
              </>
            ) : (
              <>
                <Json label="Conditions / audience" value={form.conditions} onChange={(v) => set("conditions", v)} />
                <Json label="Offers / limits / rewards" value={form.offers} onChange={(v) => set("offers", v)} />
              </>
            )}
            <Json label="Metadata" value={form.metadata} onChange={(v) => set("metadata", v)} />
            <button className="btn-primary mt-4" onClick={save}>
              Create draft
            </button>
            {notice && <p className="mt-3 text-xs text-amber-200">{notice}</p>}
          </section>
          <aside className="studio-section p-5">
            <h2 className="font-black">Existing {kind === "event" ? "events" : "promotions"}</h2>
            <div className="mt-3 space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="rounded-xl bg-white/[.03] p-3">
                  <div className="font-bold">{r.name}</div>
                  <div className="text-[10px] text-slate-500">
                    {r.key} · {r.status}
                  </div>
                </div>
              ))}
              {!rows.length && <div className="text-xs text-slate-500">No records yet.</div>}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
function Field(p: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <label className="block mt-3">
      <span className="label">{p.label}</span>
      <input className="input" value={p.value || ""} onChange={(e) => p.onChange(e.target.value)} />
    </label>
  );
}
function Json(p: { label: string; value?: unknown; onChange: (v: unknown) => void }) {
  return (
    <label className="block mt-3">
      <span className="label">{p.label}</span>
      <textarea
        className="input min-h-32 font-mono text-[11px]"
        value={JSON.stringify(p.value ?? {}, null, 2)}
        onChange={(e) => {
          try {
            p.onChange(JSON.parse(e.target.value));
          } catch {}
        }}
      />
    </label>
  );
}
