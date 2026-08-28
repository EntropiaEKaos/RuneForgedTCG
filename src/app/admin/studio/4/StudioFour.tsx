"use client";
import { useState } from "react";
import Link from "next/link";
import { StudioCommandPalette, StudioBreadcrumb } from "../StudioChrome";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
type Tab = "dashboard" | "balance" | "approvals" | "liveops";
export default function StudioFour() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [data, setData] = useState<any>(null);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [decks, setDecks] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function load() {
    const [a, b, c] = await Promise.all([
      fetch("/api/admin/studio/analytics", { credentials: "include" }),
      fetch("/api/admin/studio/approvals", { credentials: "include" }),
      fetch("/api/admin/studio/simulate", { credentials: "include" }),
    ]);
    if (a.ok) setData((await a.json()).metrics);
    if (b.ok) setApprovals((await b.json()).rows || []);
    if (c.ok) setDecks((await c.json()).decks || []);
  }
  useDeferredEffect(() => {
    load().catch(() => {});
  }, []);
  async function decide(id: number, status: string) {
    const r = await fetch("/api/admin/studio/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, status }),
    });
    const d = await r.json();
    setNotice(d.ok ? `Approval ${status}.` : d.error || "Decision failed");
    load();
  }
  return (
    <div className="studio-shell min-h-screen bg-[#05070c] text-slate-100">
      <StudioCommandPalette />
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070a11]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between p-4">
          <div>
            <div className="text-[10px] font-black tracking-[.3em] text-amber-300">RUNEFORGE // CONTENT STUDIO 4.0</div>
            <h1 className="text-2xl font-black">Balance · QA · Approvals · Live Ops</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/studio" className="btn-ghost text-xs">
              Studio 3.0
            </Link>
            <Link href="/admin/studio/cards" className="btn-ghost text-xs">
              Card Studio
            </Link>
            <Link href="/admin/studio/5" className="btn-primary text-xs">
              Balance 5.0
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] p-5">
        <StudioBreadcrumb section="Operate" current="Content Operations" />
        {notice && (
          <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
            {notice}
          </div>
        )}
        <nav className="mb-6 flex flex-wrap gap-2">
          {(
            [
              ["dashboard", "📊 Dashboard"],
              ["balance", "🧪 Balance Lab"],
              ["approvals", "🔐 Approval Queue"],
              ["liveops", "🎪 Live Ops"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} className={tab === id ? "btn-primary" : "btn-ghost"} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        {tab === "dashboard" && <Dashboard data={data} />}{" "}
        {tab === "balance" && <Balance decks={decks} busy={busy} setBusy={setBusy} setNotice={setNotice} />}{" "}
        {tab === "approvals" && <Approvals rows={approvals} decide={decide} />} {tab === "liveops" && <LiveOps />}
      </main>
    </div>
  );
}
function Dashboard({ data }: any) {
  const cards = [
    ["Players", data?.players, "👤"],
    ["Matches", data?.matches, "⚔️"],
    ["Win rate", `${data?.winRate ?? 0}%`, "📈"],
    ["Cards", data?.cards, "🃏"],
    ["Active events", data?.activeEvents, "🎪"],
    ["Promotions", data?.activePromotions, "🎁"],
    ["Test runs", data?.testRuns, "🧪"],
    ["Simulations", data?.recentSimulations?.length || 0, "🔬"],
  ];
  return (
    <div>
      <div className="mb-6">
        <div className="text-xs font-black tracking-[.25em] text-slate-500">OPERATIONS INTELLIGENCE</div>
        <h2 className="mt-1 text-3xl font-black">Balance and production control plane</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Use the same engine that powers gameplay to validate content, run controlled balance experiments and gate
          production changes.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([l, v, i]) => (
          <div key={String(l)} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <div className="text-xl">{i}</div>
            <div className="mt-2 text-3xl font-black">{v ?? "—"}</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">{l}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
          <h3 className="font-black">Most collected cards</h3>
          <div className="mt-3 space-y-2">
            {(data?.topCards || []).map((r: any, i: number) => (
              <div key={r.defId} className="flex justify-between rounded-lg bg-white/[.03] p-3 text-xs">
                <span>
                  #{i + 1} · {r.defId}
                </span>
                <b>{r.copies}</b>
              </div>
            ))}
            {!data?.topCards?.length && <Empty t="No collection telemetry yet." />}
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
          <h3 className="font-black">Recent balance runs</h3>
          <div className="mt-3 space-y-2">
            {(data?.recentSimulations || []).map((r: any) => (
              <div key={r.id} className="rounded-lg bg-white/[.03] p-3 text-xs">
                <div className="font-bold">
                  {r.deckA} vs {r.deckB}
                </div>
                <div className="mt-1 text-slate-500">
                  {r.completedGames} games · {r.winsA}-{r.winsB} · avg {r.avgRounds} rounds
                </div>
              </div>
            ))}
            {!data?.recentSimulations?.length && <Empty t="No simulation runs yet." />}
          </div>
        </section>
      </div>
    </div>
  );
}
function Balance({ decks, busy, setBusy, setNotice }: any) {
  const [a, setA] = useState(decks[0]?.id || "");
  const [b, setB] = useState(decks[1]?.id || "");
  const [games, setGames] = useState(100);
  const [seed, setSeed] = useState(424242);
  const [result, setResult] = useState<any>(null);
  useDeferredEffect(() => {
    if (!a && decks[0]) setA(decks[0].id);
    if (!b && decks[1]) setB(decks[1].id);
  }, [decks, a, b]);
  async function run() {
    setBusy(true);
    setNotice("");
    const r = await fetch("/api/admin/studio/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ deckA: a, deckB: b, games, seed }),
    });
    const d = await r.json();
    if (d.ok) setResult(d.summary);
    else setNotice(d.error || "Simulation failed");
    setBusy(false);
  }
  return (
    <div>
      <div className="mb-6">
        <div className="text-xs font-black tracking-[.25em] text-amber-300">BALANCE LAB</div>
        <h2 className="mt-1 text-3xl font-black">Controlled engine simulations</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Runs deterministic AI-versus-AI matches through the production engine. Up to 5,000 games per run; every run
          records seed, engine and ruleset versions.
        </p>
      </div>
      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <label>
            <span className="label">Deck A</span>
            <select className="input" value={a} onChange={(e) => setA(e.target.value)}>
              {decks.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Deck B</span>
            <select className="input" value={b} onChange={(e) => setB(e.target.value)}>
              {decks.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Games</span>
            <input
              className="input"
              type="number"
              min={1}
              max={5000}
              value={games}
              onChange={(e) => setGames(Number(e.target.value))}
            />
          </label>
          <label>
            <span className="label">Seed</span>
            <input className="input" type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
          </label>
        </div>
        <button className="btn-primary mt-4" onClick={run} disabled={busy || !a || !b}>
          {busy ? "Running engine…" : "Run simulation"}
        </button>
      </section>
      {result && (
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <Metric l="Deck A" v={`${result.winsA} wins (${result.winRateA}%)`} />
          <Metric l="Deck B" v={`${result.winsB} wins (${result.winRateB}%)`} />
          <Metric l="Average rounds" v={result.avgRounds} />
          <Metric l="Round range" v={`${result.roundDistribution.min}–${result.roundDistribution.max}`} />
        </div>
      )}
    </div>
  );
}
function Approvals({ rows, decide }: any) {
  const pending = rows.filter((r: any) => r.status === "pending");
  return (
    <div>
      <div className="mb-6">
        <div className="text-xs font-black tracking-[.25em] text-amber-300">PRODUCTION GOVERNANCE</div>
        <h2 className="mt-1 text-3xl font-black">Approval Queue</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Content changes can be reviewed in stages before release. Every decision is recorded in the admin audit log.
        </p>
      </div>
      <div className="space-y-3">
        {rows.map((r: any) => (
          <div key={r.id} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <b>
                  {r.resource} #{r.resourceId}
                </b>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
                  Stage: {r.stage} · {r.status}
                </div>
              </div>
              {r.status === "pending" && (
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={() => decide(r.id, "approved")}>
                    Approve
                  </button>
                  <button className="btn-ghost" onClick={() => decide(r.id, "rejected")}>
                    Reject
                  </button>
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-400">{r.note || "No request note."}</p>
          </div>
        ))}
        {!rows.length && <Empty t="Approval queue is empty." />}
      </div>
    </div>
  );
}
function LiveOps() {
  return (
    <div>
      <div className="mb-6">
        <div className="text-xs font-black tracking-[.25em] text-amber-300">LIVE OPS</div>
        <h2 className="mt-1 text-3xl font-black">Events and Promotions</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          The operational builders remain the canonical surfaces for time-bounded content, eligibility, missions,
          rewards, offers and limits.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/studio/ops" className="rounded-2xl border border-amber-400/20 bg-amber-400/[.04] p-6">
          <div className="text-3xl">🎪</div>
          <h3 className="mt-3 font-black">Open Live Ops Studio</h3>
          <p className="mt-2 text-xs text-slate-400">Create events, promotions and inspect operational metrics.</p>
        </Link>
        <Link href="/admin/studio/production" className="rounded-2xl border border-white/10 bg-white/[.03] p-6">
          <div className="text-3xl">🚦</div>
          <h3 className="mt-3 font-black">Open Production Pipeline</h3>
          <p className="mt-2 text-xs text-slate-400">Validate, QA, snapshot, archive and publish content.</p>
        </Link>
      </div>
    </div>
  );
}
function Metric({ l, v }: { l: string; v: any }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{l}</div>
      <div className="mt-2 text-xl font-black">{v}</div>
    </div>
  );
}
function Empty({ t }: { t: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">{t}</div>
  );
}
