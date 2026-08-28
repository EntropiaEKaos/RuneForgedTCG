"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";

export type Row = Record<string, any>;
const resources = [
  "cards", "keywords", "effects", "archetypes", "races", "classes",
  "interactions", "collections", "card-meta", "events", "promotions",
];
const labels: Record<string, string> = {
  cards: "Cards", keywords: "Keywords", effects: "Effects", archetypes: "Card Types / Archetypes",
  races: "Races", classes: "Classes", interactions: "Interactions", collections: "Collections",
  "card-meta": "Card Identity", events: "Events", promotions: "Promotions",
};

export function ResourcePicker({ resource, setResource }: { resource: string; setResource: (x: string) => void }) {
  return (
    <select className="input" value={resource} onChange={(e) => setResource(e.target.value)}>
      {resources.map((r) => (
        <option key={r} value={r}>
          {labels[r]}
        </option>
      ))}
    </select>
  );
}
export function Pipeline(p: any) {
  return (
    <div>
      <Hero
        title="Content Pipeline"
        body="Create → validate → simulate → QA → publish → version → audit. Nothing reaches production silently."
      />
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        {["Draft", "Validate", "QA", "Publish"].map((x, i) => (
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-4" key={x}>
            <div className="text-xs font-black text-amber-300">0{i + 1}</div>
            <div className="mt-1 font-black">{x}</div>
            <div className="text-[11px] text-slate-500">
              {["Author content", "Run contract checks", "Record QA result", "Immutable version"][i]}
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
          <div className="label">Content type</div>
          <ResourcePicker {...p} />
          <div className="mt-4 label">Selection</div>
          <div className="mt-2 space-y-1">
            {p.rows.map((r: Row) => (
              <button
                key={r.id}
                onClick={() => p.setSelected(r)}
                className={`w-full rounded-lg px-3 py-2 text-left text-xs ${p.selected?.id === r.id ? "bg-amber-400 text-slate-950" : "bg-white/[.03] text-slate-300"}`}
              >
                {r.name || r.key || r.defId} <span className="float-right opacity-50">#{r.id}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
          {p.selected ? (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-slate-500">{labels[p.resource]}</div>
                  <h2 className="text-2xl font-black">{p.selected.name || p.selected.key || p.selected.defId}</h2>
                  <p className="mt-1 text-xs text-slate-500">Stable identity: {p.selected.key || p.selected.defId}</p>
                </div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs">
                  {p.selected.status || p.selected.releaseState || "draft"}
                </span>
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <button className="btn-ghost" onClick={() => p.snapshotDraft()}>
                  Save Draft Snapshot
                </button>
                <button className="btn-ghost" onClick={() => p.action("archive")}>
                  Archive
                </button>
                <button className="btn-ghost" onClick={() => p.action("qa")}>
                  Run QA
                </button>
                <button className="btn-ghost" onClick={() => p.requestApproval("content")}>
                  Request Content Approval
                </button>
                <button className="btn-ghost" onClick={() => p.requestApproval("qa")}>
                  Request QA Approval
                </button>
                <button className="btn-primary" onClick={() => p.action("publish")} disabled={p.busy}>
                  Publish Version
                </button>
              </div>
              <pre className="mt-6 max-h-[420px] overflow-auto rounded-xl bg-black/30 p-4 text-[11px] text-slate-400">
                {JSON.stringify(p.selected, null, 2)}
              </pre>
            </>
          ) : (
            <Empty text="Select content to operate the production pipeline." />
          )}
        </div>
      </div>
    </div>
  );
}
export function Validator(p: any) {
  const [result, setResult] = useState<any>(null),
    [busy, setBusy] = useState(false);
  async function run() {
    if (!p.selected) return;
    setBusy(true);
    const r = await fetch("/api/admin/studio/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ resource: p.resource, row: p.selected }),
    });
    setResult(await r.json());
    setBusy(false);
  }
  return (
    <div>
      <Hero
        title="Validator"
        body="A single gate for schema, references, engine/ruleset compatibility and publication readiness."
      />
      <div className="mb-4 flex gap-2">
        <ResourcePicker resource={p.resource} setResource={p.setResource} />
        <select
          className="input max-w-md"
          value={p.selected?.id || ""}
          onChange={(e) => p.setSelected(p.rows.find((x: Row) => x.id === Number(e.target.value)) || null)}
        >
          <option value="">Select content…</option>
          {p.rows.map((r: Row) => (
            <option key={r.id} value={r.id}>
              {r.name || r.key || r.defId}
            </option>
          ))}
        </select>
        <button className="btn-primary" onClick={run} disabled={!p.selected || busy}>
          {busy ? "Checking…" : "Run validation"}
        </button>
      </div>
      {result && <Result result={result} />}
    </div>
  );
}
export function Result({ result }: any) {
  return (
    <div
      className={`rounded-2xl border p-5 ${result.ok ? "border-emerald-400/20 bg-emerald-400/[.04]" : "border-red-400/20 bg-red-400/[.04]"}`}
    >
      <div className="text-xl font-black">{result.ok ? "✓ Ready" : "✕ Blocked"}</div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {(result.checks || []).map((c: any) => (
          <div className="rounded-lg bg-black/20 p-3 text-xs" key={c.key}>
            {c.passed ? "✓" : "✕"} {c.label}
          </div>
        ))}
      </div>
      {result.errors?.length > 0 && <div className="mt-4 text-xs text-red-300">{result.errors.join(" • ")}</div>}
      {result.warnings?.length > 0 && <div className="mt-4 text-xs text-amber-300">{result.warnings.join(" • ")}</div>}
    </div>
  );
}
export function Versions(p: any) {
  const [data, setData] = useState<any[]>([]);
  const [versionA, setVersionA] = useState("");
  const [versionB, setVersionB] = useState("");
  const [diffResult, setDiffResult] = useState<any>(null);
  const [diffError, setDiffError] = useState("");
  const resourceId = p.rows[0]?.id;
  useDeferredEffect(() => {
    if (!resourceId) return;
    fetch(`/api/admin/studio/versions?resource=${p.resource}&resourceId=${resourceId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setData(d.rows || []));
    setDiffResult(null);
    setVersionA("");
    setVersionB("");
  }, [p.resource, resourceId]);

  async function runCompare() {
    setDiffError("");
    setDiffResult(null);
    if (!resourceId || !versionA || !versionB) return;
    const r = await fetch(
      `/api/admin/studio/balance/content-compare?resource=${p.resource}&resourceId=${resourceId}&versionA=${versionA}&versionB=${versionB}`,
      { credentials: "include" },
    );
    const d = await r.json();
    if (d.ok) setDiffResult(d);
    else setDiffError(d.error || "Comparison failed");
  }

  return (
    <div>
      <Hero
        title="Content Versioning"
        body="Every published snapshot records the engine and ruleset versions that created it."
      />
      <div className="mb-4">
        <ResourcePicker resource={p.resource} setResource={() => {}} />
      </div>
      {data.length ? (
        data.map((v) => (
          <div key={v.id} className="mb-2 rounded-xl border border-white/10 bg-white/[.03] p-4">
            <div className="flex justify-between">
              <b>v{v.version}</b>
              <span>{v.status}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Engine {v.engineVersion} · Ruleset {v.rulesetVersion} · {v.changeNote}
            </div>
          </div>
        ))
      ) : (
        <Empty text="Select a content item in Pipeline to inspect its history." />
      )}

      {data.length >= 2 && (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[.03] p-4">
          <h4 className="mb-2 text-sm font-bold text-slate-200">🔬 Compare two versions</h4>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input" value={versionA} onChange={(e) => setVersionA(e.target.value)}>
              <option value="">Version A…</option>
              {data.map((v) => (
                <option key={v.version} value={v.version}>
                  v{v.version}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">vs</span>
            <select className="input" value={versionB} onChange={(e) => setVersionB(e.target.value)}>
              <option value="">Version B…</option>
              {data.map((v) => (
                <option key={v.version} value={v.version}>
                  v{v.version}
                </option>
              ))}
            </select>
            <button className="btn-primary text-xs" disabled={!versionA || !versionB} onClick={runCompare}>
              Diff
            </button>
          </div>
          {diffError && <p className="mt-2 text-xs text-red-300">{diffError}</p>}
          {diffResult && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-slate-500">
                Engine changed: {String(diffResult.provenance.engineChanged)} · Ruleset changed:{" "}
                {String(diffResult.provenance.rulesetChanged)}
              </p>
              {diffResult.diff.length === 0 ? (
                <p className="text-xs text-emerald-300">No field-level differences between these versions.</p>
              ) : (
                diffResult.diff.map((d: any) => (
                  <div key={d.path} className="rounded-lg bg-black/30 p-2 font-mono text-[11px]">
                    <div className="text-amber-300">{d.path}</div>
                    <div className="text-red-300">- {JSON.stringify(d.before)}</div>
                    <div className="text-emerald-300">+ {JSON.stringify(d.after)}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export function Qa(p: any) {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    fetch(`/api/admin/studio/qa?resource=${p.resource}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setData(d.rows || []));
  }, [p.resource]);
  return (
    <div>
      <Hero
        title="QA / Publish Gate"
        body="QA runs are persisted and auditable. Publishing is blocked when validation fails."
      />
      <div className="space-y-2">
        {data.map((q) => (
          <div key={q.id} className="rounded-xl border border-white/10 bg-white/[.03] p-4">
            <div className="flex justify-between">
              <b>
                {q.passed ? "✓ PASS" : "✕ FAIL"} · {q.resource} #{q.resourceId}
              </b>
              <span className="text-xs text-slate-500">{new Date(q.createdAt).toLocaleString()}</span>
            </div>
            <div className="mt-2 text-xs text-slate-500">{(q.warnings || []).join(" • ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
export function Audit() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/admin/studio/audit?limit=150", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setRows(d.rows || []));
  }, []);
  return (
    <div>
      <Hero title="Audit Log" body="Administrative mutations are recorded as operational evidence." />
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-white/10 bg-white/[.03] p-3 text-xs">
            <b>{r.action}</b> · {r.resource} {r.resourceId ? `#${r.resourceId}` : ""}
            <span className="float-right text-slate-500">{new Date(r.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
export function Bulk(p: any) {
  const [selected, setSelected] = useState<number[]>([]);
  async function run(action: string) {
    await fetch("/api/admin/studio/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ resource: p.resource, ids: selected, action }),
    });
    p.reload();
    setSelected([]);
  }
  return (
    <div>
      <Hero
        title="Bulk Tools"
        body="Safe batch operations for archive/enable/disable. Destructive deletion remains disabled."
      />
      <ResourcePicker resource={p.resource} setResource={p.setResource} />
      <div className="my-4 flex gap-2">
        <button className="btn-ghost" onClick={() => run("enable")}>
          Enable
        </button>
        <button className="btn-ghost" onClick={() => run("disable")}>
          Disable
        </button>
        <button className="btn-ghost" onClick={() => run("archive")}>
          Archive
        </button>
        <button className="btn-ghost" onClick={() => run("duplicate")}>
          Duplicate
        </button>
      </div>
      <div className="mb-4 flex gap-2">
        <button
          className="btn-ghost"
          onClick={async () => {
            const r = await fetch(`/api/admin/studio/export?resource=${p.resource}`, { credentials: "include" });
            const blob = await r.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `runeforge-${p.resource}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export JSON
        </button>
        <label className="btn-ghost cursor-pointer">
          Import JSON
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const data = JSON.parse(await f.text());
              await fetch("/api/admin/studio/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ resource: p.resource, rows: data.rows || [] }),
              });
              p.reload();
            }}
          />
        </label>
      </div>
      <div className="space-y-1">
        {p.rows.map((r: Row) => (
          <label key={r.id} className="flex items-center gap-3 rounded-lg bg-white/[.03] p-3 text-xs">
            <input
              type="checkbox"
              checked={selected.includes(r.id)}
              onChange={(e) => setSelected(e.target.checked ? [...selected, r.id] : selected.filter((x) => x !== r.id))}
            />
            {r.name || r.key || r.defId}
          </label>
        ))}
      </div>
    </div>
  );
}
export function Collections(p: any) {
  return (
    <div>
      <Hero
        title="Collection Manager"
        body="Collections become first-class release containers for card identity, rotation and live content."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {p.rows.map((r: Row) => (
          <button
            key={r.id}
            onClick={() => p.setSelected(r)}
            className="rounded-2xl border border-white/10 bg-white/[.03] p-5 text-left hover:border-amber-400/30"
          >
            <div className="text-2xl">{r.symbol || "◆"}</div>
            <div className="mt-2 font-black">{r.name}</div>
            <div className="text-xs text-slate-500">
              {r.code} · {r.status}
            </div>
          </button>
        ))}
      </div>
      {p.selected && (
        <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[.04] p-5">
          <h3 className="font-black">{p.selected.name}</h3>
          <p className="mt-2 text-xs text-slate-400">{p.selected.description}</p>
          <pre className="mt-4 text-[11px] text-slate-500">{JSON.stringify(p.selected.metadata, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
export function Simulator() {
  return (
    <div>
      <Hero
        title="Simulator Lab"
        body="Use the existing Rule Graph sandbox as the canonical engine simulator. This surface is the QA cockpit around it."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/admin/studio?tab=interactions"
          className="rounded-2xl border border-amber-400/20 bg-amber-400/[.04] p-5"
        >
          <div className="text-2xl">🧩</div>
          <b>Open Rule Graph</b>
          <p className="mt-1 text-xs text-slate-500">
            Choose real CardDef fixtures and execute the rule through the engine.
          </p>
        </Link>
        <Link href="/simulate" className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
          <div className="text-2xl">🎮</div>
          <b>Game Simulator</b>
          <p className="mt-1 text-xs text-slate-500">Run the normal gameplay simulator without modifying content.</p>
        </Link>
        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
          <div className="text-2xl">📜</div>
          <b>Event Timeline</b>
          <p className="mt-1 text-xs text-slate-500">Rule tests expose BEFORE → EVENTS → AFTER from the same engine.</p>
        </div>
      </div>
    </div>
  );
}
export function Hero({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-6">
      <div className="text-[10px] font-black tracking-[.3em] text-amber-300">CONTENT ENGINEERING</div>
      <h2 className="mt-1 text-3xl font-black">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-400">{body}</p>
    </div>
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-white/10 text-xs text-slate-500">
      {text}
    </div>
  );
}
