import Link from "next/link";

const LINKS = [
  { href: "/play", label: "Jogar", icon: "⚔" },
  { href: "/modes", label: "Modos", icon: "◇" },
  { href: "/collection", label: "Coleção", icon: "◈" },
  { href: "/forge", label: "Forja", icon: "◆" },
  { href: "/community", label: "Comunidade", icon: "◎" },
  { href: "/admin", label: "Studio", icon: "⌘" },
];

export default function SiteNav() {
  return (
    <header className="rf-chrome">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6">
        <Link href="/" className="rf-brand" aria-label="RuneForge — início">
          <span className="rf-brand-mark" aria-hidden="true"><i /></span>
          <span><b>RUNE</b>FORGE<small>LEGENDS OF THE NEXUS</small></span>
        </Link>
        <nav className="rf-nav" aria-label="Navegação principal">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rf-nav-link">
              <i aria-hidden="true">{l.icon}</i>{l.label}
            </Link>
          ))}
        </nav>
        <Link href="/play" className="rf-nav-cta"><span>JOGAR ALPHA</span><b>→</b></Link>
      </div>
    </header>
  );
}
