import Link from "next/link";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/play", label: "Play" },
  { href: "/forge", label: "Forge" },
  { href: "/codex", label: "Codex" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/admin", label: "Admin" },
];

export default function SiteNav() {
  return (
    <header className="rf-chrome">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="rf-brand text-sm font-black tracking-[0.22em]">
          RUNEFORGE
        </Link>
        <nav className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rf-nav-link">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
