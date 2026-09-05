"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasStudioUiCapability, type StudioUiCapability } from "@/lib/admin-studio-access";

type StudioCommand = {
  href: string;
  label: string;
  desc: string;
  capability: StudioUiCapability;
};

const routes: StudioCommand[] = [
  { href: "/admin/studio", label: "Control Room", desc: "Overview", capability: "authoring" },
  { href: "/admin/studio/cards", label: "Card Studio", desc: "Create and edit cards", capability: "authoring" },
  { href: "/admin/studio/mechanics", label: "Mechanics Studio", desc: "Compose keywords, effects and card archetypes", capability: "authoring" },
  { href: "/admin/studio/dependencies", label: "Dependency Graph", desc: "Inspect content references and cycles", capability: "authoring" },
  { href: "/admin/studio/production", label: "Production", desc: "Validate, QA and publish", capability: "production" },
  { href: "/admin/studio/site", label: "Portal CMS", desc: "Versioned public site content", capability: "site" },
  { href: "/admin/studio/ops", label: "Live Ops", desc: "Events and promotions", capability: "liveops" },
  { href: "/admin/studio/4", label: "Operations", desc: "Content pipeline and approvals", capability: "operations" },
  { href: "/admin/studio/operators", label: "Admin Operators", desc: "Manage individual RBAC and MFA", capability: "operators" },
  { href: "/admin/studio/control", label: "Total Game Control", desc: "Engine, AI, modes, economy and presentation", capability: "control" },
  { href: "/admin/studio/brawl-contract", label: "Brawl Contract Inspector", desc: "Preflight Brawl definitions against the canonical runtime validator", capability: "brawl" },
  { href: "/admin/studio/payments", label: "Payments", desc: "Mercado Pago credentials, webhooks and commerce", capability: "payments" },
  { href: "/admin/studio/runtime", label: "Runtime Operations", desc: "Matches, replays, decks, chat and sessions", capability: "runtime" },
  { href: "/admin/studio/5", label: "Balance Lab", desc: "Matchups and outliers", capability: "balance" },
  { href: "/admin/studio/lab", label: "Card Laboratory", desc: "Run deterministic QA scenarios", capability: "qa-tools" },
  { href: "/admin/studio/lab/history", label: "Lab History", desc: "Compare persisted card QA regressions", capability: "qa-tools" },
  { href: "/admin/studio?tab=interactions", label: "Rule Graph", desc: "Build triggers, targets and effects", capability: "authoring" },
  { href: "/admin/studio/production?tab=simulator", label: "Simulator", desc: "Run content against the production engine", capability: "production" },
  { href: "/admin/studio/4?tab=approvals", label: "Approval Queue", desc: "Review QA and publish gates", capability: "production" },
];

const quickActions: StudioCommand[] = [
  { href: "/admin/studio/cards?new=1", label: "Create card", desc: "Start a new card draft", capability: "authoring" },
  { href: "/admin/studio/mechanics", label: "Create mechanic", desc: "Compose a safe keyword, effect or card type", capability: "authoring" },
  { href: "/admin/studio/site", label: "Create portal content", desc: "Start a versioned site content draft", capability: "site" },
  { href: "/admin/studio/ops?new=event", label: "Create event", desc: "Start a Live Ops event", capability: "liveops" },
  { href: "/admin/studio/ops?new=promotion", label: "Create promotion", desc: "Start a promotion draft", capability: "liveops" },
  { href: "/admin/studio/5?tab=matrix", label: "Run matchup matrix", desc: "Open Balance matrix controls", capability: "balance" },
  { href: "/admin/studio/control", label: "Open total control", desc: "Manage every runtime content domain", capability: "control" },
  { href: "/admin/studio/brawl-contract", label: "Validate Brawl contract", desc: "Check a Brawl payload before publication", capability: "brawl" },
];

export function StudioCommandPalette({ role }: { role?: string | null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sessionRole, setSessionRole] = useState<string | null>(role ?? null);
  const effectiveRole = role ?? sessionRole;
  const pathname = usePathname();
  useEffect(() => {
    if (role) return;
    let active = true;
    fetch("/api/admin/session", { credentials: "include" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (active) setSessionRole(data?.user?.role ? String(data.user.role) : null);
      })
      .catch(() => {
        if (active) setSessionRole(null);
      });
    return () => { active = false; };
  }, [role]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const allowedRoutes = useMemo(
    () => routes.filter((command) => hasStudioUiCapability(effectiveRole, command.capability)),
    [effectiveRole],
  );
  const allowedActions = useMemo(
    () => quickActions.filter((command) => hasStudioUiCapability(effectiveRole, command.capability)),
    [effectiveRole],
  );
  const filtered = useMemo(
    () => allowedRoutes.filter(({ label, desc }) => `${label} ${desc}`.toLowerCase().includes(query.toLowerCase())),
    [allowedRoutes, query],
  );
  const filteredActions = useMemo(
    () => allowedActions.filter(({ label, desc }) => `${label} ${desc}`.toLowerCase().includes(query.toLowerCase())),
    [allowedActions, query],
  );
  return (
    <>
      <button aria-label="Open command palette" className="studio-command-button" onClick={() => setOpen(true)}>
        <span>⌘</span>
        <span>Command</span>
        <kbd>{typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"}</kbd>
      </button>
      {open && (
        <div className="studio-command-overlay" role="dialog" aria-modal="true" onMouseDown={() => setOpen(false)}>
          <div className="studio-command-panel" onMouseDown={(e) => e.stopPropagation()}>
            <div className="studio-command-search">
              <span>⌘</span>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to a workspace…"
              />
              <kbd>ESC</kbd>
            </div>
            <div className="studio-command-label">WORKSPACES</div>
            <div className="studio-command-list">
              {filtered.map(({ href, label, desc }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`studio-command-item ${pathname === href ? "active" : ""}`}
                >
                  <span className="studio-command-dot">◆</span>
                  <span>
                    <b>{label}</b>
                    <small>{desc}</small>
                  </span>
                  <span className="studio-command-arrow">↵</span>
                </Link>
              ))}
              {!filtered.length && !filteredActions.length && <div className="studio-empty">No command matches “{query}”.</div>}
            </div>
            {!!filteredActions.length && <>
              <div className="studio-command-label">ACTIONS</div>
              <div className="studio-command-list">
                {filteredActions.map(({ href, label, desc }) => (
                  <Link key={href} href={href} onClick={() => setOpen(false)} className="studio-command-item">
                    <span className="studio-command-dot">＋</span>
                    <span><b>{label}</b><small>{desc}</small></span>
                    <span className="studio-command-arrow">↵</span>
                  </Link>
                ))}
              </div>
            </>}
          </div>
        </div>
      )}
    </>
  );
}

export function StudioBreadcrumb({ section, current }: { section?: string; current: string }) {
  return (
    <div className="studio-breadcrumb">
      <Link href="/admin/studio">Studio</Link>
      <span>/</span>
      {section && (
        <>
          <span>{section}</span>
          <span>/</span>
        </>
      )}
      <strong>{current}</strong>
    </div>
  );
}
