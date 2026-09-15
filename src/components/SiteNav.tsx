"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PRODUCT_BRAND } from "@/lib/product-brand";
import { trackClientEvent } from "@/lib/client-telemetry";

type ClientLink = {
  href: string;
  label: string;
  icon: string;
  routes: string[];
  accent?: boolean;
};

type ClientContext = {
  ok?: boolean;
  player?: { authenticated: boolean; name?: string | null; avatar?: string | null };
  admin?: { authenticated: boolean; role?: string | null; canStudio?: boolean };
};

const PRIMARY_LINKS: ClientLink[] = [
  { href: "/", label: "Início", icon: "◇", routes: ["/"] },
  { href: "/play", label: "Jogar", icon: "⚔", routes: ["/play", "/pvp", "/draft", "/simulate"], accent: true },
  { href: "/collection", label: "Coleção", icon: "◈", routes: ["/collection", "/collections", "/album", "/codex"] },
  { href: "/forge", label: "Decks", icon: "◆", routes: ["/forge"] },
  { href: "/ranked", label: "Ranked", icon: "♜", routes: ["/ranked", "/leaderboard"] },
  { href: "/lore", label: "Crônicas", icon: "⌘", routes: ["/lore"] },
  { href: "/modes", label: "Eventos", icon: "✦", routes: ["/modes", "/store", "/market"] },
  { href: "/community", label: "Social", icon: "◎", routes: ["/community", "/friends"] },
];

const PROFILE_LINKS: ClientLink[] = [
  { href: "/profile", label: "Perfil", icon: "◉", routes: ["/profile"] },
  { href: "/profile/security", label: "Acesso & Segurança", icon: "◇", routes: ["/profile/security"] },
];

function routeMatches(pathname: string, route: string) {
  if (route === "/") return pathname === "/";
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isActive(pathname: string, link: ClientLink) {
  return link.routes.some((route) => routeMatches(pathname, route));
}

export default function SiteNav() {
  const pathname = usePathname() || "/";
  const [context, setContext] = useState<ClientContext | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/client/context", { credentials: "include", cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (alive) setContext(data);
      })
      .catch(() => {
        if (alive) setContext(null);
      });
    return () => { alive = false; };
  }, [pathname]);

  useEffect(() => {
    trackClientEvent("client.route_viewed", { pathname });
  }, [pathname]);

  const activeLabel = useMemo(() => {
    return PRIMARY_LINKS.find((link) => isActive(pathname, link))?.label
      ?? PROFILE_LINKS.find((link) => isActive(pathname, link))?.label
      ?? "FORGED";
  }, [pathname]);

  const canStudio = Boolean(context?.admin?.authenticated && context.admin.canStudio);
  const playerName = context?.player?.name?.trim() || "FORJADOR";
  const playerAvatar = context?.player?.avatar?.trim() || "◉";

  return (
    <header className="rf-client-shell" data-client-shell="true" data-active-surface={activeLabel.toLowerCase()}>
      <div className="rf-client-topbar">
        <Link href="/" className="rf-client-brand" aria-label={`${PRODUCT_BRAND.fullName} — início`}>
          <span className="rf-client-brand-sigil" aria-hidden="true"><i /></span>
          <span className="rf-client-brand-copy">
            <strong>{PRODUCT_BRAND.displayName}</strong>
            <small>{PRODUCT_BRAND.subtitle}</small>
          </span>
        </Link>

        <div className="rf-client-surface-title">
          <small>CLIENT</small>
          <strong>{activeLabel}</strong>
        </div>

        <div className="rf-client-top-actions">
          <Link href="/store" className="rf-client-resource" aria-label="Loja e recursos"><span>◆</span><b>LOJA</b></Link>
          <Link href="/profile" className="rf-client-profile-chip">
            <span className="rf-client-avatar" aria-hidden="true">{playerAvatar}</span>
            <span><small>{context?.player?.authenticated ? "ONLINE" : "CONVIDADO"}</small><b>{playerName}</b></span>
          </Link>
        </div>
      </div>

      <aside className="rf-client-rail" aria-label="Navegação do client">
        <div className="rf-client-rail-primary">
          {PRIMARY_LINKS.map((link) => {
            const active = isActive(pathname, link);
            return (
              <Link
                key={link.href}
                href={link.href}
                className="rf-client-rail-link"
                data-active={active ? "true" : "false"}
                data-accent={link.accent ? "true" : "false"}
                aria-current={active ? "page" : undefined}
                title={link.label}
              >
                <i aria-hidden="true">{link.icon}</i>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="rf-client-rail-utility">
          {canStudio && (
            <Link
              href="/admin/studio"
              className="rf-client-rail-link rf-client-admin-link"
              data-active={pathname.startsWith("/admin") ? "true" : "false"}
              title="Studio Admin"
            >
              <i aria-hidden="true">⚙</i>
              <span>Studio</span>
            </Link>
          )}
          {PROFILE_LINKS.map((link) => {
            const active = isActive(pathname, link);
            return (
              <Link key={link.href} href={link.href} className="rf-client-rail-link" data-active={active ? "true" : "false"} title={link.label}>
                <i aria-hidden="true">{link.icon}</i>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </aside>
    </header>
  );
}
