"use client";
import { useState } from "react";
import Link from "next/link";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { StudioCommandPalette, StudioBreadcrumb } from "../StudioChrome";
import { Audit, Bulk, Collections, Pipeline, Qa, Simulator, Validator, type Row } from "./ProductionPanels";
import ReleaseReadinessPanel from "./ReleaseReadinessPanel";
import Versions from "./VersionsPanel";

type Module = "readiness" | "pipeline" | "simulator" | "validator" | "versions" | "qa" | "audit" | "bulk" | "collections";

export default function ProductionStudio() {
  const [auth, setAuth] = useState(false),
    [tab, setTab] = useState<Module>("readiness"),
    [resource, setResource] = useState("collections"),
    [rows, setRows] = useState<Row[]>([]),
    [selected, setSelected] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const check = async () => {
    const r = await fetch("/api/admin/stats", { credentials: "include" });
    setAuth(r.ok);
  };
  useDeferredEffect(() => {
    check();
  }, []);
  useDeferredEffect(() => {
    setSelected(null);
  }, [resource]);
  useDeferredEffect(() => {
    if (auth && ["pipeline", "collections", "bulk", "validator", "versions"].includes(tab)) load();
  }, [auth, resource, tab]);
  async function load() {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/studio/${resource}?limit=300`, { credentials: "include" }),
        d = await r.json();
      setRows(d.rows || []);
    } finally {
      setBusy(false);
    }
  }
  async function requestApproval(stage: string) {
    if (!selected) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/studio/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          resource,
          resourceId: selected.id,
          stage,
          note: `${stage} approval requested from Production Studio`,
        }),
      });
      const d = await r.json();
      setMessage(d.ok ? `Approval requested for ${stage}.` : d.error || "Approval request failed");
    } finally {
      setBusy(false);
    }
  }
  async function snapshotDraft() {
    if (!selected) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/studio/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          resource,
          resourceId: selected.id,
          status: "draft",
          changeNote: "Draft snapshot from Production Studio",
        }),
      });
      const d = await r.json();
      setMessage(d.ok ? `Draft v${d.row.version} saved.` : d.error || "Draft failed");
    } finally {
      setBusy(false);
    }
  }
  async function action(a: string) {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/admin/studio/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ resource, resourceId: selected.id, action: a, changeNote: `${a} from Content Studio` }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setMessage(`${a} completed.`);
      load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  if (!auth)
    return (
      <div className="grid min-h-screen place-items-center bg-[#05070c] text-white">
        <div className="rounded-2xl border border-amber-400/20 bg-slate-900 p-8 text-center">
          <div className="text-3xl">🧪</div>
          <h1 className="mt-2 text-2xl font-black">Content Production Studio</h1>
          <p className="mt-2 text-xs text-slate-500">Sign in through the Super Admin Control Room first.</p>
          <Link href="/admin/studio" className="btn-primary mt-5 inline-flex">
            Open Control Room
          </Link>
        </div>
      </div>
    );
  return (
    <div className="studio-shell min-h-screen bg-[#05070c] text-slate-100">
      <StudioCommandPalette />
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070a11]/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div>
            <div className="text-[10px] font-black tracking-[.3em] text-amber-300">RUNEFORGE // CONTENT PIPELINE</div>
            <h1 className="text-xl font-black">Production Studio 2.0</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/studio" className="btn-ghost text-xs">
              Control Room
            </Link>
            <Link href="/admin/studio?tab=interactions" className="btn-ghost text-xs">
              Rule Graph
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[230px_1fr]">
        <aside className="border-r border-white/10 p-3">
          <div className="space-y-1">
            {(
              [
                ["readiness", "📡 Release Readiness"],
                ["pipeline", "🚀 Pipeline"],
                ["simulator", "🧪 Simulator Lab"],
                ["validator", "✓ Validator"],
                ["versions", "🕐 Versioning"],
                ["qa", "🔍 QA / Publish"],
                ["audit", "📜 Audit Log"],
                ["bulk", "⚡ Bulk Tools"],
                ["collections", "📚 Collection Manager"],
              ] as [Module, string][]
            ).map(([id, l]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-xs font-bold ${tab === id ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </aside>
        <main className="min-w-0 p-5">
          <StudioBreadcrumb section="Production" current={tab === "readiness" ? "Release Readiness" : "Publishing Pipeline"} />
          {message && (
            <div className="mb-4 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
              {message}
            </div>
          )}
          {tab === "readiness" && <ReleaseReadinessPanel />}
          {tab === "pipeline" && (
            <Pipeline
              resource={resource}
              setResource={setResource}
              rows={rows}
              selected={selected}
              setSelected={setSelected}
              action={action}
              snapshotDraft={snapshotDraft}
              requestApproval={requestApproval}
              busy={busy}
            />
          )}{" "}
          {tab === "simulator" && <Simulator />}
          {tab === "validator" && (
            <Validator
              resource={resource}
              rows={rows}
              setResource={setResource}
              selected={selected}
              setSelected={setSelected}
            />
          )}{" "}
          {tab === "versions" && (
            <Versions
              resource={resource}
              setResource={setResource}
              rows={rows}
              selected={selected}
              setSelected={setSelected}
              reload={load}
              setMessage={setMessage}
            />
          )}{" "}
          {tab === "qa" && <Qa resource={resource} rows={rows} />} {tab === "audit" && <Audit />}
          {tab === "bulk" && <Bulk resource={resource} setResource={setResource} rows={rows} reload={load} />}{" "}
          {tab === "collections" && (
            <Collections
              rows={rows}
              selected={selected}
              setSelected={setSelected}
              resource={resource}
              setResource={setResource}
            />
          )}
        </main>
      </div>
    </div>
  );
}