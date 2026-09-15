import Image from "next/image";
import Link from "next/link";
import DailyLogin from "@/components/DailyLogin";
import SiteNav from "@/components/SiteNav";
import { PRODUCT_BRAND } from "@/lib/product-brand";
import { listPublishedSiteContent } from "@/lib/site-content-public";

export const dynamic = "force-dynamic";

type PublishedCard = {
  slug: string;
  title: string;
  summary: string;
  eyebrow: string;
  category: string;
};

function text(value: unknown) { return typeof value === "string" ? value : ""; }

function compact(item: Awaited<ReturnType<typeof listPublishedSiteContent>>[number]): PublishedCard {
  return {
    slug: item.slug,
    title: text(item.payload.title) || item.slug,
    summary: text(item.payload.summary) || text(item.payload.body),
    eyebrow: text(item.payload.eyebrow),
    category: text(item.payload.category),
  };
}

const QUICK = [
  { href: "/ranked", icon: "♜", label: "RANKED", sub: "Suba na classificação" },
  { href: "/collection", icon: "◈", label: "COLEÇÃO", sub: "Seu acervo" },
  { href: "/forge", icon: "◆", label: "DECKS", sub: "Monte sua estratégia" },
  { href: "/lore", icon: "⌘", label: "CRÔNICAS", sub: "Explore o universo" },
  { href: "/store", icon: "✦", label: "LOJA", sub: "Packs e cosméticos" },
  { href: "/friends", icon: "◎", label: "SOCIAL", sub: "Amigos e comunidade" },
];

export default async function HomePage() {
  const [lore, events] = await Promise.all([
    listPublishedSiteContent("lore", "pt-BR"),
    listPublishedSiteContent("events", "pt-BR"),
  ]);
  const latestLore = lore[0] ? compact(lore[0]) : null;
  const latestEvent = events[0] ? compact(events[0]) : null;

  return (
    <main className="relative min-h-[calc(100vh-var(--forged-client-topbar))] overflow-hidden bg-[#05080d] text-slate-100">
      <SiteNav />

      <Image
        src="/art/brand/runeforge-nexus-hero.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="pointer-events-none object-cover opacity-35"
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(4,7,11,.96)_0%,rgba(4,7,11,.76)_43%,rgba(4,7,11,.90)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_45%_18%,rgba(182,145,72,.15),transparent_28rem),linear-gradient(180deg,transparent_60%,#05080d_100%)]" />

      <div className="relative mx-auto grid min-h-[calc(100vh-var(--forged-client-topbar))] max-w-[1600px] grid-rows-[1fr_auto] gap-5 px-5 py-5 sm:px-7 lg:px-9">
        <div className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="relative flex min-h-[520px] flex-col justify-end overflow-hidden border border-amber-200/10 bg-black/15 p-6 sm:p-8 lg:p-10">
            <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-white/6 bg-black/20 px-5 py-3 text-[8px] font-bold uppercase tracking-[.22em] text-slate-500">
              <span>HOME · CLIENT ALPHA</span>
              <span className="flex items-center gap-2 text-emerald-300/70"><i className="h-1.5 w-1.5 rounded-full bg-emerald-300/80 shadow-[0_0_8px_rgba(110,231,183,.6)]" /> NEXUS ONLINE</span>
            </div>

            <div className="max-w-4xl pb-3">
              <p className="text-[9px] font-bold uppercase tracking-[.34em] text-amber-200/55">{PRODUCT_BRAND.fullName}</p>
              <h1 className="mt-4 max-w-3xl font-[var(--font-display)] text-4xl font-black leading-[1.05] tracking-[.035em] text-[#f4e7c7] sm:text-5xl lg:text-6xl">FORJE O DECK.<br /><span className="text-amber-200/80">DOMINE O NEXUS.</span></h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300/72">Entre direto na partida, continue sua progressão e acompanhe o mundo de FORGED sem sair do client.</p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/play" className="group inline-flex min-w-[220px] items-center justify-between border border-amber-100/35 bg-[linear-gradient(180deg,rgba(198,157,77,.22),rgba(118,86,31,.18))] px-6 py-4 font-[var(--font-display)] text-sm font-black tracking-[.16em] text-[#fff0c5] shadow-[0_15px_36px_rgba(0,0,0,.25)] transition hover:border-amber-100/55 hover:bg-amber-100/15"><span className="flex items-center gap-3"><i className="not-italic">⚔</i> JOGAR</span><b className="transition group-hover:translate-x-1">→</b></Link>
                <Link href="/ranked" className="border border-white/12 bg-black/25 px-5 py-4 text-[10px] font-bold uppercase tracking-[.18em] text-slate-300 hover:border-white/20 hover:text-white">FILA RANKED</Link>
              </div>
            </div>
          </section>

          <aside className="grid min-h-0 content-start gap-4 overflow-y-auto pr-1">
            <section className="border border-white/8 bg-[#080d14]/90 p-4">
              <div className="mb-3 flex items-center justify-between"><span className="text-[8px] font-bold uppercase tracking-[.2em] text-slate-600">RECOMPENSA DIÁRIA</span><span className="text-[8px] uppercase tracking-[.14em] text-amber-200/45">PROGRESSÃO</span></div>
              <DailyLogin />
            </section>

            <section className="border border-white/8 bg-[#080d14]/90 p-4">
              <div className="flex items-center justify-between"><span className="text-[8px] font-bold uppercase tracking-[.2em] text-slate-600">CRÔNICAS</span><Link href="/lore" className="text-[8px] font-bold uppercase tracking-[.16em] text-amber-200/55">VER TODAS →</Link></div>
              {latestLore ? <Link href={`/lore/${encodeURIComponent(latestLore.slug)}`} className="mt-4 block border-l border-amber-200/22 pl-4">
                <span className="text-[8px] uppercase tracking-[.18em] text-amber-200/45">{latestLore.eyebrow || latestLore.category || "NOVO ARQUIVO"}</span>
                <h2 className="mt-2 font-[var(--font-display)] text-lg font-bold text-[#eadfc6]">{latestLore.title}</h2>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{latestLore.summary || "Nova entrada publicada no arquivo narrativo."}</p>
              </Link> : <p className="mt-4 text-xs leading-5 text-slate-600">Nenhuma crônica publicada pelo Admin ainda.</p>}
            </section>

            <section className="border border-white/8 bg-[#080d14]/90 p-4">
              <div className="flex items-center justify-between"><span className="text-[8px] font-bold uppercase tracking-[.2em] text-slate-600">EVENTO EM DESTAQUE</span><Link href="/modes" className="text-[8px] font-bold uppercase tracking-[.16em] text-sky-200/50">EVENTOS →</Link></div>
              {latestEvent ? <div className="mt-4"><span className="text-[8px] uppercase tracking-[.18em] text-sky-200/45">LIVE OPS</span><h2 className="mt-2 font-[var(--font-display)] text-base font-bold text-slate-200">{latestEvent.title}</h2><p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{latestEvent.summary}</p></div> : <p className="mt-4 text-xs leading-5 text-slate-600">Sem evento público publicado no momento.</p>}
            </section>
          </aside>
        </div>

        <section className="grid gap-2 border-t border-white/8 pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {QUICK.map((item) => <Link key={item.href} href={item.href} className="group flex min-h-[78px] items-center gap-3 border border-white/8 bg-black/25 px-4 py-3 transition hover:border-amber-200/18 hover:bg-white/[.035]"><i className="w-7 text-center text-lg not-italic text-amber-200/55 transition group-hover:text-amber-100">{item.icon}</i><span className="min-w-0"><b className="block text-[10px] font-bold tracking-[.14em] text-slate-200">{item.label}</b><small className="mt-1 block truncate text-[9px] text-slate-600">{item.sub}</small></span></Link>)}
        </section>
      </div>
    </main>
  );
}
