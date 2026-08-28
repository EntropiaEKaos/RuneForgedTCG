"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import CollectionSymbolMark from "@/components/CollectionSymbolMark";
import SiteNav from "@/components/SiteNav";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";

type Lifecycle = "upcoming" | "active" | "rotated";
type LifecycleFilter = "all" | Lifecycle;

type CollectionInfo = {
  key: string;
  code: string;
  name: string;
  description: string;
  symbol: string | null;
  banner: string | null;
  releaseDate: string | null;
  rotationDate: string | null;
  lifecycle: Lifecycle;
  cardCount: number;
};

type CollectionsPayload = {
  ok: boolean;
  collections?: CollectionInfo[];
  error?: string;
};

const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
  upcoming: "Em breve",
  active: "Standard",
  rotated: "Eternal",
};

const LIFECYCLE_COPY: Record<Lifecycle, string> = {
  upcoming: "Ainda não liberada para o ambiente competitivo ativo.",
  active: "Legal no Standard enquanto permanecer dentro da janela publicada.",
  rotated: "Saiu do Standard e continua disponível nos formatos Eternal.",
};

const LIFECYCLE_BADGE: Record<Lifecycle, string> = {
  upcoming: "border-sky-300/20 bg-sky-400/[0.08] text-sky-200",
  active: "border-emerald-300/20 bg-emerald-400/[0.08] text-emerald-200",
  rotated: "border-slate-400/20 bg-slate-400/[0.06] text-slate-300",
};

const LIFECYCLE_DOT: Record<Lifecycle, string> = {
  upcoming: "bg-sky-300 shadow-[0_0_14px_rgba(125,211,252,.45)]",
  active: "bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,.45)]",
  rotated: "bg-slate-500",
};

function formatDate(value: string | null) {
  if (!value) return "Sem data";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data inválida";
  return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function releaseTime(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

export default function CollectionsCalendarClient() {
  const [rows, setRows] = useState<CollectionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/collections", { cache: "no-store" });
      const payload = await response.json() as CollectionsPayload;
      if (!payload.ok) {
        setRows([]);
        setMessage(payload.error || "Não foi possível carregar o calendário de coleções.");
        return;
      }
      setRows(Array.isArray(payload.collections) ? payload.collections : []);
    } catch {
      setRows([]);
      setMessage("Não foi possível sincronizar as coleções publicadas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  const ordered = useMemo(() => [...rows].sort((a, b) => {
    const releaseDelta = releaseTime(a.releaseDate) - releaseTime(b.releaseDate);
    return releaseDelta || a.name.localeCompare(b.name, "pt-BR");
  }), [rows]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    return ordered.filter((collection) => {
      if (lifecycleFilter !== "all" && collection.lifecycle !== lifecycleFilter) return false;
      if (!needle) return true;
      return `${collection.name} ${collection.code} ${collection.description}`.toLocaleLowerCase("pt-BR").includes(needle);
    });
  }, [ordered, lifecycleFilter, query]);

  const counts = useMemo(() => ({
    active: rows.filter((collection) => collection.lifecycle === "active").length,
    upcoming: rows.filter((collection) => collection.lifecycle === "upcoming").length,
    rotated: rows.filter((collection) => collection.lifecycle === "rotated").length,
    cards: rows.reduce((sum, collection) => sum + collection.cardCount, 0),
  }), [rows]);

  const nextUpcoming = useMemo(() => ordered.find((collection) => collection.lifecycle === "upcoming") ?? null, [ordered]);
  const nextRotation = useMemo(() => ordered
    .filter((collection) => collection.lifecycle === "active" && collection.rotationDate)
    .sort((a, b) => releaseTime(a.rotationDate) - releaseTime(b.rotationDate))[0] ?? null, [ordered]);

  return (
    <main className="rf-app-page">
      <SiteNav />
      <div className="rf-app-shell max-w-6xl">
        <header className="rf-app-heading">
          <div>
            <p className="rf-eyebrow"><span /> LINHA DO TEMPO DO NEXUS</p>
            <h1>Calendário de coleções</h1>
            <p>Consulte lançamentos e rotações publicados no Studio. O lifecycle exibido aqui vem da fonte autoritativa usada para distinguir Standard, Eternal e coleções futuras.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/collection" className="rf-button rf-button-secondary">▦ COLEÇÃO</Link>
            <Link href="/album" className="rf-button rf-button-primary">◇ ÁLBUM VANILLA</Link>
          </div>
        </header>

        {message && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-red-300/15 bg-red-500/[0.06] px-4 py-3 text-sm text-red-100" role="status" aria-live="polite">
            <span>{message}</span>
            <button type="button" className="text-xs font-bold text-red-200 underline underline-offset-4" onClick={() => setMessage("")}>Fechar</button>
          </div>
        )}

        <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumo das coleções publicadas">
          <SummaryCard label="Standard" value={counts.active} copy="coleções ativas" tone="text-emerald-200" />
          <SummaryCard label="Em breve" value={counts.upcoming} copy="lançamentos futuros" tone="text-sky-200" />
          <SummaryCard label="Eternal" value={counts.rotated} copy="coleções rotacionadas" tone="text-slate-200" />
          <SummaryCard label="Catálogo" value={counts.cards} copy="cartas publicadas" tone="text-amber-200" />
        </section>

        {(nextUpcoming || nextRotation) && (
          <section className="mb-8 grid gap-3 lg:grid-cols-2" aria-label="Próximos eventos de coleção">
            <ScheduleCard
              eyebrow="PRÓXIMO LANÇAMENTO"
              title={nextUpcoming?.name ?? "Nenhuma coleção anunciada"}
              date={nextUpcoming ? formatDate(nextUpcoming.releaseDate) : "Sem data publicada"}
              copy={nextUpcoming ? `${nextUpcoming.code} · ${nextUpcoming.cardCount} cartas publicadas até agora.` : "O Studio ainda não publicou uma coleção futura."}
            />
            <ScheduleCard
              eyebrow="PRÓXIMA ROTAÇÃO"
              title={nextRotation?.name ?? "Nenhuma rotação anunciada"}
              date={nextRotation ? formatDate(nextRotation.rotationDate) : "Sem data publicada"}
              copy={nextRotation ? `${nextRotation.code} permanece Standard até a data de rotação publicada.` : "Nenhuma coleção Standard possui rotação futura publicada."}
            />
          </section>
        )}

        <section className="mb-5 rounded-2xl border border-white/10 bg-black/20 p-4" aria-labelledby="collections-filter-heading">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">CURADORIA</p>
              <h2 id="collections-filter-heading" className="mt-1 text-xl font-black text-slate-100">Filtrar linha do tempo</h2>
              <p className="mt-1 text-xs text-slate-500">{visible.length} de {ordered.length} coleção{ordered.length === 1 ? "" : "ões"} visível{visible.length === 1 ? "" : "is"}.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[520px]">
              <label className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                Lifecycle
                <select className="input mt-1 w-full" value={lifecycleFilter} onChange={(event) => setLifecycleFilter(event.target.value as LifecycleFilter)}>
                  <option value="all">Todos</option>
                  <option value="active">Standard</option>
                  <option value="upcoming">Em breve</option>
                  <option value="rotated">Eternal</option>
                </select>
              </label>
              <label className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                Buscar
                <input className="input mt-1 w-full" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, código ou descrição…" />
              </label>
            </div>
          </div>
        </section>

        {loading ? (
          <EmptyState busy title="Sincronizando calendário…" copy="Consultando as coleções publicadas e seus lifecycles atuais." />
        ) : ordered.length === 0 ? (
          <EmptyState title="Nenhuma coleção publicada" copy="Quando o Studio publicar uma coleção, ela aparecerá automaticamente nesta linha do tempo." action={<button className="rf-button rf-button-secondary" onClick={() => void load()}>ATUALIZAR</button>} />
        ) : visible.length === 0 ? (
          <EmptyState title="Nenhuma coleção corresponde aos filtros" copy="Altere o lifecycle ou o termo de busca para voltar a exibir a linha do tempo." />
        ) : (
          <section className="relative ml-3 border-l border-white/10 pl-6 sm:ml-5 sm:pl-9" aria-label="Linha do tempo de coleções">
            {visible.map((collection) => (
              <article key={collection.key} className="relative mb-4 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.04),rgba(255,255,255,.015))] p-4 shadow-[0_18px_50px_rgba(0,0,0,.18)] sm:p-5">
                <span className={`absolute -left-[1.94rem] top-8 h-3 w-3 rounded-full border-2 border-[#090d13] sm:-left-[2.7rem] ${LIFECYCLE_DOT[collection.lifecycle]}`} aria-hidden="true" />
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <CollectionSymbolMark symbol={collection.symbol} name={collection.name} className="h-14 w-14 shrink-0 rounded-xl border border-white/10 bg-black/20 object-cover" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-black text-slate-100">{collection.name}</h2>
                        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${LIFECYCLE_BADGE[collection.lifecycle]}`}>{LIFECYCLE_LABEL[collection.lifecycle]}</span>
                      </div>
                      <p className="mt-1 text-xs font-bold text-slate-500">{collection.code} · {collection.cardCount} carta{collection.cardCount === 1 ? "" : "s"}</p>
                      <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-600">{LIFECYCLE_COPY[collection.lifecycle]}</p>
                    </div>
                  </div>

                  <dl className="grid shrink-0 grid-cols-2 gap-2 text-xs md:min-w-[260px]">
                    <DateCell label="Lançamento" value={formatDate(collection.releaseDate)} />
                    <DateCell label="Rotação" value={formatDate(collection.rotationDate)} />
                  </dl>
                </div>

                {collection.description && (
                  <p className="mt-4 border-t border-white/[0.07] pt-4 text-sm leading-6 text-slate-400">{collection.description}</p>
                )}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function SummaryCard({ label, value, copy, tone }: { label: string; value: number; copy: string; tone: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">{label}</p>
      <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{copy}</p>
    </div>
  );
}

function ScheduleCard({ eyebrow, title, date, copy }: { eyebrow: string; title: string; date: string; copy: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-300/15 bg-[linear-gradient(135deg,rgba(217,164,65,.06),rgba(3,5,8,.48))] p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/35 to-transparent" aria-hidden="true" />
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-300/60">{eyebrow}</p>
      <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="font-black text-slate-100">{title}</h2>
        <span className="text-sm font-black text-amber-200">{date}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{copy}</p>
    </div>
  );
}

function DateCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2.5">
      <dt className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-600">{label}</dt>
      <dd className="mt-1 font-bold text-slate-300">{value}</dd>
    </div>
  );
}

function EmptyState({ title, copy, busy = false, action }: { title: string; copy: string; busy?: boolean; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center" aria-busy={busy || undefined}>
      {busy ? <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-amber-300" aria-hidden="true" /> : <div className="text-3xl text-amber-200/65" aria-hidden="true">◇</div>}
      <p className="mt-3 font-bold text-slate-300">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">{copy}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
