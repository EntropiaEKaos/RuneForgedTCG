"use client";

import { useEffect, useState } from "react";
import CollectionSymbolMark from "./CollectionSymbolMark";

interface CollectionInfo {
  key: string;
  code: string;
  name: string;
  description: string;
  symbol: string | null;
  banner: string | null;
  releaseDate: string | null;
  rotationDate: string | null;
  lifecycle: "upcoming" | "active" | "rotated";
  cardCount: number;
  metadata?: { accentColor?: string } | null;
}

function CollectionFlipCard({ c }: { c: CollectionInfo }) {
  const [flipped, setFlipped] = useState(false);
  const color = c.metadata?.accentColor || "#f59e0b";
  const bannerStyle = c.banner ? { backgroundImage: `linear-gradient(rgba(15,23,42,.42),rgba(15,23,42,.82)),url(${c.banner})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: `radial-gradient(circle at 50% 30%, ${color}33, #0f172a 70%)` };
  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      className="collection-flip-outer"
      aria-label={`${c.name} — toque para ${flipped ? "ver a frente" : "ver detalhes"}`}
    >
      <div className={`collection-flip-inner ${flipped ? "is-flipped" : ""}`}>
        <div className="collection-flip-face collection-flip-front" style={{ borderColor: color, ...bannerStyle }}>
          <div className="text-5xl"><CollectionSymbolMark symbol={c.symbol} name={c.name} className="mx-auto h-20 w-20 rounded-full object-cover shadow-lg" /></div>
          <h3 className="mt-2 text-lg font-black" style={{ color }}>{c.name}</h3>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${c.lifecycle === "active" ? "bg-emerald-400/15 text-emerald-300" : c.lifecycle === "upcoming" ? "bg-sky-400/15 text-sky-300" : "bg-slate-500/20 text-slate-400"}`}>{c.lifecycle === "active" ? "Standard" : c.lifecycle === "upcoming" ? "Em breve" : "Eternal"}</span>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">{c.cardCount} carta(s)</span>
          </div>
        </div>
        <div className="collection-flip-face collection-flip-back" style={{ borderColor: color }}>
          <p className="text-xs leading-relaxed text-slate-300">{c.description || "Sem descrição."}</p>
          {c.releaseDate && <p className="mt-3 text-[10px] uppercase tracking-widest text-slate-500">Lançamento: {new Date(c.releaseDate).toLocaleDateString("pt-BR")}</p>}
          {c.rotationDate && <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">Rotação: {new Date(c.rotationDate).toLocaleDateString("pt-BR")}</p>}
          <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">{c.lifecycle === "active" ? "Legal no Standard" : c.lifecycle === "rotated" ? "Legal no Eternal" : "Ainda não legal"}</p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">{c.cardCount} carta(s) nesta coleção</p>
        </div>
      </div>
    </button>
  );
}

/**
 * Vitrine pública das coleções/sets (adminCollections). Antes disso, uma
 * coleção só existia como metadado técnico usado pra filtro — o jogador
 * nunca tinha uma tela feita pra "ver" a coleção dele de um jeito que se
 * sentisse uma recompensa, não um dado de sistema.
 */
export default function CollectionsShowcase() {
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setCollections(d.collections);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || collections.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-xl font-black text-amber-200">📚 Coleções</h2>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-slate-400">Toque numa coleção para ver lançamento, rotação e legalidade.</p><a href="/collections" className="text-xs font-bold text-amber-300 hover:text-amber-200">Calendário de coleções →</a></div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {collections.map((c) => (
          <CollectionFlipCard key={c.key} c={c} />
        ))}
      </div>
    </section>
  );
}
