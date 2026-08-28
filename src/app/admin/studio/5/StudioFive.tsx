"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StudioCommandPalette, StudioBreadcrumb } from "../StudioChrome";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
type Tab = "overview" | "matrix" | "card" | "outliers" | "dimensions" | "compare";
export default function StudioFive() {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<any>(null);
  const [decks, setDecks] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [seed, setSeed] = useState(424242);
  const [games, setGames] = useState(250);
  const [selected, setSelected] = useState<string[]>([]);
  const [experiment, setExperiment] = useState<any>(null);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  async function load() {
    const [a, b] = await Promise.all([
      fetch("/api/admin/studio/balance/analytics", { credentials: "include" }),
      fetch("/api/admin/studio/simulate", { credentials: "include" }),
    ]);
    if (a.ok) setData(await a.json());
    if (b.ok) {
      const d = await b.json();
      setDecks(d.decks || []);
      if (!selected.length) setSelected((d.decks || []).slice(0, 6).map((x: any) => x.id));
    }
  }
  useDeferredEffect(() => {
    load().catch(() => {});
  }, []);
  async function runMatrix() {
    setBusy(true);
    setNotice("");
    const r = await fetch("/api/admin/studio/balance/matrix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ deckIds: selected, gamesPerMatchup: games, seed }),
    });
    const d = await r.json();
    if (d.ok) {
      setExperiment(d);
      setNotice(`Matrix complete: ${d.rows.length} matchups / ${d.experiment.completedGames} games.`);
      await load();
      await loadExperiments();
      setTab("matrix");
    } else setNotice(d.error || "Matrix failed");
    setBusy(false);
  }
  const [experiments, setExperiments] = useState<any[]>([]);
  async function loadExperiments() {
    const r = await fetch("/api/admin/studio/balance/experiments", { credentials: "include" });
    if (r.ok) {
      const d = await r.json();
      setExperiments(d.rows || d.experiments || []);
    }
  }
  useEffect(() => {
    loadExperiments().catch(() => {});
  }, []);
  async function compare() {
    if (!a || !b) return;
    const r = await fetch(`/api/admin/studio/balance/compare?a=${a}&b=${b}`, { credentials: "include" });
    const d = await r.json();
    if (d.ok) {
      setExperiment(d.comparison);
      setNotice("Run comparison loaded.");
    } else setNotice(d.error || "Comparison failed");
  }
  return (
    <div className="studio-shell">
      <StudioCommandPalette />
      <header className="studio-topbar">
        <div className="studio-topbar-inner flex items-center justify-between gap-4">
          <div className="studio-brand">
            <div className="studio-brand-mark">◎</div>
            <div>
              <div className="studio-kicker">Runeforge // Intelligence</div>
              <div className="studio-title">Balance Intelligence Lab</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/studio/4" className="btn-ghost text-xs">
              Studio 4.0
            </Link>
            <Link href="/admin/studio/cards" className="btn-ghost text-xs">
              Card Studio
            </Link>
          </div>
        </div>
      </header>
      <main className="studio-main mx-auto max-w-[1550px]">
        <StudioBreadcrumb section="Analyze" current="Balance Intelligence" />
        {notice && (
          <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
            {notice}
          </div>
        )}
        <nav className="mb-6 flex flex-wrap gap-2">
          {(
            [
              ["overview", "📊 Overview"],
              ["matrix", "🧬 Matchup Matrix"],
              ["card", "🃏 Card Analysis"],
              ["outliers", "🚨 Outliers"],
              ["dimensions", "🧩 Class / Race / Collection"],
              ["compare", "🔬 Version Compare"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button className={tab === id ? "btn-primary" : "btn-ghost"} key={id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        {tab === "overview" && <Overview data={data} />}{" "}
        {tab === "matrix" && (
          <Matrix
            decks={decks}
            selected={selected}
            setSelected={setSelected}
            games={games}
            setGames={setGames}
            seed={seed}
            setSeed={setSeed}
            busy={busy}
            run={runMatrix}
            data={data}
            experiment={experiment}
            experiments={experiments}
          />
        )}{" "}
        {tab === "card" && <CardAnalysis />} {tab === "outliers" && <Outliers rows={data?.outliers || []} />}{" "}
        {tab === "dimensions" && <Dimensions data={data?.dimensionsByType} />}{" "}
        {tab === "compare" && (
          <Compare runs={data?.runs || []} a={a} b={b} setA={setA} setB={setB} compare={compare} result={experiment} />
        )}
      </main>
    </div>
  );
}
function CardAnalysis(){const[json,setJson]=useState('{\n  "defId":"draft_test",\n  "name":"Draft Test",\n  "region":"Emberhold",\n  "regions":["Emberhold"],\n  "type":"Unit",\n  "rarity":"Common",\n  "cost":2,\n  "power":2,\n  "health":2,\n  "description":"Candidate",\n  "collectible":true,\n  "keywords":[],\n  "classes":[]\n}'),[result,setResult]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const run=async()=>{setBusy(true);setError('');try{const card=JSON.parse(json);const r=await fetch('/api/admin/studio/balance/card',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({card,games:40})});const d=await r.json();if(!d.ok)throw Error(d.error);setResult(d.analysis);}catch(e){setError(e instanceof Error?e.message:'Analysis failed');}finally{setBusy(false);}};return <div><div className="mb-6"><div className="text-xs font-black tracking-[.25em] text-fuchsia-300">CARD CONTRIBUTION LAB</div><h2 className="mt-1 text-3xl font-black">Analyze before Publish</h2><p className="mt-2 text-sm text-slate-400">Injects two copies of the draft into matching Vanilla experimental archetypes, compares baseline vs candidate against four established decks and reports win-rate delta.</p></div><div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]"><section className="panel"><span className="label">CardDef JSON</span><textarea className="input mt-2 min-h-[380px] font-mono text-xs" value={json} onChange={e=>setJson(e.target.value)}/><button className="btn-primary mt-3" disabled={busy} onClick={run}>{busy?'Simulating…':'Run card analysis'}</button>{error&&<p className="mt-2 text-xs text-rose-300">{error}</p>}</section><section className="panel">{result?<><div className="grid grid-cols-3 gap-2"><Metric l="Avg WR delta" v={`${result.avgDelta}%`}/><Metric l="Envelope" v={result.severity}/><Metric l="Games" v={result.totalSimulatedGames}/></div><p className="mt-4 text-sm text-slate-300">{result.recommendation}</p><div className="mt-4 overflow-auto"><table className="w-full text-xs"><thead><tr className="text-slate-500"><th className="p-2 text-left">Host</th><th>Opponent</th><th>Base</th><th>Candidate</th><th>Δ</th></tr></thead><tbody>{result.rows.map((r:any,i:number)=><tr key={i} className="border-t border-white/5"><td className="p-2">{r.host}</td><td className="text-center">{r.opponent}</td><td className="text-center">{r.baselineWinRate}%</td><td className="text-center">{r.candidateWinRate}%</td><td className={`text-center font-black ${Math.abs(r.delta)>=7?'text-rose-300':Math.abs(r.delta)>=4?'text-amber-300':'text-emerald-300'}`}>{r.delta>0?'+':''}{r.delta}%</td></tr>)}</tbody></table></div></>:<Empty t="Paste a draft CardDef and run its contribution analysis."/>}</section></div></div>;}
function Overview({ data }: any) {
  const best = data?.deckMetrics?.[0],
    worst = data?.deckMetrics?.at(-1);
  return (
    <div>
      <section className="studio-hero mb-6">
        <div className="studio-kicker">Balance Intelligence</div>
        <h2>From matchup data to balance decisions</h2>
        <p>
          Run deterministic batches through the production engine, inspect matchup matrices, identify statistically
          meaningful outliers and compare saved runs across engine/ruleset provenance.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="studio-pill live">● Deterministic engine</span>
          <span className="studio-pill">Versioned experiments</span>
          <span className="studio-pill warn">Outlier monitor</span>
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric l="Decks measured" v={data?.deckMetrics?.length || 0} />
        <Metric l="Matchup rows" v={data?.matrix?.length || 0} />
        <Metric l="Outliers" v={data?.outliers?.length || 0} />
        <Metric l="Runs retained" v={data?.runs?.length || 0} />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="panel">
          <h3 className="font-black">Strongest observed deck</h3>
          {best ? (
            <div className="mt-3">
              <div className="text-2xl font-black">{best.name}</div>
              <div className="mt-1 text-amber-300">{best.winRate}% win rate</div>
              <div className="mt-2 text-xs text-slate-500">
                {best.games} games · {best.wins}-{best.losses}
              </div>
            </div>
          ) : (
            <Empty t="Run a matrix first." />
          )}
        </section>
        <section className="panel">
          <h3 className="font-black">Weakest observed deck</h3>
          {worst ? (
            <div className="mt-3">
              <div className="text-2xl font-black">{worst.name}</div>
              <div className="mt-1 text-cyan-300">{worst.winRate}% win rate</div>
              <div className="mt-2 text-xs text-slate-500">
                {worst.games} games · {worst.wins}-{worst.losses}
              </div>
            </div>
          ) : (
            <Empty t="Run a matrix first." />
          )}
        </section>
      </div>
      <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[.03] p-5 text-xs text-slate-400">
        <b className="text-amber-200">Interpretation rule:</b> dimension metrics are deck-exposure indicators, not
        causal card-level effects. Use them to prioritize investigation, then validate candidate card changes with the
        Card Studio Simulator and automated tests.
      </div>
    </div>
  );
}
function Matrix({ decks, selected, setSelected, games, setGames, seed, setSeed, busy, run, data, experiment, experiments }: any) {
  const toggle = (id: string) =>
    setSelected((s: string[]) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <div>
      <div className="mb-6">
        <div className="text-xs font-black tracking-[.25em] text-amber-300">MATCHUP MATRIX</div>
        <h2 className="mt-1 text-3xl font-black">Batch thousands of games</h2>
        <p className="mt-2 text-sm text-slate-400">
          Select up to 8 decks. Each pair runs through the same deterministic engine. Up to 1,000 games per matchup,
          producing large controlled batches.
        </p>
      </div>
      <section className="panel">
        <div className="grid gap-3 md:grid-cols-3">
          <label>
            <span className="label">Games / matchup</span>
            <input
              className="input"
              type="number"
              min={10}
              max={1000}
              value={games}
              onChange={(e) => setGames(Number(e.target.value))}
            />
          </label>
          <label>
            <span className="label">Seed</span>
            <input className="input" type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
          </label>
          <div className="flex items-end">
            <div className="text-xs text-slate-500">
              {selected.length} decks → {Math.max((selected.length * (selected.length - 1)) / 2, 0)} matchups →{" "}
              {selected.length > 1 ? ((selected.length * (selected.length - 1)) / 2) * games : 0} games
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {decks.map((d: any) => (
            <label
              key={d.id}
              className={`cursor-pointer rounded-xl border p-3 text-xs ${selected.includes(d.id) ? "border-amber-400/40 bg-amber-400/[.06]" : "border-white/10 bg-white/[.02]"}`}
            >
              <input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggle(d.id)} className="mr-2" />
              {d.name}
            </label>
          ))}
        </div>
        <button className="btn-primary mt-4" disabled={busy || selected.length < 2} onClick={run}>
          {busy ? "Running batch…" : "Run matchup matrix"}
        </button>
      </section>
      {experiment?.health && (
        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric l="Health score" v={experiment.health.healthScore} />
          <Metric l="Release gate" v={experiment.health.releaseGate.toUpperCase()} />
          <Metric l="Healthy" v={experiment.health.healthyMatchups} />
          <Metric l="Critical" v={experiment.health.criticalMatchups} />
          <Metric l="First player WR" v={`${experiment.health.firstPlayerWinRate}%`} />
        </section>
      )}
      <div className="mt-5 overflow-auto rounded-2xl border border-white/10">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/[.03] text-slate-500">
              <th className="p-3 text-left">Deck A</th>
              <th className="p-3">Deck B</th>
              <th className="p-3">Games</th>
              <th className="p-3">A WR</th>
              <th className="p-3">B WR</th>
              <th className="p-3">Rounds</th>
              <th className="p-3">Health</th>
            </tr>
          </thead>
          <tbody>
            {(experiment?.rows || data?.matrix || []).map((r: any, i: number) => {
              const rate = Number(r.winRateA);
              const status = rate < 40 || rate > 60 ? "critical" : rate < 45 || rate > 55 ? "watch" : "healthy";
              return (
              <tr key={i} className="border-t border-white/5">
                <td className="p-3">{r.deckA}</td>
                <td className="p-3">{r.deckB}</td>
                <td className="p-3 text-center">{r.games ?? r.completedGames}</td>
                <td className="p-3 text-center">{r.winRateA}%</td>
                <td className="p-3 text-center">{r.winRateB}%</td>
                <td className="p-3 text-center">{r.avgRounds}</td>
                <td className={["p-3 text-center font-black", status === "critical" ? "text-rose-300" : status === "watch" ? "text-amber-300" : "text-emerald-300"].join(" ")}>{status}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {experiments.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-2 text-xs font-black tracking-[.2em] text-slate-500">EXPERIMENT HISTORY</h4>
          <div className="overflow-auto rounded-2xl border border-white/10">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/[.03] text-slate-500">
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3">Games</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Seed</th>
                  <th className="p-3">When</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((e: any) => (
                  <tr key={e.id} className="border-t border-white/5">
                    <td className="p-3">{e.name}</td>
                    <td className="p-3 text-center">{e.mode}</td>
                    <td className="p-3 text-center">
                      {e.completedGames}/{e.totalGames}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={
                          e.status === "running"
                            ? "text-amber-300"
                            : e.status === "failed"
                              ? "text-red-300"
                              : "text-emerald-300"
                        }
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">{e.seed}</td>
                    <td className="p-3 text-center text-slate-500">
                      {e.createdAt ? new Date(e.createdAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
function Outliers({ rows }: any) {
  return (
    <div>
      <div className="mb-6">
        <div className="text-xs font-black tracking-[.25em] text-rose-300">AUTOMATED DETECTION</div>
        <h2 className="mt-1 text-3xl font-black">Balance outliers</h2>
        <p className="mt-2 text-sm text-slate-400">
          Flags deck-level observations at ≥55% or ≤45% after at least 100 games. Critical is ≥60% or ≤40%.
        </p>
      </div>
      <div className="space-y-3">
        {rows.map((r: any) => (
          <div key={r.id} className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <b>{r.name}</b>
                <div className="text-xs text-slate-500">
                  {r.games} games · {r.wins}-{r.losses}
                </div>
              </div>
              <div className={r.severity === "critical" ? "text-rose-300" : "text-amber-300"}>
                {r.winRate}% · {r.severity}
              </div>
            </div>
          </div>
        ))}
        {!rows.length && <Empty t="No statistically flagged deck outliers yet." />}
      </div>
    </div>
  );
}
function Dimensions({ data }: any) {
  return (
    <div>
      <div className="mb-6">
        <div className="text-xs font-black tracking-[.25em] text-cyan-300">EXPOSURE ANALYTICS</div>
        <h2 className="mt-1 text-3xl font-black">Class · Race · Collection</h2>
        <p className="mt-2 text-sm text-slate-400">
          Aggregates measured deck performance by content dimensions represented in those decks.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {[
          ["classes", "⚔️ Classes"],
          ["races", "🐉 Races"],
          ["collections", "📚 Collections"],
        ].map(([k, l]) => (
          <section className="panel" key={k}>
            <h3 className="font-black">{l}</h3>
            <div className="mt-3 space-y-2">
              {(data?.[k] || []).map((r: any) => (
                <div key={r.key} className="flex items-center justify-between rounded-lg bg-white/[.03] p-3 text-xs">
                  <span>{r.key}</span>
                  <span>
                    <b>{r.winRate}%</b>
                    <span className="ml-2 text-slate-500">{r.games}g</span>
                  </span>
                </div>
              ))}
              {!data?.[k]?.length && <Empty t="No dimension has 100+ measured games yet." />}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
function Compare({ runs, a, b, setA, setB, compare, result }: any) {
  return (
    <div>
      <div className="mb-6">
        <div className="text-xs font-black tracking-[.25em] text-violet-300">VERSION / RUN COMPARISON</div>
        <h2 className="mt-1 text-3xl font-black">Compare balance snapshots</h2>
        <p className="mt-2 text-sm text-slate-400">
          Compare saved runs and their engine/ruleset provenance. For card content, use the content-version diff
          endpoint before re-running the candidate scenario.
        </p>
      </div>
      <section className="panel">
        <div className="grid gap-3 md:grid-cols-2">
          <label>
            <span className="label">Baseline run</span>
            <select className="input" value={a} onChange={(e) => setA(e.target.value)}>
              <option value="">Select</option>
              {runs.map((r: any) => (
                <option key={r.id} value={r.id}>
                  #{r.id} · {r.deckA} vs {r.deckB} · {r.engineVersion}/{r.rulesetVersion}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Candidate run</span>
            <select className="input" value={b} onChange={(e) => setB(e.target.value)}>
              <option value="">Select</option>
              {runs.map((r: any) => (
                <option key={r.id} value={r.id}>
                  #{r.id} · {r.deckA} vs {r.deckB} · {r.engineVersion}/{r.rulesetVersion}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="btn-primary mt-4" disabled={!a || !b} onClick={compare}>
          Compare
        </button>
      </section>
      {result?.delta && (
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Metric l="Δ win rate A" v={`${result.delta.winRateA}%`} />
          <Metric l="Δ win rate B" v={`${result.delta.winRateB}%`} />
          <Metric l="Δ draw rate" v={`${result.delta.drawRate}%`} />
          <Metric l="Δ avg rounds" v={result.delta.avgRounds} />
        </div>
      )}
      {result?.delta && (
        <div className="mt-4 panel text-xs text-slate-400">
          Engine changed: <b>{String(result.delta.engineChanged)}</b> · Ruleset changed:{" "}
          <b>{String(result.delta.rulesetChanged)}</b>
        </div>
      )}
    </div>
  );
}
function Metric({ l, v }: { l: string; v: any }) {
  return (
    <div className="studio-metric">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{l}</div>
      <div className="mt-2 text-2xl font-black">{v ?? "—"}</div>
    </div>
  );
}
function Empty({ t }: { t: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">{t}</div>
  );
}
