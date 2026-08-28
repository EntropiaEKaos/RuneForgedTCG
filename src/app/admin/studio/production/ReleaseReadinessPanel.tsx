"use client";

import Link from "next/link";
import { useState } from "react";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";

type ResourceReadiness = {
  resource: string;
  total: number;
  draft: number;
  qa: number;
  published: number;
  archived: number;
  "unversioned-live": number;
  unversionedLive: Array<{ id: number; name: string }>;
};

type ReadinessPayload = {
  ok: boolean;
  generatedAt: string;
  authority: {
    diagnosticOnly: boolean;
    engineVersion: string;
    rulesetVersion: string;
  };
  totals: {
    total: number;
    draft: number;
    qa: number;
    published: number;
    archived: number;
    unversionedLive: number;
    pendingApprovals: number;
    recentQaFailures: number;
    labRegressions: number;
  };
  resources: ResourceReadiness[];
  activeRelease: null | {
    version: number;
    contentHash: string;
    actor: string;
    createdAt: string;
    resource: string | null;
    resourceId: number | null;
    resourceVersion: number | null;
    engineVersion: string | null;
    rulesetVersion: string | null;
  };
  pendingApprovals: Array<{
    id: number;
    resource: string;
    resourceId: number;
    stage: string;
    requestedBy: string;
    createdAt: string;
  }>;
  recentQaFailures: Array<{
    resource: string;
    resourceId: number | null;
    createdAt: string;
  }>;
  labRegressions: Array<{
    defId: string;
    iterations: number;
    passed: number;
    failed: number;
    engineVersion: string;
    rulesetVersion: string;
    contentVersion: string;
    createdAt: string;
  }>;
  recentVersions: Array<{
    resource: string;
    resourceId: number;
    version: number;
    status: string;
    author: string;
    engineVersion: string | null;
    rulesetVersion: string | null;
    createdAt: string;
  }>;
};

const RESOURCE_LABELS: Record<string, string> = {
  cards: "Cards",
  keywords: "Keywords",
  effects: "Effects",
  archetypes: "Archetypes",
  races: "Races",
  classes: "Classes",
  interactions: "Interactions",
  collections: "Collections",
  "card-meta": "Card Identity",
  events: "Events",
  promotions: "Promotions",
};

function labelFor(resource: string): string {
  return RESOURCE_LABELS[resource] || resource;
}

function dateTime(value: string): string {
  return new Date(value).toLocaleString();
}

export default function ReleaseReadinessPanel() {
  const [data, setData] = useState<ReadinessPayload | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/studio/readiness", { credentials: "include", cache: "no-store" });
      const payload = await response.json() as Partial<ReadinessPayload> & { error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Release readiness unavailable");
      setData(payload as ReadinessPayload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Release readiness unavailable");
    } finally {
      setBusy(false);
    }
  }

  useDeferredEffect(() => {
    void load();
  }, []);

  const attention = data
    ? data.totals.labRegressions > 0 || data.totals.recentQaFailures > 0
      ? "investigate"
      : data.totals.unversionedLive > 0 || data.totals.pendingApprovals > 0 || data.totals.qa > 0
        ? "attention"
        : "clear"
    : "loading";

  const releaseVersionMismatch = Boolean(data?.activeRelease && (
    (data.activeRelease.engineVersion && data.activeRelease.engineVersion !== data.authority.engineVersion)
    || (data.activeRelease.rulesetVersion && data.activeRelease.rulesetVersion !== data.authority.rulesetVersion)
  ));

  return (
    <div>
      <section className="studio-hero mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="studio-kicker">Production / Release Intelligence</p>
            <h2>Release Readiness Cockpit</h2>
            <p className="max-w-4xl">
              One operational view of immutable versions, runtime state, approvals, QA evidence and Card Lab regressions.
              This panel is diagnostic only: the server-side publish pipeline remains the authoritative release gate.
            </p>
          </div>
          <button type="button" className="btn-ghost text-xs" onClick={() => void load()} disabled={busy}>
            {busy ? "Refreshing…" : "Refresh evidence"}
          </button>
        </div>
      </section>

      {error && (
        <div className="mb-5 rounded-xl border border-red-400/20 bg-red-400/[.06] p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {!data ? (
        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-8 text-center text-sm text-slate-500">
          {busy ? "Loading release evidence…" : "No readiness evidence available."}
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-3 xl:grid-cols-[1.15fr_.85fr]">
            <section className={`rounded-2xl border p-5 ${attention === "investigate" ? "border-red-400/25 bg-red-400/[.05]" : attention === "attention" ? "border-amber-300/25 bg-amber-300/[.05]" : "border-emerald-300/25 bg-emerald-300/[.05]"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.2em] text-slate-500">Operational posture</p>
                  <h3 className="mt-1 text-2xl font-black text-white">
                    {attention === "investigate" ? "Investigate signals" : attention === "attention" ? "Release queue needs attention" : "No diagnostic warnings"}
                  </h3>
                </div>
                <span className={`studio-pill ${attention === "clear" ? "live" : ""}`}>
                  {attention === "investigate" ? "CHECK" : attention === "attention" ? "REVIEW" : "CLEAR"}
                </span>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                This posture summarizes evidence; it never grants permission to publish. Clicking Publish still re-runs validation,
                regression tests, dependency checks, balance analysis and content-bound approvals on the server.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span className="rounded-full border border-white/10 px-2 py-1">Engine {data.authority.engineVersion}</span>
                <span className="rounded-full border border-white/10 px-2 py-1">Ruleset {data.authority.rulesetVersion}</span>
                <span className="rounded-full border border-white/10 px-2 py-1">Evidence {dateTime(data.generatedAt)}</span>
              </div>
            </section>

            <section className={`rounded-2xl border p-5 ${releaseVersionMismatch ? "border-amber-300/25 bg-amber-300/[.05]" : "border-cyan-300/20 bg-cyan-300/[.035]"}`}>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">Active immutable release</p>
              {data.activeRelease ? (
                <>
                  <div className="mt-2 flex items-baseline gap-2"><strong className="text-3xl font-black text-white">R{data.activeRelease.version}</strong><span className="text-xs text-slate-500">global release</span></div>
                  <p className="mt-2 font-mono text-[11px] text-slate-400">{data.activeRelease.contentHash.slice(0, 20)}…</p>
                  <p className="mt-3 text-xs leading-5 text-slate-400">
                    {data.activeRelease.resource ? `${labelFor(data.activeRelease.resource)} #${data.activeRelease.resourceId} · content v${data.activeRelease.resourceVersion ?? "—"}` : "Legacy/unknown manifest target"}
                    <br />Published by {data.activeRelease.actor} · {dateTime(data.activeRelease.createdAt)}
                  </p>
                  {releaseVersionMismatch && <p className="mt-3 text-xs font-bold text-amber-200">Runtime engine/ruleset moved since this release. Review provenance before the next publication.</p>}
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No active immutable release record exists yet.</p>
              )}
            </section>
          </div>

          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label="Release metrics">
            <Metric label="Content" value={data.totals.total} detail="tracked records" />
            <Metric label="QA queue" value={data.totals.qa} detail="latest snapshot in QA" />
            <Metric label="Published" value={data.totals.published} detail="versioned + live" />
            <Metric label="Live unversioned" value={data.totals.unversionedLive} detail="runtime without immutable snapshot" tone={data.totals.unversionedLive ? "warn" : "normal"} />
            <Metric label="Approvals" value={data.totals.pendingApprovals} detail="pending decisions" tone={data.totals.pendingApprovals ? "warn" : "normal"} />
            <Metric label="Lab regressions" value={data.totals.labRegressions} detail="latest run has failures" tone={data.totals.labRegressions ? "danger" : "normal"} />
          </section>

          <section className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-300">Lifecycle matrix</p><h3 className="mt-1 font-black text-white">Runtime × immutable history</h3></div>
              <p className="max-w-xl text-right text-[11px] text-slate-500">“Live unversioned” means the current runtime state predates or bypasses an immutable Studio snapshot. It is a migration/traceability signal, not an automatic publish failure.</p>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-white/[.025] text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Resource</th><th className="px-3 py-3">Total</th><th className="px-3 py-3">Draft</th><th className="px-3 py-3">QA</th><th className="px-3 py-3">Published</th><th className="px-3 py-3">Archived</th><th className="px-3 py-3">Live unversioned</th></tr></thead>
                <tbody>
                  {data.resources.map((resource) => (
                    <tr key={resource.resource} className="border-t border-white/[.06]">
                      <td className="px-4 py-3 font-bold text-slate-200">{labelFor(resource.resource)}</td>
                      <td className="px-3 py-3 text-slate-400">{resource.total}</td>
                      <td className="px-3 py-3 text-slate-400">{resource.draft}</td>
                      <td className="px-3 py-3 text-amber-200">{resource.qa}</td>
                      <td className="px-3 py-3 text-emerald-200">{resource.published}</td>
                      <td className="px-3 py-3 text-slate-500">{resource.archived}</td>
                      <td className={`px-3 py-3 font-bold ${resource["unversioned-live"] ? "text-amber-200" : "text-slate-600"}`}>{resource["unversioned-live"]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="mb-5 grid gap-4 xl:grid-cols-3">
            <SignalPanel title="Pending approvals" count={data.pendingApprovals.length} href="/admin/studio/qa" action="Open QA">
              {data.pendingApprovals.length ? data.pendingApprovals.map((item) => (
                <SignalRow key={item.id} title={`${labelFor(item.resource)} #${item.resourceId}`} meta={`${item.stage} · ${item.requestedBy} · ${dateTime(item.createdAt)}`} />
              )) : <EmptySignal text="No pending approval requests." />}
            </SignalPanel>

            <SignalPanel title="Card Lab regressions" count={data.labRegressions.length} href="/admin/studio/lab/history" action="Open Lab History" danger={data.labRegressions.length > 0}>
              {data.labRegressions.length ? data.labRegressions.map((item) => (
                <SignalRow key={item.defId} title={item.defId} meta={`${item.passed}/${item.iterations} passed · ${item.failed} failed · ${dateTime(item.createdAt)}`} danger />
              )) : <EmptySignal text="Latest sampled Card Lab runs have no failures." />}
            </SignalPanel>

            <SignalPanel title="Recent QA failures" count={data.recentQaFailures.length} href="/admin/studio/qa" action="Inspect QA" danger={data.recentQaFailures.length > 0}>
              {data.recentQaFailures.length ? data.recentQaFailures.map((item, index) => (
                <SignalRow key={`${item.resource}:${item.resourceId}:${index}`} title={`${labelFor(item.resource)} #${item.resourceId ?? "—"}`} meta={`Diagnostic QA run · ${dateTime(item.createdAt)}`} danger />
              )) : <EmptySignal text="No failures in the recent persisted QA sample." />}
            </SignalPanel>
          </div>

          {data.totals.unversionedLive > 0 && (
            <section className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-300/[.04] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-300">Traceability debt</p><h3 className="mt-1 font-black text-white">Runtime-enabled content without immutable Studio history</h3></div><span className="studio-pill">{data.totals.unversionedLive} records</span></div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {data.resources.filter((resource) => resource.unversionedLive.length).map((resource) => (
                  <div key={resource.resource} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs font-black text-slate-200">{labelFor(resource.resource)} · {resource["unversioned-live"]}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">{resource.unversionedLive.map((item) => item.name).join(" · ")}{resource["unversioned-live"] > resource.unversionedLive.length ? " · …" : ""}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-300">Immutable activity</p><h3 className="mt-1 font-black text-white">Recent content snapshots</h3></div><Link href="/admin/studio/audit" className="btn-ghost text-xs">Audit Log</Link></div>
            <div className="mt-3 space-y-2">
              {data.recentVersions.length ? data.recentVersions.map((version) => (
                <div key={`${version.resource}:${version.resourceId}:${version.version}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[.07] bg-white/[.025] px-3 py-2">
                  <div><b className="text-xs text-slate-200">{labelFor(version.resource)} #{version.resourceId} · v{version.version}</b><p className="mt-0.5 text-[10px] text-slate-500">{version.author} · {dateTime(version.createdAt)}</p></div>
                  <div className="flex items-center gap-2"><span className="studio-pill">{version.status}</span><span className="hidden text-[10px] text-slate-600 md:inline">E {version.engineVersion || "—"} · R {version.rulesetVersion || "—"}</span></div>
                </div>
              )) : <EmptySignal text="No immutable content snapshots recorded yet." />}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, detail, tone = "normal" }: { label: string; value: number; detail: string; tone?: "normal" | "warn" | "danger" }) {
  return <div className={`rounded-xl border p-4 ${tone === "danger" ? "border-red-400/20 bg-red-400/[.04]" : tone === "warn" ? "border-amber-300/20 bg-amber-300/[.04]" : "border-white/10 bg-white/[.03]"}`}><p className="text-[9px] font-black uppercase tracking-[.16em] text-slate-500">{label}</p><p className={`mt-1 text-2xl font-black ${tone === "danger" ? "text-red-200" : tone === "warn" ? "text-amber-200" : "text-white"}`}>{value}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{detail}</p></div>;
}

function SignalPanel({ title, count, href, action, danger = false, children }: { title: string; count: number; href: string; action: string; danger?: boolean; children: React.ReactNode }) {
  return <section className={`rounded-2xl border p-4 ${danger ? "border-red-400/20 bg-red-400/[.035]" : "border-white/10 bg-slate-950/45"}`}><div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">Signal</p><h3 className="mt-1 font-black text-white">{title} <span className="text-slate-500">· {count}</span></h3></div><Link href={href} className="text-[10px] font-black uppercase tracking-wider text-amber-300 hover:text-white">{action}</Link></div><div className="mt-3 space-y-2">{children}</div></section>;
}

function SignalRow({ title, meta, danger = false }: { title: string; meta: string; danger?: boolean }) {
  return <div className="rounded-lg border border-white/[.06] bg-black/20 p-2.5"><p className={`text-xs font-bold ${danger ? "text-red-100" : "text-slate-200"}`}>{title}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{meta}</p></div>;
}

function EmptySignal({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-slate-500">{text}</p>;
}
