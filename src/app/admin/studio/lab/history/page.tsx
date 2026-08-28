"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { StudioBreadcrumb, StudioCommandPalette } from "../../StudioChrome";

type LabRunRow = {
  id: number;
  defId: string;
  iterations: number;
  passed: number;
  failed: number;
  engineVersion: string;
  rulesetVersion: string;
  contentVersion: string;
  createdAt: string;
};

type CardRow = { defId: string; name: string };

type Trend = "up" | "down" | "flat" | "new";

type RunView = LabRunRow & {
  name: string;
  passRate: number;
  previousRate: number | null;
  delta: number | null;
  trend: Trend;
};

function rateOf(run: Pick<LabRunRow, "passed" | "failed">) {
  const total = run.passed + run.failed;
  return total > 0 ? Math.round((run.passed / total) * 100) : 0;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export default function CardLabHistoryPage() {
  const [runs, setRuns] = useState<LabRunRow[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useDeferredEffect(async () => {
    setLoading(true);
    setError("");
    try {
      const [runsResponse, cardsResponse] = await Promise.all([
        fetch("/api/admin/studio/card-lab?limit=100", { credentials: "include" }),
        fetch("/api/admin/studio/cards?limit=300", { credentials: "include" }),
      ]);
      const runsPayload = await runsResponse.json().catch(() => null) as { ok?: boolean; rows?: LabRunRow[]; error?: string } | null;
      const cardsPayload = await cardsResponse.json().catch(() => null) as { rows?: CardRow[]; error?: string } | null;
      if (!runsResponse.ok) throw new Error(runsPayload?.error || "Não foi possível carregar o histórico do laboratório.");
      if (!cardsResponse.ok) throw new Error(cardsPayload?.error || "Não foi possível carregar o catálogo de cartas.");
      setRuns(Array.isArray(runsPayload?.rows) ? runsPayload.rows : []);
      setCards(Array.isArray(cardsPayload?.rows) ? cardsPayload.rows : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar o histórico do laboratório.");
    } finally {
      setLoading(false);
    }
  }, []);

  const views = useMemo<RunView[]>(() => {
    const names = new Map(cards.map((card) => [card.defId, card.name]));
    const previousByCard = new Map<string, number>();
    return [...runs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((run) => {
        const passRate = rateOf(run);
        const previousRate = previousByCard.get(run.defId) ?? null;
        previousByCard.set(run.defId, passRate);
        return {
          ...run,
          name: names.get(run.defId) || run.defId,
          passRate,
          previousRate,
          delta: previousRate === null ? null : passRate - previousRate,
          trend: previousRate === null ? "new" : passRate > previousRate ? "up" : passRate < previousRate ? "down" : "flat",
        };
      });
  }, [cards, runs]);

  /* `views` is newest-first. For regression comparison, the newer run must be
     compared with the next older run of the same card, not vice versa. */
  const comparableViews = useMemo<RunView[]>(() => {
    const byCard = new Map<string, RunView[]>();
    for (const view of views) {
      const list = byCard.get(view.defId) || [];
      list.push(view);
      byCard.set(view.defId, list);
    }
    const output: RunView[] = [];
    for (const list of byCard.values()) {
      for (let index = 0; index < list.length; index += 1) {
        const current = list[index];
        const older = list[index + 1];
        const previousRate = older?.passRate ?? null;
        output.push({
          ...current,
          previousRate,
          delta: previousRate === null ? null : current.passRate - previousRate,
          trend: previousRate === null ? "new" : current.passRate > previousRate ? "up" : current.passRate < previousRate ? "down" : "flat",
        });
      }
    }
    return output.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [views]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return comparableViews;
    return comparableViews.filter((run) => [run.name, run.defId, run.engineVersion, run.rulesetVersion, run.contentVersion].join(" ").toLowerCase().includes(needle));
  }, [comparableViews, query]);

  const latestByCard = useMemo(() => {
    const map = new Map<string, RunView>();
    for (const run of comparableViews) if (!map.has(run.defId)) map.set(run.defId, run);
    return [...map.values()];
  }, [comparableViews]);

  const summary = useMemo(() => {
    const totalScenarios = runs.reduce((sum, run) => sum + run.passed + run.failed, 0);
    const weightedPasses = runs.reduce((sum, run) => sum + run.passed, 0);
    const avgRate = totalScenarios > 0 ? Math.round((weightedPasses / totalScenarios) * 100) : 0;
    const regressions = latestByCard.filter((run) => run.trend === "down").length;
    return { totalRuns: runs.length, cards: latestByCard.length, totalScenarios, avgRate, regressions };
  }, [latestByCard, runs]);

  return (
    <main className="studio-shell min-h-screen">
      <StudioCommandPalette />
      <div className="studio-main mx-auto max-w-[1500px] p-5 sm:p-8">
        <StudioBreadcrumb section="QA" current="Lab History" />

        <header className="mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70">
          <div className="bg-gradient-to-br from-fuchsia-400/10 via-transparent to-cyan-400/10 px-5 py-7 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="max-w-3xl">
                <div className="studio-kicker">QA // REGRESSION</div>
                <h1 className="studio-title mt-2">Card Laboratory History</h1>
                <p className="mt-3 text-sm leading-6 text-slate-400">Compare runs persistidos por carta, identifique quedas de pass rate e veja exatamente em quais versões de engine, ruleset e conteúdo cada QA foi executado.</p>
              </div>
              <Link href="/admin/studio/lab" className="btn-primary inline-flex">Executar novo run</Link>
            </div>
          </div>
        </header>

        {error && <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100" role="alert"><p className="font-black">Histórico indisponível</p><p className="mt-1 text-red-200/80">{error}</p></div>}

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Runs" value={summary.totalRuns} detail="janela recente" />
          <Metric label="Cartas" value={summary.cards} detail="com histórico" />
          <Metric label="Cenários" value={summary.totalScenarios} detail="executados" />
          <Metric label="Pass rate" value={`${summary.avgRate}%`} detail="ponderado" />
          <Metric label="Regressões" value={summary.regressions} detail="último run piorou" danger={summary.regressions > 0} />
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-slate-950/65 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">Último estado por carta</p><h2 className="mt-1 text-lg font-black text-white">Regression radar</h2></div>
            <input className="input min-w-[260px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar carta, defId ou versão…" aria-label="Buscar histórico" />
          </div>

          {loading ? <div className="p-10 text-center text-sm text-slate-500">Carregando runs persistidos…</div> : latestByCard.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">Nenhum run persistido ainda. Execute o laboratório para iniciar a baseline.</div> : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {latestByCard.filter((run) => !query.trim() || [run.name, run.defId].join(" ").toLowerCase().includes(query.trim().toLowerCase())).map((run) => <LatestCard key={run.defId} run={run} />)}
            </div>
          )}
        </section>

        <section className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/65">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-fuchsia-300">Audit trail</p><h2 className="mt-1 font-black text-white">Runs recentes</h2></div>
            <span className="text-xs text-slate-500">{filtered.length} registro(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-xs">
              <thead className="bg-white/[0.025] text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Quando</th><th className="px-3 py-3">Carta</th><th className="px-3 py-3">Run</th><th className="px-3 py-3">Pass rate</th><th className="px-3 py-3">Δ anterior</th><th className="px-3 py-3">Engine</th><th className="px-3 py-3">Rules</th><th className="px-5 py-3">Content</th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((run) => <HistoryRow key={run.id} run={run} />)}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-500">
          <span>Metadados QA somente leitura · relatórios brutos permanecem no servidor</span>
          <div className="flex gap-2"><Link href="/admin/studio/lab" className="btn-ghost inline-flex">Card Laboratory</Link><Link href="/admin/studio/production" className="btn-ghost inline-flex">Production</Link></div>
        </footer>
      </div>
    </main>
  );
}

function Metric({ label, value, detail, danger = false }: { label: string; value: string | number; detail: string; danger?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${danger ? "border-red-400/25 bg-red-400/[0.07]" : "border-white/10 bg-white/[0.025]"}`}><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-1 text-2xl font-black ${danger ? "text-red-300" : "text-white"}`}>{value}</p><p className="mt-1 text-[10px] text-slate-500">{detail}</p></div>;
}

function LatestCard({ run }: { run: RunView }) {
  const tone = run.trend === "down" ? "border-red-400/25 bg-red-400/[0.06]" : run.trend === "up" ? "border-emerald-400/20 bg-emerald-400/[0.05]" : "border-white/10 bg-white/[0.025]";
  return <div className={`rounded-2xl border p-4 ${tone}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black text-white">{run.name}</p><p className="mt-1 truncate font-mono text-[10px] text-slate-500">{run.defId}</p></div><TrendBadge run={run} /></div><div className="mt-4 flex items-end justify-between"><div><p className="text-[10px] uppercase text-slate-500">Último pass rate</p><p className="mt-1 text-3xl font-black text-white">{run.passRate}%</p></div><p className="text-[10px] text-slate-500">{run.iterations} cenários<br />{formatDate(run.createdAt)}</p></div></div>;
}

function HistoryRow({ run }: { run: RunView }) {
  return <tr className="text-slate-300 hover:bg-white/[0.025]"><td className="px-5 py-3 text-slate-500">{formatDate(run.createdAt)}</td><td className="px-3 py-3"><p className="font-bold text-white">{run.name}</p><p className="font-mono text-[10px] text-slate-500">{run.defId}</p></td><td className="px-3 py-3 font-mono">{run.passed}/{run.passed + run.failed}</td><td className="px-3 py-3 font-black text-white">{run.passRate}%</td><td className="px-3 py-3"><TrendBadge run={run} /></td><td className="px-3 py-3 font-mono text-[10px]">{run.engineVersion}</td><td className="px-3 py-3 font-mono text-[10px]">{run.rulesetVersion}</td><td className="px-5 py-3 font-mono text-[10px]">{run.contentVersion}</td></tr>;
}

function TrendBadge({ run }: { run: RunView }) {
  if (run.delta === null) return <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-400">baseline</span>;
  if (run.delta > 0) return <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-200">↑ +{run.delta}pp</span>;
  if (run.delta < 0) return <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2 py-1 text-[10px] font-bold text-red-200">↓ {run.delta}pp</span>;
  return <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-400">= 0pp</span>;
}
