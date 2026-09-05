"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StudioBreadcrumb, StudioCommandPalette } from "../StudioChrome";

type StudioUser = { username: string; role: string };
type SiteStatus = "draft" | "review" | "published" | "archived";
type SiteResource =
  | "home" | "navigation" | "pages" | "cards" | "collections" | "regions"
  | "keywords" | "rules" | "lore" | "news" | "media" | "seo"
  | "alpha" | "events" | "promotions" | "roadmap";

type SiteItem = {
  id: number;
  resource: SiteResource;
  slug: string;
  locale: string;
  status: SiteStatus;
  payload: Record<string, unknown>;
  seo: Record<string, unknown>;
  version: number;
  updatedBy: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type SiteVersion = {
  id: number;
  contentId: number;
  version: number;
  status: SiteStatus;
  snapshot: Record<string, unknown>;
  actor: string;
  changeNote: string;
  createdAt: string;
};

type EditorState = {
  exists: boolean;
  slug: string;
  version: number;
  currentStatus: SiteStatus;
  saveStatus: "draft" | "review";
  payloadText: string;
  seoText: string;
  changeNote: string;
};

const RESOURCE_META: Array<{ id: SiteResource; label: string; desc: string; icon: string }> = [
  { id: "home", label: "Home", desc: "Hero, sections and calls to action", icon: "⌂" },
  { id: "navigation", label: "Navigation", desc: "Portal menus and links", icon: "☰" },
  { id: "pages", label: "Pages", desc: "Institutional and editorial pages", icon: "▤" },
  { id: "cards", label: "Cards", desc: "Public card content and showcases", icon: "🃏" },
  { id: "collections", label: "Collections", desc: "Set pages and collection stories", icon: "◆" },
  { id: "regions", label: "Regions", desc: "Regional identity and lore", icon: "◈" },
  { id: "keywords", label: "Keywords", desc: "Public mechanic glossary", icon: "⌘" },
  { id: "rules", label: "Rules", desc: "Rules and learning content", icon: "⚖" },
  { id: "lore", label: "Lore", desc: "Worldbuilding and narrative", icon: "✦" },
  { id: "news", label: "News", desc: "Announcements and articles", icon: "◫" },
  { id: "media", label: "Media", desc: "Media library metadata", icon: "▣" },
  { id: "seo", label: "SEO", desc: "Search and sharing metadata", icon: "◎" },
  { id: "alpha", label: "Alpha", desc: "Alpha status and onboarding", icon: "α" },
  { id: "events", label: "Events", desc: "Public event pages", icon: "🎪" },
  { id: "promotions", label: "Promotions", desc: "Public promotion pages", icon: "🎁" },
  { id: "roadmap", label: "Roadmap", desc: "Public development roadmap", icon: "↗" },
];

const ALL_RESOURCES = RESOURCE_META.map((entry) => entry.id);
const DESIGNER_RESOURCES: SiteResource[] = ["home", "navigation", "pages", "cards", "collections", "regions", "keywords", "rules", "lore", "media"];
const QA_RESOURCES: SiteResource[] = ["cards", "keywords", "rules"];
const LIVEOPS_RESOURCES: SiteResource[] = ["news", "alpha", "events", "promotions", "roadmap"];
const LIVEOPS_PUBLISH: SiteResource[] = ["news", "alpha", "events", "promotions"];

function resourcesForRole(role?: string | null): SiteResource[] {
  if (role === "admin" || role === "publisher") return ALL_RESOURCES;
  if (role === "designer") return DESIGNER_RESOURCES;
  if (role === "qa") return QA_RESOURCES;
  if (role === "liveops") return LIVEOPS_RESOURCES;
  return [];
}

function canPublish(role: string | null | undefined, resource: SiteResource) {
  return role === "admin" || role === "publisher" || (role === "liveops" && LIVEOPS_PUBLISH.includes(resource));
}

function emptyEditor(): EditorState {
  return {
    exists: false,
    slug: "",
    version: 0,
    currentStatus: "draft",
    saveStatus: "draft",
    payloadText: "{\n  \"title\": \"\"\n}",
    seoText: "{\n  \"title\": \"\",\n  \"description\": \"\"\n}",
    changeNote: "",
  };
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function parseJsonObject(value: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}

export default function SiteContentStudio({ initialUser = null }: { initialUser?: StudioUser | null }) {
  const [user, setUser] = useState<StudioUser | null>(initialUser);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const allowedResources = useMemo(() => resourcesForRole(user?.role), [user?.role]);
  const [resource, setResource] = useState<SiteResource>(resourcesForRole(initialUser?.role)[0] ?? "home");
  const [locale, setLocale] = useState("pt-BR");
  const [items, setItems] = useState<SiteItem[]>([]);
  const [versions, setVersions] = useState<SiteVersion[]>([]);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflictVersion, setConflictVersion] = useState<number | null>(null);

  useEffect(() => {
    if (user && allowedResources.length && !allowedResources.includes(resource)) {
      setResource(allowedResources[0]);
      setEditor(emptyEditor());
      setVersions([]);
    }
  }, [allowedResources, resource, user]);

  const handleApiFailure = useCallback(async (response: Response, fallback: string) => {
    const data = await response.json().catch(() => ({})) as { error?: string; currentVersion?: number };
    if (response.status === 401) setUser(null);
    if (response.status === 409) setConflictVersion(Number(data.currentVersion ?? 0));
    throw new Error(data.error || fallback);
  }, []);

  const loadList = useCallback(async () => {
    if (!user || !allowedResources.includes(resource)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/site/${resource}?locale=${encodeURIComponent(locale)}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) await handleApiFailure(response, "Could not load portal content.");
      const data = await response.json() as { items?: SiteItem[] };
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load portal content.");
    } finally {
      setBusy(false);
    }
  }, [allowedResources, handleApiFailure, locale, resource, user]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function openItem(slug: string) {
    setBusy(true);
    setError("");
    setNotice("");
    setConflictVersion(null);
    try {
      const response = await fetch(
        `/api/admin/site/${resource}/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!response.ok) await handleApiFailure(response, "Could not load content history.");
      const data = await response.json() as { item: SiteItem; versions?: SiteVersion[] };
      setEditor({
        exists: true,
        slug: data.item.slug,
        version: data.item.version,
        currentStatus: data.item.status,
        saveStatus: data.item.status === "review" ? "review" : "draft",
        payloadText: formatJson(data.item.payload),
        seoText: formatJson(data.item.seo),
        changeNote: "",
      });
      setVersions(data.versions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load content history.");
    } finally {
      setBusy(false);
    }
  }

  function startNew() {
    setEditor(emptyEditor());
    setVersions([]);
    setError("");
    setNotice("");
    setConflictVersion(null);
  }

  async function login() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password, totp: totp.trim() || undefined }),
      });
      const data = await response.json() as { ok?: boolean; error?: string; user?: StudioUser };
      if (!response.ok || !data.ok || !data.user) throw new Error(data.error || "Login failed.");
      const nextResources = resourcesForRole(data.user.role);
      if (!nextResources.length) throw new Error(`Role ${data.user.role} has no Portal CMS access.`);
      setUser(data.user);
      setResource(nextResources[0]);
      setPassword("");
      setTotp("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE", credentials: "include" });
    setUser(null);
    setItems([]);
    setVersions([]);
    setEditor(emptyEditor());
  }

  async function save() {
    const slug = editor.slug.trim();
    if (!slug) return setError("Slug is required.");

    let payload: Record<string, unknown>;
    let seo: Record<string, unknown>;
    try {
      payload = parseJsonObject(editor.payloadText, "Payload");
      seo = parseJsonObject(editor.seoText, "SEO");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    setConflictVersion(null);
    try {
      const response = await fetch(`/api/admin/site/${resource}/${encodeURIComponent(slug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          locale,
          expectedVersion: editor.version,
          status: editor.saveStatus,
          payload,
          seo,
          changeNote: editor.changeNote,
        }),
      });
      if (!response.ok) await handleApiFailure(response, "Save failed.");
      const data = await response.json() as { item: SiteItem };
      setNotice(
        editor.exists && editor.currentStatus === "published"
          ? "Draft saved. The previously published version remains live until you publish this revision."
          : "Revision saved.",
      );
      await loadList();
      await openItem(data.item.slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function lifecycle(action: "publish" | "archive") {
    if (!editor.exists || editor.version < 1) return;
    setBusy(true);
    setError("");
    setNotice("");
    setConflictVersion(null);
    try {
      const response = await fetch(
        `/api/admin/site/${resource}/${encodeURIComponent(editor.slug)}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ locale, expectedVersion: editor.version, changeNote: editor.changeNote }),
        },
      );
      if (!response.ok) await handleApiFailure(response, `${action} failed.`);
      const data = await response.json() as { item: SiteItem };
      setNotice(action === "publish" ? "Published revision is now live." : "Content archived and removed from the public API.");
      await loadList();
      await openItem(data.item.slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed.`);
    } finally {
      setBusy(false);
    }
  }

  async function rollback(targetVersion: number) {
    if (!editor.exists || editor.version < 1) return;
    setBusy(true);
    setError("");
    setNotice("");
    setConflictVersion(null);
    try {
      const response = await fetch(
        `/api/admin/site/${resource}/${encodeURIComponent(editor.slug)}/rollback/${targetVersion}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            locale,
            expectedVersion: editor.version,
            changeNote: editor.changeNote || `Rollback from version ${targetVersion}`,
          }),
        },
      );
      if (!response.ok) await handleApiFailure(response, "Rollback failed.");
      const data = await response.json() as { item: SiteItem };
      setNotice(`Version ${targetVersion} restored as a new draft. The last published revision stays live until republish.`);
      await loadList();
      await openItem(data.item.slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollback failed.");
    } finally {
      setBusy(false);
    }
  }

  const counts = useMemo(() => {
    const result: Record<SiteStatus, number> = { draft: 0, review: 0, published: 0, archived: 0 };
    for (const item of items) result[item.status] += 1;
    return result;
  }, [items]);

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05070c] px-4 text-slate-100">
        <div className="w-full max-w-md rounded-2xl border border-amber-400/20 bg-slate-900 p-8 shadow-2xl">
          <div className="text-center text-3xl">◫</div>
          <h1 className="mt-2 text-center text-2xl font-black text-amber-300">Portal CMS Access</h1>
          <p className="mt-2 text-center text-xs text-slate-400">Uses the existing RuneForge administrator session, MFA and RBAC.</p>
          <label className="mt-6 block"><span className="label">Username</span><input className="input mt-1" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
          <label className="mt-3 block"><span className="label">Password</span><input type="password" className="input mt-1" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void login()} /></label>
          <label className="mt-3 block"><span className="label">MFA code</span><input inputMode="numeric" className="input mt-1 font-mono tracking-[.2em]" value={totp} maxLength={8} onChange={(event) => setTotp(event.target.value.replace(/\D/g, "").slice(0, 8))} onKeyDown={(event) => event.key === "Enter" && void login()} /></label>
          {error && <div className="mt-3 rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-200">{error}</div>}
          <button className="btn-primary mt-4 w-full" disabled={busy} onClick={() => void login()}>{busy ? "Authenticating…" : "Enter Portal CMS"}</button>
        </div>
      </div>
    );
  }

  const selectedMeta = RESOURCE_META.find((entry) => entry.id === resource);
  const publishAllowed = canPublish(user.role, resource);

  return (
    <div className="studio-shell">
      <StudioCommandPalette role={user.role} />
      <header className="studio-topbar">
        <div className="studio-topbar-inner flex items-center justify-between gap-4">
          <div className="studio-brand">
            <div className="studio-brand-mark">◫</div>
            <div>
              <div className="studio-kicker">Runeforge // Portal CMS 2.1</div>
              <div className="studio-title">Site Content Control Plane <span className="text-xs font-bold text-slate-500">{user.username} · {user.role}</span></div>
            </div>
          </div>
          <div className="flex gap-2"><Link href="/admin/studio" className="btn-ghost text-xs">Control Room</Link><button onClick={() => void logout()} className="btn-ghost text-xs">Logout</button></div>
        </div>
      </header>

      <div className="studio-layout">
        <aside className="studio-sidebar">
          <div className="studio-nav-label">Portal resources</div>
          <div className="studio-nav-list">
            {RESOURCE_META.filter((entry) => allowedResources.includes(entry.id)).map((entry) => (
              <button key={entry.id} className={`studio-nav-item ${resource === entry.id ? "active" : ""}`} onClick={() => { setResource(entry.id); setEditor(emptyEditor()); setVersions([]); setConflictVersion(null); setNotice(""); setError(""); }}>
                <span>{entry.icon}</span>{entry.label}
              </button>
            ))}
          </div>
          <div className="mt-5 border-t border-white/5 pt-4">
            <label className="block">
              <span className="label">Locale</span>
              <input className="input mt-1 font-mono text-xs" value={locale} onChange={(event) => setLocale(event.target.value)} onBlur={() => { setEditor(emptyEditor()); setVersions([]); }} />
            </label>
          </div>
        </aside>

        <main className="studio-main">
          <StudioBreadcrumb section="Portal" current={selectedMeta?.label ?? resource} />

          <div className="mb-5 grid gap-3 sm:grid-cols-4">
            {[["Draft", counts.draft], ["Review", counts.review], ["Published", counts.published], ["Archived", counts.archived]].map(([label, value]) => (
              <div key={String(label)} className="studio-metric"><div className="text-2xl font-black">{value}</div><div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div></div>
            ))}
          </div>

          {notice && <div className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-100">{notice}</div>}
          {error && <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs text-red-100">{error}</div>}
          {conflictVersion !== null && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
              <span>Conflict detected: your editor has v{editor.version}, while the server is already at v{conflictVersion}. Your local JSON was not overwritten.</span>
              {editor.exists && <button className="btn-ghost text-xs" onClick={() => void openItem(editor.slug)}>Reload server version</button>}
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <section className="studio-section overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/5 p-4">
                <div><h2 className="font-black">{selectedMeta?.label}</h2><p className="mt-1 text-[11px] text-slate-500">{selectedMeta?.desc}</p></div>
                <button className="btn-primary text-xs" onClick={startNew}>New</button>
              </div>
              <div className="max-h-[720px] overflow-y-auto p-2">
                {items.map((item) => (
                  <button key={item.id} onClick={() => void openItem(item.slug)} className={`mb-2 w-full rounded-xl border p-3 text-left transition ${editor.exists && editor.slug === item.slug ? "border-amber-400/40 bg-amber-400/10" : "border-white/5 bg-white/[.02] hover:bg-white/[.05]"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <strong className="truncate text-sm">{item.slug}</strong>
                      <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${item.status === "published" ? "bg-emerald-400/10 text-emerald-300" : item.status === "review" ? "bg-sky-400/10 text-sky-300" : item.status === "archived" ? "bg-slate-400/10 text-slate-400" : "bg-amber-400/10 text-amber-300"}`}>{item.status}</span>
                    </div>
                    <div className="mt-2 text-[10px] text-slate-500">v{item.version} · {formatDate(item.updatedAt)}</div>
                  </button>
                ))}
                {!items.length && <div className="p-5 text-center text-xs text-slate-500">{busy ? "Loading…" : "No content for this resource and locale."}</div>}
              </div>
            </section>

            <div className="space-y-5">
              <section className="studio-section p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="studio-kicker">{editor.exists ? `Version ${editor.version}` : "New content"}</div>
                    <h2 className="mt-1 text-xl font-black">{editor.exists ? editor.slug : `Create ${selectedMeta?.label ?? resource} content`}</h2>
                    {editor.exists && <p className="mt-1 text-[11px] text-slate-500">Current state: {editor.currentStatus}. Published continuity remains live during draft/review edits.</p>}
                  </div>
                  {editor.exists && publishAllowed && <div className="flex gap-2"><button className="btn-primary text-xs" disabled={busy} onClick={() => void lifecycle("publish")}>Publish</button><button className="btn-ghost text-xs" disabled={busy} onClick={() => void lifecycle("archive")}>Archive</button></div>}
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px]">
                  <label><span className="label">Slug</span><input className="input mt-1 font-mono text-xs" value={editor.slug} disabled={editor.exists} onChange={(event) => setEditor((current) => ({ ...current, slug: event.target.value }))} placeholder="home-hero" />{editor.exists && <span className="mt-1 block text-[10px] text-slate-600">Identity is immutable after creation.</span>}</label>
                  <label><span className="label">Save as</span><select className="input mt-1" value={editor.saveStatus} onChange={(event) => setEditor((current) => ({ ...current, saveStatus: event.target.value === "review" ? "review" : "draft" }))}><option value="draft">Draft</option><option value="review">Review</option></select></label>
                </div>

                <div className="mt-4 grid gap-4 2xl:grid-cols-2">
                  <label><span className="label">Payload JSON</span><textarea className="input mt-1 min-h-[360px] font-mono text-[11px] leading-5" spellCheck={false} value={editor.payloadText} onChange={(event) => setEditor((current) => ({ ...current, payloadText: event.target.value }))} /></label>
                  <label><span className="label">SEO JSON</span><textarea className="input mt-1 min-h-[360px] font-mono text-[11px] leading-5" spellCheck={false} value={editor.seoText} onChange={(event) => setEditor((current) => ({ ...current, seoText: event.target.value }))} /></label>
                </div>

                <label className="mt-4 block"><span className="label">Change note</span><input className="input mt-1" value={editor.changeNote} maxLength={500} onChange={(event) => setEditor((current) => ({ ...current, changeNote: event.target.value }))} placeholder="What changed and why?" /></label>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button className="btn-primary" disabled={busy || conflictVersion !== null} onClick={() => void save()}>{busy ? "Working…" : editor.exists ? "Save revision" : "Create draft"}</button>
                  {editor.exists && <button className="btn-ghost" disabled={busy} onClick={() => void openItem(editor.slug)}>Refresh</button>}
                  <span className="text-[10px] text-slate-500">Writes use expectedVersion={editor.version}. Stale writes fail closed with HTTP 409.</span>
                </div>
              </section>

              {editor.exists && (
                <section className="studio-section p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div><h2 className="font-black">Immutable version history</h2><p className="mt-1 text-[11px] text-slate-500">Rollback creates a new draft; it never rewrites an older snapshot.</p></div>
                    <span className="text-xs text-slate-500">{versions.length} snapshots</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {versions.map((version) => (
                      <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[.02] p-3">
                        <div><div className="flex items-center gap-2"><strong>v{version.version}</strong><span className="rounded-full bg-white/5 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-400">{version.status}</span></div><div className="mt-1 text-[10px] text-slate-500">{version.actor} · {formatDate(version.createdAt)}</div>{version.changeNote && <div className="mt-1 text-xs text-slate-300">{version.changeNote}</div>}</div>
                        {publishAllowed && version.version !== editor.version && <button className="btn-ghost text-xs" disabled={busy} onClick={() => void rollback(version.version)}>Restore as draft</button>}
                      </div>
                    ))}
                    {!versions.length && <div className="text-xs text-slate-500">No version history loaded.</div>}
                  </div>
                </section>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
