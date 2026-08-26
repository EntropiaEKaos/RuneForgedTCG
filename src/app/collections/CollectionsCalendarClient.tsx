"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CollectionSymbolMark from "@/components/CollectionSymbolMark";

type CollectionInfo = {
  key: string; code: string; name: string; description: string; symbol: string | null; banner: string | null;
  releaseDate: string | null; rotationDate: string | null; lifecycle: "upcoming" | "active" | "rotated"; cardCount: number;
};

const label = { upcoming: "Em breve", active: "Standard", rotated: "Eternal" } as const;
const badge = { upcoming: "border-sky-400/30 bg-sky-400/10 text-sky-200", active: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200", rotated: "border-slate-500/30 bg-slate-500/10 text-slate-300" } as const;
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("pt-BR") : "sem data";

export default function CollectionsCalendarClient() {
  const [rows, setRows] = useState<CollectionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/collections", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d.ok) setRows(d.collections || []); }).finally(() => setLoading(false)); }, []);
  const ordered = useMemo(() => [...rows].sort((a, b) => new Date(a.releaseDate || 0).getTime() - new Date(b.releaseDate || 0).getTime()), [rows]);
  return <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#1e293b,#0f172a_55%,#020617)] px-4 py-8 text-slate-100">
    <div className="mx-auto max-w-5xl">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.24em] text-amber-400">RuneForge timeline</p><h1 className="mt-1 text-3xl font-black">Calendário de coleções</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">O Standard usa automaticamente as janelas de lançamento e rotação publicadas no Studio. Coleções rotacionadas continuam legais no Eternal.</p></div><div className="flex gap-3"><Link href="/collection" className="btn-ghost">Coleção</Link><Link href="/album" className="btn-ghost">Álbum</Link></div></div>
      {loading ? <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-slate-400">Carregando calendário…</div> : !ordered.length ? <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-slate-400">Nenhuma coleção publicada.</div> : <div className="relative ml-4 border-l border-white/10 pl-7">
        {ordered.map((c) => <article key={c.key} className="relative mb-5 rounded-2xl border border-white/10 bg-slate-950/45 p-5"><span className="absolute -left-[2.15rem] top-7 h-3 w-3 rounded-full border-2 border-slate-950 bg-amber-300"/><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3"><CollectionSymbolMark symbol={c.symbol} name={c.name} className="h-12 w-12 rounded-full object-cover"/><div><div className="flex items-center gap-2"><h2 className="text-lg font-black">{c.name}</h2><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${badge[c.lifecycle]}`}>{label[c.lifecycle]}</span></div><p className="text-xs text-slate-500">{c.code} · {c.cardCount} carta(s)</p></div></div><div className="grid grid-cols-2 gap-2 text-right text-[10px] uppercase tracking-wider text-slate-500"><span>Lançamento<br/><b className="text-slate-200">{date(c.releaseDate)}</b></span><span>Rotação<br/><b className="text-slate-200">{date(c.rotationDate)}</b></span></div></div>{c.description && <p className="mt-4 text-sm leading-6 text-slate-400">{c.description}</p>}</article>)}
      </div>}
    </div>
  </main>;
}
