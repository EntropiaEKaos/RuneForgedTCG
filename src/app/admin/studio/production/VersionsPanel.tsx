"use client";

import { useState } from "react";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ResourcePicker, type Row } from "./ProductionPanels";

type VersionRow = {
  id: number;
  version: number;
  status: string;
  snapshot: any;
  changeNote?: string | null;
  author?: string | null;
  engineVersion?: string | null;
  rulesetVersion?: string | null;
  createdAt?: string | null;
};

type Props = {
  resource: string;
  setResource: (value: string) => void;
  rows: Row[];
  selected: Row | null;
  setSelected: (row: Row | null) => void;
  reload: () => Promise<void> | void;
  setMessage: (message: string) => void;
};

function cardSnapshotComplete(version: VersionRow): boolean {
  if (!version.snapshot || typeof version.snapshot !== "object") return false;
  return Boolean(version.snapshot.card && version.snapshot.metadata);
}

export function Versions(props: Props) {
  const [data, setData] = useState<VersionRow[]>([]);
  const [versionA, setVersionA] = useState("");
  const [versionB, setVersionB] = useState("");
  const [diffResult, setDiffResult] = useState<any>(null);
  const [diffError, setDiffError] = useState("");
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [currentTotp, setCurrentTotp] = useState("");
  const resourceId = Number(props.selected?.id || 0);

  async function loadVersions() {
    setDiffResult(null);
    setDiffError("");
    setVersionA("");
    setVersionB("");
    if (!resourceId) {
      setData([]);
      return;
    }
    const response = await fetch(
      `/api/admin/studio/versions?resource=${encodeURIComponent(props.resource)}&resourceId=${resourceId}`,
      { credentials: "include" },
    );
    const payload = await response.json();
    setData(payload.ok ? payload.rows || [] : []);
    if (!payload.ok) props.setMessage(payload.error || "Failed to load version history.");
  }

  useDeferredEffect(() => {
    void loadVersions();
  }, [props.resource, resourceId]);

  async function runCompare() {
    setDiffError("");
    setDiffResult(null);
    if (!resourceId || !versionA || !versionB) return;
    const response = await fetch(
      `/api/admin/studio/balance/content-compare?resource=${encodeURIComponent(props.resource)}&resourceId=${resourceId}&versionA=${versionA}&versionB=${versionB}`,
      { credentials: "include" },
    );
    const payload = await response.json();
    if (payload.ok) setDiffResult(payload);
    else setDiffError(payload.error || "Comparison failed");
  }

  async function rollback(version: VersionRow) {
    if (!resourceId || !data.length || !currentPassword) return;
    const currentLatest = data[0]?.version;
    if (!currentLatest) return;
    const name = String(props.selected?.name || props.selected?.key || props.selected?.defId || `#${resourceId}`);
    if (!window.confirm(`Rollback ${name} to published v${version.version}? This creates a new audited published version; history is never deleted.`)) return;

    setBusy(true);
    props.setMessage("");
    try {
      const response = await fetch("/api/admin/studio/versions/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          resource: props.resource,
          resourceId,
          version: version.version,
          expectedLatestVersion: currentLatest,
          changeNote: `Rollback from Production Studio to published v${version.version}`,
          currentPassword,
          currentTotp,
        }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        props.setMessage(payload.error || "Rollback failed.");
        return;
      }
      props.setSelected(payload.row || null);
      props.setMessage(`Rollback complete: historical v${version.version} restored as new published v${payload.version?.version}.`);
      await props.reload();
      await loadVersions();
    } finally {
      setCurrentPassword("");
      setCurrentTotp("");
      setBusy(false);
    }
  }

  const latestPublished = data.find((version) => version.status === "published");
  const hasRollbackCandidate = data.some((version) => {
    const legacyCardSnapshot = props.resource === "cards" && !cardSnapshotComplete(version);
    return version.status === "published" && latestPublished?.version !== version.version && !legacyCardSnapshot;
  });

  return (
    <div>
      <section className="studio-hero mb-6">
        <p className="studio-kicker">Production / Immutable History</p>
        <h2>Content Versioning & Rollback</h2>
        <p>
          Inspect immutable snapshots, compare field-level changes and restore a historical published version as a new audited release.
          Rollback never deletes or rewrites history.
        </p>
      </section>

      <div className="mb-4 grid gap-3 lg:grid-cols-[280px_1fr]">
        <div>
          <div className="label">Content type</div>
          <ResourcePicker resource={props.resource} setResource={props.setResource} />
        </div>
        <div>
          <div className="label">Content item</div>
          <select
            className="input"
            value={resourceId || ""}
            onChange={(event) => props.setSelected(props.rows.find((row) => Number(row.id) === Number(event.target.value)) || null)}
          >
            <option value="">Select content…</option>
            {props.rows.map((row) => (
              <option key={String(row.id)} value={String(row.id)}>
                {String(row.name || row.key || row.defId || `#${row.id}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasRollbackCandidate && (
        <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/5 p-4">
          <div className="text-xs font-black uppercase tracking-wider text-red-200">Sensitive action re-authentication</div>
          <p className="mt-1 text-xs text-slate-400">Published rollback changes live content. Enter your current administrator credentials before choosing a historical version.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label><span className="label">Current administrator password</span><input className="input" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
            <label><span className="label">MFA / TOTP code (if enabled)</span><input className="input" inputMode="numeric" autoComplete="one-time-code" value={currentTotp} onChange={(event) => setCurrentTotp(event.target.value.replace(/\D/g, "").slice(0, 8))} /></label>
          </div>
        </div>
      )}

      {!resourceId ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
          Select a content item to inspect its immutable version history.
        </div>
      ) : data.length ? (
        <div className="space-y-2">
          {data.map((version) => {
            const legacyCardSnapshot = props.resource === "cards" && !cardSnapshotComplete(version);
            const currentPublished = latestPublished?.version === version.version;
            const rollbackEligible = version.status === "published" && !currentPublished && !legacyCardSnapshot;
            return (
              <div key={version.id} className="rounded-xl border border-white/10 bg-white/[.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <b>v{version.version}</b>
                      <span className="studio-pill">{version.status}</span>
                      {currentPublished && <span className="studio-pill live">current published</span>}
                      {legacyCardSnapshot && <span className="studio-pill">legacy card snapshot · rollback blocked</span>}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Engine {version.engineVersion || "—"} · Ruleset {version.rulesetVersion || "—"}
                      {version.author ? ` · ${version.author}` : ""}
                      {version.createdAt ? ` · ${new Date(version.createdAt).toLocaleString()}` : ""}
                    </div>
                    {version.changeNote && <div className="mt-2 text-xs text-slate-400">{version.changeNote}</div>}
                  </div>
                  {rollbackEligible && (
                    <button className="btn-ghost text-xs" disabled={busy || !currentPassword} onClick={() => void rollback(version)}>
                      {busy ? "Working…" : `Rollback to v${version.version}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
          No version snapshots exist for this content item yet.
        </div>
      )}

      {data.length >= 2 && (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[.03] p-4">
          <h4 className="mb-2 text-sm font-bold text-slate-200">🔬 Compare two versions</h4>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input" value={versionA} onChange={(event) => setVersionA(event.target.value)}>
              <option value="">Version A…</option>
              {data.map((version) => <option key={version.version} value={version.version}>v{version.version}</option>)}
            </select>
            <span className="text-xs text-slate-500">vs</span>
            <select className="input" value={versionB} onChange={(event) => setVersionB(event.target.value)}>
              <option value="">Version B…</option>
              {data.map((version) => <option key={version.version} value={version.version}>v{version.version}</option>)}
            </select>
            <button className="btn-primary text-xs" disabled={!versionA || !versionB} onClick={() => void runCompare()}>
              Diff
            </button>
          </div>
          {diffError && <p className="mt-2 text-xs text-red-300">{diffError}</p>}
          {diffResult && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-slate-500">
                Engine changed: {String(diffResult.provenance.engineChanged)} · Ruleset changed: {String(diffResult.provenance.rulesetChanged)}
              </p>
              {diffResult.diff.length === 0 ? (
                <p className="text-xs text-emerald-300">No field-level differences between these versions.</p>
              ) : diffResult.diff.map((entry: any) => (
                <div key={entry.path} className="rounded-lg bg-black/30 p-2 font-mono text-[11px]">
                  <div className="text-amber-300">{entry.path}</div>
                  <div className="text-red-300">- {JSON.stringify(entry.before)}</div>
                  <div className="text-emerald-300">+ {JSON.stringify(entry.after)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Versions;
