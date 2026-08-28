import Link from "next/link";

export type MechanicsImpactReport = {
  generatedAt: string;
  authority: { diagnosticOnly: boolean; engineVersion: string; rulesetVersion: string; note: string };
  target: {
    id: number;
    kind: "keyword" | "effect" | "archetype";
    key: string;
    name: string;
    enabled: boolean;
    support: { valid: boolean; mode: string; label: string };
  };
  status: "clear" | "attention" | "blocker";
  tracking: { coverage: "tracked" | "untracked"; reason: string | null };
  counts: { total: number; direct: number; indirect: number; live: number; draft: number; base: number; custom: number };
  warnings: Array<{ severity: "attention" | "blocker"; message: string }>;
  cards: Array<{
    defId: string;
    name: string;
    region: string | null;
    type: string | null;
    rarity: string | null;
    source: "base" | "custom";
    impact: "direct" | "indirect";
    live: boolean;
    releaseState: string;
    qa: { passed: boolean; createdAt: string } | null;
    lab: { passed: number; failed: number; engineVersion: string; rulesetVersion: string; contentVersion: string; createdAt: string } | null;
  }>;
  affectedCycles: string[][];
};

export default function MechanicsImpactPreflight({ report, loading, error }: { report: MechanicsImpactReport | null; loading: boolean; error: string }) {
  if (!loading && !error && !report) return null;
  return <section className="studio-section mt-5 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="studio-kicker">IMPACT PREFLIGHT // READ ONLY</div>
        <h2 className="mt-1 text-xl font-black">Mechanics blast radius</h2>
        <p className="mt-1 max-w-3xl text-xs text-slate-400">Reverse dependency analysis over the same CardDef graph used by content validation. It is diagnostic only; QA, approvals and Publish remain authoritative.</p>
      </div>
      <div className="flex gap-2">
        <Link className="btn-ghost text-xs" href="/admin/studio/dependencies">Full Dependency Graph</Link>
        <Link className="btn-ghost text-xs" href="/admin/studio/production">Production</Link>
      </div>
    </div>

    {loading && <div className="mt-5 rounded-xl border border-cyan-400/15 bg-cyan-400/[.03] p-4 text-sm text-cyan-100">Calculating direct and transitive impact…</div>}
    {error && <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[.05] p-4 text-sm text-red-200">{error}</div>}

    {report && <>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={report.status}/>
        <span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1 text-xs font-bold">{report.target.name}</span>
        <span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1 font-mono text-[10px] text-slate-400">{report.target.kind}:{report.target.key}</span>
        <span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1 text-[10px] text-slate-400">{report.target.enabled ? "LIVE mechanic" : "DRAFT mechanic"}</span>
        <span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1 text-[10px] text-slate-400">{report.target.support.label}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Metric n={report.counts.total} label="Affected"/>
        <Metric n={report.counts.direct} label="Direct"/>
        <Metric n={report.counts.indirect} label="Indirect"/>
        <Metric n={report.counts.live} label="Live / base"/>
        <Metric n={report.counts.draft} label="Draft"/>
        <Metric n={report.counts.custom} label="Custom"/>
        <Metric n={report.affectedCycles.length} label="Cycles"/>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="overflow-auto rounded-xl border border-white/10">
          <table className="studio-table w-full text-xs">
            <thead><tr><th>Card</th><th>Impact</th><th>Runtime</th><th>Release</th><th>QA</th><th>Card Lab</th></tr></thead>
            <tbody>
              {report.cards.length ? report.cards.slice(0, 100).map((card) => <tr key={card.defId}>
                <td><div className="font-bold">{card.name}</div><div className="font-mono text-[10px] text-slate-500">{card.defId}</div><div className="text-[10px] text-slate-500">{[card.region, card.type, card.rarity].filter(Boolean).join(" · ")}</div></td>
                <td><span className={card.impact === "direct" ? "text-amber-200" : "text-cyan-200"}>{card.impact.toUpperCase()}</span></td>
                <td>{card.source === "base" ? "BASE" : card.live ? "LIVE" : "DRAFT"}</td>
                <td>{card.releaseState}</td>
                <td>{card.qa ? <span className={card.qa.passed ? "text-emerald-300" : "text-red-300"}>{card.qa.passed ? "PASS" : "FAIL"}</span> : <span className="text-slate-500">—</span>}</td>
                <td>{card.lab ? <span className={card.lab.failed ? "text-red-300" : "text-emerald-300"}>{card.lab.failed ? `${card.lab.failed} fail` : `${card.lab.passed} pass`}</span> : <span className="text-slate-500">—</span>}</td>
              </tr>) : <tr><td colSpan={6} className="py-6 text-center text-slate-500">No trackable card references for this mechanic.</td></tr>}
            </tbody>
          </table>
        </div>

        <aside className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/[.02] p-4">
            <div className="label">Coverage</div>
            <div className={report.tracking.coverage === "tracked" ? "mt-1 font-bold text-emerald-300" : "mt-1 font-bold text-amber-200"}>{report.tracking.coverage === "tracked" ? "TRACKED CARD GRAPH" : "NOT KEY-ADDRESSABLE"}</div>
            {report.tracking.reason && <p className="mt-2 text-xs leading-5 text-slate-400">{report.tracking.reason}</p>}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[.02] p-4">
            <div className="label">Runtime provenance</div>
            <div className="mt-1 font-mono text-xs text-slate-300">Engine {report.authority.engineVersion}</div>
            <div className="font-mono text-xs text-slate-300">Rules {report.authority.rulesetVersion}</div>
            <p className="mt-2 text-[10px] leading-4 text-slate-500">{report.authority.note}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[.02] p-4">
            <div className="label">Warnings</div>
            {report.warnings.length ? <div className="mt-2 space-y-2">{report.warnings.map((warning, index) => <div key={`${warning.message}-${index}`} className={warning.severity === "blocker" ? "rounded-lg border border-red-400/20 bg-red-400/[.05] p-2 text-xs text-red-200" : "rounded-lg border border-amber-400/20 bg-amber-400/[.05] p-2 text-xs text-amber-100"}>{warning.message}</div>)}</div> : <p className="mt-2 text-xs text-emerald-300">No impact warning detected by this diagnostic.</p>}
          </div>
          {report.affectedCycles.length > 0 && <div className="rounded-xl border border-red-400/20 bg-red-400/[.04] p-4"><div className="label">Affected cycles</div><div className="mt-2 space-y-2">{report.affectedCycles.slice(0, 6).map((cycle, index) => <div key={index} className="font-mono text-[10px] text-red-200">{cycle.join(" → ")}</div>)}</div></div>}
        </aside>
      </div>
    </>}
  </section>;
}

function Metric({ n, label }: { n: number; label: string }) {
  return <div className="studio-metric"><div className="studio-metric-value">{n}</div><div className="studio-metric-label">{label}</div></div>;
}

function StatusBadge({ status }: { status: MechanicsImpactReport["status"] }) {
  const classes = status === "blocker" ? "border-red-400/30 bg-red-400/10 text-red-200" : status === "attention" ? "border-amber-400/30 bg-amber-400/10 text-amber-100" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  return <span className={`rounded-full border px-3 py-1 text-[10px] font-black tracking-[.16em] ${classes}`}>{status.toUpperCase()}</span>;
}
