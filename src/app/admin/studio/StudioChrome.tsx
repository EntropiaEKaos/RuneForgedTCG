"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const routes = [
  ["/admin/studio", "Control Room", "Overview"],
  ["/admin/studio/cards", "Card Studio", "Create and edit cards"],
  ["/admin/studio/mechanics", "Mechanics Studio", "Compose keywords, effects and card archetypes"],
  ["/admin/studio/dependencies", "Dependency Graph", "Inspect content references and cycles"],
  ["/admin/studio/production", "Production", "Validate, QA and publish"],
  ["/admin/studio/ops", "Live Ops", "Events and promotions"],
  ["/admin/studio/4", "Operations", "Content pipeline and approvals"],
  ["/admin/studio/operators", "Admin Operators", "Manage individual RBAC and MFA"],
  ["/admin/studio/control", "Total Game Control", "Engine, AI, modes, economy and presentation"],
  ["/admin/studio/payments", "Payments", "Mercado Pago credentials, webhooks and commerce"],
  ["/admin/studio/runtime", "Runtime Operations", "Matches, replays, decks, chat and sessions"],
  ["/admin/studio/5", "Balance Lab", "Matchups and outliers"],
  ["/admin/studio/lab", "Card Laboratory", "Run deterministic QA scenarios"],
  ["/admin/studio?tab=interactions", "Rule Graph", "Build triggers, targets and effects"],
  ["/admin/studio/production?tab=simulator", "Simulator", "Run content against the production engine"],
  ["/admin/studio/4?tab=approvals", "Approval Queue", "Review QA and publish gates"],
];

const quickActions = [
  ["/admin/studio/cards?new=1", "Create card", "Start a new card draft"],
  ["/admin/studio/mechanics", "Create mechanic", "Compose a safe keyword, effect or card type"],
  ["/admin/studio/ops?new=event", "Create event", "Start a Live Ops event"],
  ["/admin/studio/ops?new=promotion", "Create promotion", "Start a promotion draft"],
  ["/admin/studio/5?tab=matrix", "Run matchup matrix", "Open Balance matrix controls"],
  ["/admin/studio/control", "Open total control", "Manage every runtime content domain"],
];

export function StudioCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pathname = usePathname();
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
  const filtered = useMemo(
    () => routes.filter(([href, label, desc]) => `${label} ${desc}`.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const filteredActions = useMemo(() => quickActions.filter(([, label, desc]) => `${label} ${desc}`.toLowerCase().includes(query.toLowerCase())), [query]);
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
              {filtered.map(([href, label, desc]) => (
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
            {!!filteredActions.length && <><div className="studio-command-label">ACTIONS</div><div className="studio-command-list">{filteredActions.map(([href,label,desc]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="studio-command-item"><span className="studio-command-dot">＋</span><span><b>{label}</b><small>{desc}</small></span><span className="studio-command-arrow">↵</span></Link>)}</div></>}
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
