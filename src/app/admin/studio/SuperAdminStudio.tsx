"use client";
import { useCallback, useMemo, useState } from "react";
import { StudioCommandPalette, StudioBreadcrumb } from "./StudioChrome";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { CardStudioLink, MechanicsStudioLink, Overview, ResourceStudio } from "./SuperAdminPanels";
import { resources, type Resource, type Row } from "./SuperAdminModel";
import { canAccessStudioAuthoring, hasStudioUiCapability, studioLandingForRole } from "@/lib/admin-studio-access";

type StudioUser = { username: string; role: string };

export default function SuperAdminStudio({ initialUser = null }: { initialUser?: StudioUser | null }) {
  const [tab, setTab] = useState<Resource>("overview");
  const [auth, setAuth] = useState(Boolean(initialUser && canAccessStudioAuthoring(initialUser.role)));
  const [user, setUser] = useState<StudioUser | null>(initialUser);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const role = user?.role;
  const visibleResources = useMemo(
    () => resources.filter((resource) => hasStudioUiCapability(role, resource.capability)),
    [role],
  );
  const canDelete = hasStudioUiCapability(role, "delete");

  const check = useCallback(async () => {
    const r = await fetch("/api/admin/session", { credentials: "include" });
    if (!r.ok) {
      setAuth(false);
      setUser(null);
      return;
    }
    const d = await r.json();
    const nextUser = d?.user ? { username: String(d.user.username || ""), role: String(d.user.role || "") } : null;
    if (!nextUser || !canAccessStudioAuthoring(nextUser.role)) {
      setAuth(false);
      setUser(nextUser);
      if (nextUser?.role) window.location.replace(studioLandingForRole(nextUser.role));
      return;
    }
    setUser(nextUser);
    setAuth(true);
  }, []);
  useDeferredEffect(() => {
    check();
  }, [check]);
  useDeferredEffect(() => {
    if (auth && !visibleResources.some((resource) => resource.id === tab)) setTab("overview");
  }, [auth, tab, visibleResources]);

  const load = useCallback(async () => {
    if (!auth || tab === "overview" || tab === "cards" || tab === "mechanics") return;
    if (!visibleResources.some((resource) => resource.id === tab)) return;
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
  }, [auth, tab, visibleResources]);
  useDeferredEffect(() => {
    load();
    setEditing(null);
    setSearch("");
  }, [load]);

  const login = async () => {
    setError("");
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), password, totp: totp.trim() || undefined }),
      credentials: "include",
    });
    const d = await r.json();
    if (!d.ok) return setError(d.error || "Login failed");
    const nextUser = d.user ? { username: String(d.user.username || username), role: String(d.user.role || "") } : null;
    setPassword("");
    setTotp("");
    if (!nextUser || !canAccessStudioAuthoring(nextUser.role)) {
      setUser(nextUser);
      setAuth(false);
      window.location.assign(studioLandingForRole(nextUser?.role));
      return;
    }
    setUser(nextUser);
    setAuth(true);
  };
  const logout = async () => {
    await fetch("/api/admin/login", { method: "DELETE", credentials: "include" });
    setAuth(false);
    setUser(null);
  };

  const save = async () => {
    if (!editing || !tab || tab === "overview" || tab === "cards") return;
    if (!visibleResources.some((resource) => resource.id === tab)) return;
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
    if (!canDelete) return;
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
          <h1 className="mt-2 text-center text-2xl font-black text-amber-300">Runeforge Studio Access</h1>
          <p className="mt-2 text-center text-xs text-slate-400">Authoring is restricted to administrators and designers.</p>
          <label className="mt-6 block text-[10px] font-black uppercase tracking-[.16em] text-slate-400">
            Username
            <input
              autoComplete="username"
              className="input mt-1"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin or designer username"
            />
          </label>
          <label className="mt-3 block text-[10px] font-black uppercase tracking-[.16em] text-slate-400">
            Password
            <input
              type="password"
              autoComplete="current-password"
              className="input mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void login()}
              placeholder="Operator password"
            />
          </label>
          <label className="mt-3 block text-[10px] font-black uppercase tracking-[.16em] text-slate-400">
            MFA code <span className="font-normal text-slate-600">optional unless enabled</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              className="input mt-1 font-mono tracking-[.22em]"
              value={totp}
              maxLength={8}
              onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 8))}
              onKeyDown={(e) => e.key === "Enter" && void login()}
              placeholder="000000"
            />
          </label>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <button onClick={() => void login()} className="btn-primary mt-4 w-full">
            Enter Authoring Studio
          </button>
        </div>
      </div>
    );

  return (
    <div className="studio-shell">
      <StudioCommandPalette role={role} />
      <header className="studio-topbar">
        <div className="studio-topbar-inner flex items-center justify-between gap-4">
          <div className="studio-brand">
            <div className="studio-brand-mark">◈</div>
            <div>
              <div className="studio-kicker">Runeforge // Authoring Control Room</div>
              <div className="studio-title">Studio <span className="text-xs font-bold text-slate-500">{user?.username} · {user?.role}</span></div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void logout()} className="btn-ghost !px-3 !py-1.5 text-xs">
              Logout
            </button>
          </div>
        </div>
      </header>
      <div className="studio-layout">
        <aside className="studio-sidebar">
          <div className="studio-nav-label">Control Plane</div>
          <div className="studio-nav-list">
            {visibleResources.map((x) => (
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
            current={tab === "overview" ? "Overview" : visibleResources.find((x) => x.id === tab)?.label || tab}
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
            <Overview onTab={setTab} visibleResources={visibleResources} />
          ) : tab === "cards" ? (
            <CardStudioLink role={role} />
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
              canDelete={canDelete}
            />
          )}
        </main>
      </div>
    </div>
  );
}
