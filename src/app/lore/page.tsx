import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import { PRODUCT_BRAND } from "@/lib/product-brand";
import { listPublishedSiteContent } from "@/lib/site-content-public";
import LoreTelemetry from "./LoreTelemetry";

export const dynamic = "force-dynamic";
export const metadata = { title: `Crônicas · ${PRODUCT_BRAND.displayName}` };

type LorePayload = {
  title?: string;
  summary?: string;
  body?: string;
  category?: string;
  eyebrow?: string;
  imageUrl?: string;
  chronology?: string | number;
  featured?: boolean;
  tags?: string[];
};

function lorePayload(value: Record<string, unknown>): LorePayload {
  return {
    title: typeof value.title === "string" ? value.title : undefined,
    summary: typeof value.summary === "string" ? value.summary : undefined,
    body: typeof value.body === "string" ? value.body : undefined,
    category: typeof value.category === "string" ? value.category : undefined,
    eyebrow: typeof value.eyebrow === "string" ? value.eyebrow : undefined,
    imageUrl: typeof value.imageUrl === "string" ? value.imageUrl : undefined,
    chronology: typeof value.chronology === "string" || typeof value.chronology === "number" ? value.chronology : undefined,
    featured: value.featured === true,
    tags: Array.isArray(value.tags) ? value.tags.filter((item): item is string => typeof item === "string").slice(0, 8) : undefined,
  };
}

export default async function LoreHubPage() {
  const published = await listPublishedSiteContent("lore", "pt-BR");
  const entries = published.map((item) => ({ ...item, lore: lorePayload(item.payload) }));
  const featured = entries.find((entry) => entry.lore.featured) ?? entries[0] ?? null;
  const rest = featured ? entries.filter((entry) => entry.slug !== featured.slug) : entries;

  return (
    <main className="min-h-screen bg-[#06090e] text-slate-100">
      <SiteNav />
      <LoreTelemetry />

      <section className="relative overflow-hidden border-b border-amber-200/10 px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_10%,rgba(174,138,70,.13),transparent_30rem),radial-gradient(circle_at_10%_70%,rgba(60,92,121,.14),transparent_26rem)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[.34em] text-amber-200/55">ARQUIVO NARRATIVO DO CLIENT</p>
            <h1 className="mt-4 font-[var(--font-display)] text-3xl font-black tracking-[.08em] text-[#f2e5c5] sm:text-5xl">CRÔNICAS DA FORJA</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300/72">
              Mundos, personagens, facções e acontecimentos publicados pelo Studio de {PRODUCT_BRAND.displayName}. O conteúdo desta área é totalmente controlado pelo Admin.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
        {!featured ? (
          <div className="rounded-sm border border-amber-200/12 bg-white/[.025] p-8 sm:p-12">
            <p className="text-[10px] uppercase tracking-[.28em] text-amber-200/50">CRÔNICAS SELADAS</p>
            <h2 className="mt-3 font-[var(--font-display)] text-2xl text-[#efe3c8]">Nenhum capítulo publicado ainda.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Quando um administrador publicar conteúdo em Studio → Portal CMS → Lore, ele aparecerá aqui automaticamente.</p>
          </div>
        ) : (
          <>
            <Link href={`/lore/${encodeURIComponent(featured.slug)}`} className="group relative grid min-h-[340px] overflow-hidden border border-amber-200/14 bg-[#0a1018] lg:grid-cols-[1.35fr_.65fr]">
              {featured.lore.imageUrl && (
                <div className="absolute inset-0 opacity-25 transition duration-500 group-hover:scale-[1.02] group-hover:opacity-35" style={{ backgroundImage: `linear-gradient(90deg,rgba(4,7,11,.4),rgba(4,7,11,.95)),url(${featured.lore.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
              )}
              <div className="relative z-10 flex flex-col justify-end p-7 sm:p-10 lg:p-12">
                <div className="text-[9px] font-bold uppercase tracking-[.3em] text-amber-200/55">{featured.lore.eyebrow || featured.lore.category || "DESTAQUE"}</div>
                <h2 className="mt-3 max-w-3xl font-[var(--font-display)] text-3xl font-black tracking-[.04em] text-[#f2e5c5] sm:text-4xl">{featured.lore.title || featured.slug}</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300/75">{featured.lore.summary || "Abra esta crônica para explorar o arquivo completo."}</p>
                <div className="mt-7 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[.22em] text-amber-100/80"><span>ABRIR CRÔNICA</span><span aria-hidden="true">→</span></div>
              </div>
              <div className="relative z-10 hidden border-l border-white/5 p-8 lg:block">
                <div className="grid gap-4 text-xs text-slate-400">
                  <div><span className="block text-[8px] uppercase tracking-[.22em] text-slate-500">Categoria</span><b className="mt-1 block text-slate-200">{featured.lore.category || "Crônica"}</b></div>
                  <div><span className="block text-[8px] uppercase tracking-[.22em] text-slate-500">Cronologia</span><b className="mt-1 block text-slate-200">{featured.lore.chronology ?? "Arquivo vivo"}</b></div>
                  <div><span className="block text-[8px] uppercase tracking-[.22em] text-slate-500">Versão publicada</span><b className="mt-1 block text-slate-200">v{featured.version}</b></div>
                </div>
              </div>
            </Link>

            <div className="mt-9 flex items-end justify-between gap-4 border-b border-white/8 pb-4">
              <div>
                <p className="text-[9px] uppercase tracking-[.28em] text-amber-200/45">ARQUIVO</p>
                <h3 className="mt-2 font-[var(--font-display)] text-xl text-[#eadfc7]">Histórias publicadas</h3>
              </div>
              <span className="text-[10px] uppercase tracking-[.18em] text-slate-500">{entries.length} registro(s)</span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rest.map((entry) => (
                <Link key={entry.slug} href={`/lore/${encodeURIComponent(entry.slug)}`} className="group min-h-[220px] border border-white/8 bg-white/[.025] p-6 transition hover:border-amber-200/22 hover:bg-amber-100/[.035]">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-[8px] font-bold uppercase tracking-[.22em] text-amber-200/48">{entry.lore.category || "CRÔNICA"}</span>
                    <span className="text-[8px] uppercase tracking-[.16em] text-slate-600">v{entry.version}</span>
                  </div>
                  <h4 className="mt-5 font-[var(--font-display)] text-xl font-bold text-[#ede1c7] transition group-hover:text-[#fff2cf]">{entry.lore.title || entry.slug}</h4>
                  <p className="mt-3 line-clamp-4 text-xs leading-6 text-slate-400">{entry.lore.summary || entry.lore.body || "Arquivo narrativo publicado pelo Studio."}</p>
                  <div className="mt-6 text-[9px] uppercase tracking-[.2em] text-amber-200/55">LER ARQUIVO →</div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
