import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import { PRODUCT_BRAND } from "@/lib/product-brand";
import { readPublishedSiteContentItem } from "@/lib/site-content-public";
import LoreTelemetry from "../LoreTelemetry";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function textList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 12) : [];
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const item = await readPublishedSiteContentItem("lore", slug, "pt-BR");
  if (!item) return { title: `Crônicas · ${PRODUCT_BRAND.displayName}` };
  return { title: `${text(item.payload.title) || slug} · Crônicas` };
}

export default async function LoreEntryPage({ params }: Props) {
  const { slug } = await params;
  const item = await readPublishedSiteContentItem("lore", slug, "pt-BR");
  if (!item) notFound();

  const title = text(item.payload.title) || slug;
  const summary = text(item.payload.summary);
  const body = text(item.payload.body);
  const category = text(item.payload.category) || "Crônica";
  const eyebrow = text(item.payload.eyebrow) || category;
  const imageUrl = text(item.payload.imageUrl);
  const chronology = text(item.payload.chronology);
  const tags = textList(item.payload.tags);
  const relatedCards = textList(item.payload.relatedCards);
  const relatedLore = textList(item.payload.relatedLore);
  const paragraphs = body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

  return (
    <main className="min-h-screen bg-[#05090e] text-slate-100">
      <SiteNav />
      <LoreTelemetry slug={slug} category={category} />

      <section className="relative min-h-[370px] overflow-hidden border-b border-amber-200/10">
        {imageUrl && <div className="absolute inset-0 opacity-30" style={{ backgroundImage: `linear-gradient(90deg,rgba(4,7,11,.95),rgba(4,7,11,.52),rgba(4,7,11,.9)),url(${imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(186,148,74,.14),transparent_28rem)]" />
        <div className="relative mx-auto flex min-h-[370px] max-w-6xl flex-col justify-end px-5 py-10 sm:px-8 lg:px-12">
          <Link href="/lore" className="mb-8 w-max text-[9px] font-bold uppercase tracking-[.24em] text-amber-200/55 hover:text-amber-100">← VOLTAR ÀS CRÔNICAS</Link>
          <p className="text-[9px] font-bold uppercase tracking-[.3em] text-amber-200/55">{eyebrow}</p>
          <h1 className="mt-3 max-w-4xl font-[var(--font-display)] text-3xl font-black leading-tight tracking-[.04em] text-[#f4e8c9] sm:text-5xl">{title}</h1>
          {summary && <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300/75 sm:text-base">{summary}</p>}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-9 sm:px-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:px-12 lg:py-12">
        <article className="min-w-0">
          {paragraphs.length ? paragraphs.map((paragraph, index) => (
            <p key={`${index}:${paragraph.slice(0,24)}`} className="mb-6 text-[15px] leading-8 text-slate-300/82">{paragraph}</p>
          )) : (
            <p className="text-sm leading-7 text-slate-400">Esta entrada foi publicada sem corpo narrativo. O Studio pode complementar o conteúdo a qualquer momento.</p>
          )}
        </article>

        <aside className="border-l border-white/8 pl-6 text-xs text-slate-400">
          <div className="space-y-6">
            <div><span className="block text-[8px] uppercase tracking-[.22em] text-slate-600">Categoria</span><b className="mt-1 block text-slate-200">{category}</b></div>
            <div><span className="block text-[8px] uppercase tracking-[.22em] text-slate-600">Cronologia</span><b className="mt-1 block text-slate-200">{chronology || "Arquivo vivo"}</b></div>
            <div><span className="block text-[8px] uppercase tracking-[.22em] text-slate-600">Publicação</span><b className="mt-1 block text-slate-200">v{item.version}</b></div>
            {!!tags.length && <div><span className="block text-[8px] uppercase tracking-[.22em] text-slate-600">Marcadores</span><div className="mt-2 flex flex-wrap gap-2">{tags.map((tag) => <span key={tag} className="border border-white/10 px-2 py-1 text-[9px] text-slate-400">{tag}</span>)}</div></div>}
            {!!relatedCards.length && <div><span className="block text-[8px] uppercase tracking-[.22em] text-slate-600">Cartas relacionadas</span><div className="mt-2 grid gap-2">{relatedCards.map((card) => <Link key={card} href={`/codex?search=${encodeURIComponent(card)}`} className="text-amber-200/65 hover:text-amber-100">{card} →</Link>)}</div></div>}
            {!!relatedLore.length && <div><span className="block text-[8px] uppercase tracking-[.22em] text-slate-600">Crônicas relacionadas</span><div className="mt-2 grid gap-2">{relatedLore.map((related) => <Link key={related} href={`/lore/${encodeURIComponent(related)}`} className="text-amber-200/65 hover:text-amber-100">{related} →</Link>)}</div></div>}
          </div>
        </aside>
      </section>
    </main>
  );
}
