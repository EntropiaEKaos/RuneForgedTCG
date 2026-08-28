"use client";
import { useCallback, useMemo, useState } from "react";
import { StudioCommandPalette, StudioBreadcrumb } from "./StudioChrome";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { CardStudioLink, MechanicsStudioLink, Overview, ResourceStudio } from "./SuperAdminPanels";
import { resources, type Resource, type Row } from "./SuperAdminModel";

export default function SuperAdminStudio() {
  const [tab, setTab] = useState<Resource>("overview");
  const [auth, setAuth] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const check = useCallback(async () => {
    const r = await fetch("/api/admin/stats", { credentials: "include" });
    setAuth(r.ok);
  }, []);
  useDeferredEffect(() => {
    check();
  }, [check]);

  const load = useCallback(async () => {
    if (!auth || tab === "overview" || tab === "cards" || tab === "mechanics") return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/studio/${tab}`, { credentials: "include" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setRows(d.rows || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setBusy(false);
    }
  }, [auth, tab]);
  useDeferredEffect(() => {
    load();
    setEditing(null);
    setSearch("");
  }, [load]);

  const login = async () => {
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      credentials: "include",
    });
    const d = await r.json();
    if (!d.ok) return setError(d.error || "Login failed");
    setAuth(true);
    setPassword("");
  };
  const logout = async () => {
    await fetch("/api/admin/login", { method: "DELETE", credentials: "include" });
    setAuth(false);
  };

  const save = async () => {
    if (!editing || !tab || tab === "overview" || tab === "cards") return;
    setBusy(true);
    setError("");
    try {
      const isEdit = Boolean(editing.id);
      const url = isEdit ? `/api/admin/studio/${tab}/${editing.id}` : `/api/admin/studio/${tab}`;
      const r = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editing),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setNotice(isEdit ? "Saved." : "Created.");
      await load();
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (row: Row) => {
    if (!confirm(`Delete ${row.name || row.key || row.defId || row.id}?`)) return;
    const r = await fetch(`/api/admin/studio/${tab}/${row.id}`, { method: "DELETE", credentials: "include" });
    const d = await r.json();
    if (!d.ok) setError(d.error);
    else load();
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return q ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  if (!auth)
    return (
      <div className="grid min-h-screen place-items-center bg-[#05070c] text-slate-100">
        <div className="w-full max-w-sm rounded-2xl border border-amber-400/20 bg-slate-900 p-8 shadow-2xl">
          <div className="text-center text-3xl">◈</div>
          <h1 className="mt-2 text-center text-2xl font-black text-amber-300">Runeforge Super Admin</h1>
          <p className="mt-2 text-center text-xs text-slate-400">Content, live ops, collections & player control</p>
          <input
            type="password"
            className="input mt-6"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="Admin password"
          />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <button onClick={login} className="btn-primary mt-4 w-full">
            Enter Control Room
          </button>
        </div>
      </div>
    );

  return (
    <div className="studio-shell">
      <StudioCommandPalette />
      <header className="studio-topbar">
        <div className="studio-topbar-inner flex items-center justify-between gap-4">
          <div className="studio-brand">
            <div className="studio-brand-mark">◈</div>
            <div>
              <div className="studio-kicker">Runeforge // Control Room</div>
              <div className="studio-title">Super Admin Studio</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={logout} className="btn-ghost !px-3 !py-1.5 text-xs">
              Logout
            </button>
          </div>
        </div>
      </header>
      <div className="studio-layout">
        <aside className="studio-sidebar">
          <div className="studio-nav-label">Control Plane</div>
          <div className="studio-nav-list">
            {resources.map((x) => (
              <button
                key={x.id}
                onClick={() => setTab(x.id)}
                className={`studio-nav-item ${tab === x.id ? "active" : ""}`}
              >
                <span>{x.icon}</span>
                {x.label}
              </button>
            ))}
          </div>
        </aside>
        <main className="studio-main">
          <StudioBreadcrumb
            current={tab === "overview" ? "Overview" : resources.find((x) => x.id === tab)?.label || tab}
          />
          {notice && (
            <div className="mb-4 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
              {notice}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}
          {tab === "overview" ? (
            <Overview onTab={setTab} />
          ) : tab === "cards" ? (
            <CardStudioLink />
          ) : tab === "mechanics" ? (
            <MechanicsStudioLink />
          ) : (
            <ResourceStudio
              tab={tab}
              rows={filtered}
              editing={editing}
              setEditing={setEditing}
              search={search}
              setSearch={setSearch}
              save={save}
              remove={remove}
              busy={busy}
            />
          )}
        </main>
      </div>
    </div>
  );
}

