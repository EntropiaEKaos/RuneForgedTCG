"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import SiteNav from "@/components/SiteNav";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import type { Rarity } from "@/game/types";
import { ensurePlayerSession } from "@/lib/client-player-session";

interface AlbumCard {
  defId: string;
  name: string;
  rarity: Rarity;
  region: string;
  emoji: string;
  cost: number;
  collectible: boolean;
  owned: number;
}

interface AlbumMilestone {
  percent: number;
  grants: unknown;
  claimed: boolean;
  available: boolean;
}

interface AlbumData {
  cards: AlbumCard[];
  totalDefinitions: number;
  totalCollectible: number;
  ownedDistinct: number;
  percent: number;
  milestones: AlbumMilestone[];
}

type OwnershipFilter = "all" | "owned" | "missing";
type RarityFilter = "All" | Rarity;

const RARITIES: Rarity[] = ["Common", "Rare", "Epic", "Legend"];
const RARITY_LABEL: Record<Rarity, string> = {
  Common: "Comum",
  Rare: "Rara",
  Epic: "Épica",
  Legend: "Lendária",
};
const RARITY_TONE: Record<Rarity, string> = {
  Common: "border-slate-400/20 text-slate-300",
  Rare: "border-blue-400/25 text-blue-300",
  Epic: "border-purple-400/25 text-purple-300",
  Legend: "border-amber-400/30 text-amber-200",
};

export default function AlbumClient() {
  const [data, setData] = useState<AlbumData | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [claimingMilestone, setClaimingMilestone] = useState<number | null>(null);
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("all");
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("All");
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      await ensurePlayerSession(localStorage.getItem("runeforge_playername") || "");
      const response = await fetch("/api/collections/vanilla/album", { cache: "no-store" });
      const payload = await response.json();
      if (payload.ok) {
        setData(payload as AlbumData);
      } else {
        setMessage(payload.error || "Falha ao carregar o álbum Vanilla.");
      }
    } catch {
      setMessage("Não foi possível sincronizar o álbum Vanilla.");
    } finally {
      setLoading(false);
    }
  };

  useDeferredEffect(() => {
    void load();
  }, []);

  const claim = async (milestone: number) => {
    if (claimingMilestone !== null) return;
    setClaimingMilestone(milestone);
    setMessage("");
    try {
      const response = await fetch("/api/collections/vanilla/album", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestone }),
      });
      const payload = await response.json();
      if (payload.ok) {
        setData(payload as AlbumData);
        setMessage(`✅ Recompensa do marco de ${milestone}% coletada.`);
      } else {
        setMessage(`❌ ${payload.error || "Falha ao coletar recompensa"}`);
      }
    } catch {
      setMessage("❌ Não foi possível confirmar a recompensa do álbum.");
    } finally {
      setClaimingMilestone(null);
    }
  };

  const collectibleCards = useMemo(() => data?.cards.filter((card) => card.collectible) ?? [], [data]);
  const ownedCards = useMemo(() => collectibleCards.filter((card) => card.owned > 0), [collectibleCards]);
  const missingCards = useMemo(() => collectibleCards.filter((card) => card.owned <= 0), [collectibleCards]);

  const visibleCards = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    return collectibleCards.filter((card) => {
      if (ownershipFilter === "owned" && card.owned <= 0) return false;
      if (ownershipFilter === "missing" && card.owned > 0) return false;
      if (rarityFilter !== "All" && card.rarity !== rarityFilter) return false;
      if (needle && !`${card.name} ${card.region} ${card.rarity}`.toLocaleLowerCase("pt-BR").includes(needle)) return false;
      return true;
    });
  }, [collectibleCards, ownershipFilter, rarityFilter, query]);

  const rarityStats = useMemo(() => RARITIES.map((rarity) => {
    const cards = collectibleCards.filter((card) => card.rarity === rarity);
    const owned = cards.filter((card) => card.owned > 0).length;
    return { rarity, total: cards.length, owned };
  }), [collectibleCards]);

  const claimableCount = data?.milestones.filter((milestone) => milestone.available && !milestone.claimed).length ?? 0;

  return (
    <main className="rf-app-page">
      <SiteNav />
      <div className="rf-app-shell max-w-7xl">
        <header className="rf-app-heading">
          <div className="flex items-start gap-4">
            <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-amber-300/20 bg-black/25 shadow-[0_0_36px_rgba(217,164,65,.08)] sm:h-20 sm:w-20">
              <Image src="/art/collections/vanilla-symbol.png" width={80} height={80} alt="Símbolo da coleção Vanilla" priority className="h-full w-full object-contain p-1" />
            </div>
            <div>
              <p className="rf-eyebrow"><span /> PRIMEIRA COLEÇÃO</p>
              <h1>Álbum Vanilla</h1>
              <p>Complete a coleção inaugural do RuneForge, acompanhe raridades e desbloqueie marcos permanentes conforme o álbum avança.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/collection" className="rf-button rf-button-secondary">▦ COLEÇÃO</Link>
            <Link href="/store" className="rf-button rf-button-primary">◇ LOJA</Link>
          </div>
        </header>

        {message && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100" role="status" aria-live="polite">
            <span>{message}</span>
            <button type="button" className="text-xs font-bold text-amber-200 underline underline-offset-4" onClick={() => setMessage("")}>Fechar</button>
          </div>
        )}

        {loading && !data ? (
          <EmptyState busy title="Sincronizando o álbum…" copy="Carregando coleção, propriedade das cartas e marcos de recompensa." />
        ) : !data ? (
          <EmptyState title="Álbum indisponível" copy="A coleção Vanilla não pôde ser carregada nesta sessão." action={<button className="rf-button rf-button-secondary" onClick={() => void load()}>TENTAR NOVAMENTE</button>} />
        ) : (
          <>
            <section className="relative mb-8 overflow-hidden rounded-2xl border border-amber-300/20 bg-[radial-gradient(circle_at_10%_10%,rgba(217,164,65,.13),transparent_30rem),linear-gradient(145deg,rgba(255,255,255,.04),rgba(255,255,255,.012))] p-5 sm:p-6" aria-labelledby="album-progress-heading">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/45 to-transparent" aria-hidden="true" />
              <div className="grid gap-6 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] lg:items-center">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300/65">PROGRESSO DA COLEÇÃO</p>
                  <div className="mt-2 flex items-end gap-3">
                    <h2 id="album-progress-heading" className="text-5xl font-black tracking-tight text-amber-200 sm:text-6xl">{data.percent}%</h2>
                    <span className="pb-1 text-sm font-bold text-slate-500">completo</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{data.ownedDistinct} de {data.totalCollectible} cartas colecionáveis encontradas · {data.totalDefinitions} definições Vanilla registradas.</p>
                  <div className="mt-4 h-3 overflow-hidden rounded-full border border-white/[0.06] bg-black/35" role="progressbar" aria-label="Progresso do álbum Vanilla" aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.percent}>
                    <div className="h-full bg-gradient-to-r from-amber-600 via-amber-300 to-yellow-100 shadow-[0_0_14px_rgba(251,191,36,.25)]" style={{ width: `${Math.min(100, Math.max(0, data.percent))}%` }} />
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">MARCOS PERMANENTES</p>
                      <h3 className="mt-1 text-lg font-black text-slate-100">Recompensas do álbum</h3>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-bold text-slate-400">{claimableCount} pronta{claimableCount === 1 ? "" : "s"}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {data.milestones.map((milestone) => {
                      const busy = claimingMilestone === milestone.percent;
                      return (
                        <button
                          key={milestone.percent}
                          type="button"
                          onClick={() => void claim(milestone.percent)}
                          disabled={!milestone.available || milestone.claimed || claimingMilestone !== null}
                          className={`rounded-xl border px-4 py-3 text-left transition disabled:cursor-not-allowed ${milestone.claimed ? "border-emerald-300/15 bg-emerald-500/[0.05] text-emerald-200" : milestone.available ? "border-amber-300/30 bg-amber-300/[0.07] text-amber-100 hover:bg-amber-300/[0.11]" : "border-white/[0.07] bg-white/[0.02] text-slate-600"}`}
                        >
                          <span className="block text-xl font-black">{milestone.percent}%</span>
                          <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.12em]">
                            {milestone.claimed ? "✓ COLETADO" : busy ? "COLETANDO…" : milestone.available ? "COLETAR RECOMPENSA" : "BLOQUEADO"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Progresso por raridade">
              {rarityStats.map((stat) => {
                const percent = stat.total > 0 ? Math.round((stat.owned / stat.total) * 100) : 0;
                return (
                  <div key={stat.rarity} className={`rounded-xl border bg-white/[0.025] p-4 ${RARITY_TONE[stat.rarity]}`}>
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] opacity-70">{RARITY_LABEL[stat.rarity]}</p>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <p className="text-2xl font-black text-slate-100">{stat.owned}/{stat.total}</p>
                      <span className="text-xs font-bold">{percent}%</span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/35">
                      <div className="h-full bg-current opacity-70" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="mb-5 rounded-2xl border border-white/10 bg-black/20 p-4" aria-labelledby="album-filters-heading">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">CATÁLOGO VANILLA</p>
                  <h2 id="album-filters-heading" className="mt-1 text-xl font-black text-slate-100">Filtrar álbum</h2>
                  <p className="mt-1 text-xs text-slate-500">{visibleCards.length} carta{visibleCards.length === 1 ? "" : "s"} visível{visibleCards.length === 1 ? "" : "is"} · {ownedCards.length} obtidas · {missingCards.length} faltando</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[670px]">
                  <label className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                    Estado
                    <select className="input mt-1 w-full" value={ownershipFilter} onChange={(event) => setOwnershipFilter(event.target.value as OwnershipFilter)}>
                      <option value="all">Todas</option>
                      <option value="owned">Obtidas</option>
                      <option value="missing">Faltando</option>
                    </select>
                  </label>
                  <label className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                    Raridade
                    <select className="input mt-1 w-full" value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value as RarityFilter)}>
                      <option value="All">Todas</option>
                      {RARITIES.map((rarity) => <option key={rarity} value={rarity}>{RARITY_LABEL[rarity]}</option>)}
                    </select>
                  </label>
                  <label className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                    Buscar
                    <input className="input mt-1 w-full" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome ou região…" type="search" />
                  </label>
                </div>
              </div>
            </section>

            {visibleCards.length === 0 ? (
              <EmptyState title="Nenhuma carta corresponde aos filtros" copy="Altere estado, raridade ou termo de busca para voltar a exibir o álbum." />
            ) : (
              <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9" aria-label="Cartas do álbum Vanilla">
                {visibleCards.map((card) => {
                  const owned = card.owned > 0;
                  return (
                    <article
                      key={card.defId}
                      title={`${card.name} · ${RARITY_LABEL[card.rarity]} · ${card.region}`}
                      className={`group relative aspect-[3/4] overflow-hidden rounded-xl border p-2.5 text-center transition ${owned ? "border-amber-300/25 bg-[linear-gradient(145deg,rgba(217,164,65,.09),rgba(255,255,255,.025))] shadow-[0_10px_28px_rgba(0,0,0,.16)] hover:-translate-y-0.5 hover:border-amber-300/40" : "border-white/[0.06] bg-white/[0.018] opacity-35 grayscale"}`}
                    >
                      <div className="absolute right-2 top-2 rounded-md border border-white/[0.08] bg-black/30 px-1.5 py-0.5 text-[9px] font-black text-slate-400">{card.cost}⚡</div>
                      <div className="mt-5 text-3xl" aria-hidden="true">{card.emoji}</div>
                      <h3 className="mt-3 truncate text-[10px] font-black text-slate-100">{card.name}</h3>
                      <p className={`mt-1 truncate text-[9px] font-bold ${RARITY_TONE[card.rarity].split(" ")[1]}`}>{RARITY_LABEL[card.rarity]}</p>
                      <p className="mt-1 truncate text-[9px] text-slate-600">{card.region}</p>
                      <div className="absolute inset-x-2 bottom-2 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.08em]">
                        <span className={owned ? "text-emerald-300" : "text-slate-700"}>{owned ? "OBTIDA" : "FALTANDO"}</span>
                        <span className={owned ? "text-amber-200" : "text-slate-700"}>{owned ? `×${card.owned}` : "—"}</span>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </main>
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
