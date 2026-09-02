"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MetaLink = { href: string; label: string; icon?: string };
type MetaSection = {
  id: string;
  href: string;
  label: string;
  icon: string;
  routes: string[];
  contextLabel: string;
  links: MetaLink[];
};

const SECTIONS: MetaSection[] = [
  {
    id: "play",
    href: "/play",
    label: "Jogar",
    icon: "⚔",
    routes: ["/play", "/pvp", "/ranked", "/draft", "/simulate"],
    contextLabel: "PREPARAÇÃO & DUELO",
    links: [
      { href: "/play", label: "Decks" },
      { href: "/pvp", label: "PvP casual" },
      { href: "/ranked", label: "Ranked" },
      { href: "/draft", label: "Draft" },
      { href: "/simulate", label: "Simulador" },
    ],
  },
  {
    id: "modes",
    href: "/modes",
    label: "Modos",
    icon: "◇",
    routes: ["/modes"],
    contextLabel: "ARQUIVOS DO NEXUS",
    links: [
      { href: "/modes", label: "Expedições" },
      { href: "/draft", label: "Draft" },
      { href: "/ranked", label: "Competitivo" },
      { href: "/pvp", label: "Duelo casual" },
    ],
  },
  {
    id: "collection",
    href: "/collection",
    label: "Coleção",
    icon: "◈",
    routes: ["/collection", "/collections", "/album"],
    contextLabel: "ACERVO DO FORJADOR",
    links: [
      { href: "/collection", label: "Cartas" },
      { href: "/collections", label: "Coleções" },
      { href: "/album", label: "Álbum" },
      { href: "/codex", label: "Codex" },
    ],
  },
  {
    id: "forge",
    href: "/forge",
    label: "Forja",
    icon: "◆",
    routes: ["/forge", "/store"],
    contextLabel: "ARSENAL & SUPRIMENTOS",
    links: [
      { href: "/forge", label: "Decks" },
      { href: "/store", label: "Loja" },
      { href: "/collection", label: "Acervo" },
    ],
  },
  {
    id: "community",
    href: "/community",
    label: "Comunidade",
    icon: "◎",
    routes: ["/community", "/friends", "/leaderboard"],
    contextLabel: "REDE DO NEXUS",
    links: [
      { href: "/community", label: "Hub" },
      { href: "/friends", label: "Amigos" },
      { href: "/leaderboard", label: "Ranking" },
      { href: "/pvp", label: "Salas PvP" },
    ],
  },
];

const UTILITIES: MetaLink[] = [
  { href: "/profile", label: "Perfil", icon: "◉" },
  { href: "/codex", label: "Codex", icon: "⌘" },
  { href: "/admin", label: "Studio", icon: "✦" },
];

const SYSTEM_SECTION: MetaSection = {
  id: "system",
  href: "/profile",
  label: "Forjador",
  icon: "◉",
  routes: ["/profile", "/codex", "/admin"],
  contextLabel: "IDENTIDADE & SISTEMA",
  links: UTILITIES,
};

function routeMatches(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function currentSection(pathname: string) {
  return SECTIONS.find((section) => section.routes.some((route) => routeMatches(pathname, route)))
    ?? (SYSTEM_SECTION.routes.some((route) => routeMatches(pathname, route)) ? SYSTEM_SECTION : null);
}

export default function SiteNav() {
  const pathname = usePathname() || "/";
  const activeSection = currentSection(pathname);
  const context = activeSection ?? {
    ...SYSTEM_SECTION,
    id: "home",
    contextLabel: "LEGENDS OF THE NEXUS",
    links: [
      { href: "/play", label: "Jogar" },
      { href: "/profile", label: "Perfil" },
      { href: "/codex", label: "Codex" },
    ],
  };

  return (
    <header className="rf-chrome" data-meta-section={activeSection?.id ?? "home"}>
      <div className="rf-chrome-primary mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6">
        <Link href="/" className="rf-brand" aria-label="RuneForge — início">
          <span className="rf-brand-mark" aria-hidden="true"><i /></span>
          <span><b>RUNE</b>FORGE<small>LEGENDS OF THE NEXUS</small></span>
        </Link>

        <nav className="rf-nav" aria-label="Navegação principal">
          {SECTIONS.map((section) => {
            const active = activeSection?.id === section.id;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="rf-nav-link"
                data-active={active ? "true" : "false"}
                aria-current={pathname === section.href ? "page" : undefined}
              >
                <i aria-hidden="true">{section.icon}</i>{section.label}
              </Link>
            );
          })}
        </nav>

        <div className="rf-meta-actions" aria-label="Acesso rápido">
          {UTILITIES.map((utility) => {
            const active = routeMatches(pathname, utility.href);
            return (
              <Link
                key={utility.href}
                href={utility.href}
                className="rf-meta-action"
                data-active={active ? "true" : "false"}
                aria-current={pathname === utility.href ? "page" : undefined}
              >
                <i aria-hidden="true">{utility.icon}</i><span>{utility.label}</span>
              </Link>
            );
          })}
          <Link href="/play" className="rf-nav-cta" aria-current={pathname === "/play" ? "page" : undefined}>
            <span>JOGAR ALPHA</span><b>→</b>
          </Link>
        </div>
      </div>

      <div className="rf-context-rail">
        <div className="rf-context-inner mx-auto max-w-7xl px-4 sm:px-6">
          <span className="rf-context-label"><i aria-hidden="true" />{context.contextLabel}</span>
          <nav className="rf-context-links" aria-label={`Atalhos — ${context.contextLabel}`}>
            {context.links.map((link) => {
              const active = routeMatches(pathname, link.href);
              return (
                <Link
                  key={`${context.id}:${link.href}`}
                  href={link.href}
                  className="rf-context-link"
                  data-active={active ? "true" : "false"}
                  aria-current={pathname === link.href ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <span className="rf-context-sigil" aria-hidden="true">◇</span>
        </div>
      </div>
    </header>
  );
}
