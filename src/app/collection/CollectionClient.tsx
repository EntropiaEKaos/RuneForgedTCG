"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import CardTip from "@/components/CardTip";
import CollectionsShowcase from "@/components/CollectionsShowcase";
import SiteNav from "@/components/SiteNav";
import { CARD_REGIONS } from "@/game/card-authoring";
import type { CardDef, CardType, Keyword, Rarity, Region } from "@/game/types";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ensurePlayerSession } from "@/lib/client-player-session";
import { pendingEconomyOperationId, settleEconomyOperation } from "@/lib/client-economy-operation";

interface CollectionCard extends CardDef {
  owned: number;
  shiny: boolean;
  dustValue: number;
  craftCost: number;
}

interface PlayerInfo {
  name: string;
  gold: number;
  dust: number;
  level: number;
  xp: number;
}

type OwnershipFilter = "All" | "Owned" | "Missing" | "Complete";
type CostFilter = "All" | "0-2" | "3-5" | "6+";
type SortMode = "curve" | "name" | "rarity";

type CollectionPayload = {
  ok?: boolean;
  player?: unknown;
  collection?: unknown[];
  totalCards?: number;
  ownedCards?: number;
  totalDefinitions?: number;
  duplicateCap?: number;
  error?: string;
  dustSpent?: number;
  dustGained?: number;
};

const REGIONS: Array<Region | "All"> = ["All", ...CARD_REGIONS];
const RARITIES: Array<Rarity | "All"> = ["All", "Common", "Rare", "Epic", "Legend"];
const TYPES: Array<CardType | "All"> = ["All", "Unit", "Spell", "Enchantment", "Artifact", "Equipment", "Sentinela"];
const OWNERSHIP: OwnershipFilter[] = ["All", "Owned", "Missing", "Complete"];
const COSTS: CostFilter[] = ["All", "0-2", "3-5", "6+"];
const KEYWORDS: Array<Keyword | "All"> = ["All", "Barrier", "Challenger", "Elusive", "Fearsome", "Flying", "Haste", "Lifesteal", "Overwhelm", "QuickAttack", "Regeneration", "Tough"];

const RARITY_LABEL: Record<Rarity, string> = {
  Common: "Comum",
  Rare: "Rara",
  Epic: "Épica",
  Legend: "Lendária",
};

const RARITY_COLOR: Record<Rarity, string> = {
  Common: "text-slate-300",
  Rare: "text-blue-300",
  Epic: "text-purple-300",
  Legend: "text-amber-300",
};

const RARITY_BG: Record<Rarity, string> = {
  Common: "border-slate-500/30 bg-slate-500/5",
  Rare: "border-blue-500/30 bg-blue-500/5",
  Epic: "border-purple-500/30 bg-purple-500/5",
  Legend: "border-amber-500/30 bg-amber-500/5",
};

const RARITY_ORDER: Record<Rarity, number> = {
  Legend: 0,
  Epic: 1,
  Rare: 2,
  Common: 3,
};

function isPlayerInfo(value: unknown): value is PlayerInfo {
  if (!value || typeof value !== "object") return false;
  const player = value as Partial<PlayerInfo>;
  return typeof player.name === "string"
    && typeof player.gold === "number"
    && typeof player.dust === "number"
    && typeof player.level === "number"
    && typeof player.xp === "number";
}

function isCollectionCard(value: unknown): value is CollectionCard {
  if (!value || typeof value !== "object") return false;
  const card = value as Partial<CollectionCard>;
  return typeof card.defId === "string"
    && typeof card.name === "string"
    && typeof card.cost === "number"
    && typeof card.owned === "number"
    && typeof card.dustValue === "number"
    && typeof card.craftCost === "number";
}

function matchesCost(cost: number, filter: CostFilter): boolean {
  if (filter === "All") return true;
  if (filter === "0-2") return cost <= 2;
  if (filter === "3-5") return cost >= 3 && cost <= 5;
  return cost >= 6;
}

function quantityOptions(max: number): number[] {
  const cap = Math.max(0, Math.trunc(max));
  if (cap <= 0) return [];
  return Array.from(new Set([1, Math.min(2, cap), cap])).filter((value) => value > 0 && value <= cap);
}

export default function CollectionClient() {
  const [playerName, setPlayerName] = useState("");
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [ownedCards, setOwnedCards] = useState(0);
  const [totalDefinitions, setTotalDefinitions] = useState(0);
  const [duplicateCap, setDuplicateCap] = useState(3);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const [regionFilter, setRegionFilter] = useState<Region | "All">("All");
  const [rarityFilter, setRarityFilter] = useState<Rarity | "All">("All");
  const [typeFilter, setTypeFilter] = useState<CardType | "All">("All");
  const [ownFilter, setOwnFilter] = useState<OwnershipFilter>("All");
  const [search, setSearch] = useState("");
  const [costFilter, setCostFilter] = useState<CostFilter>("All");
  const [keywordFilter, setKeywordFilter] = useState<Keyword | "All">("All");
  const [sortBy, setSortBy] = useState<SortMode>("curve");

  const applySnapshot = useCallback((payload: CollectionPayload) => {
    const nextCards = Array.isArray(payload.collection) ? payload.collection.filter(isCollectionCard) : [];
    const nextPlayer = isPlayerInfo(payload.player) ? payload.player : null;
    setCards(nextCards);
    setPlayer(nextPlayer);
    if (nextPlayer) setPlayerName(nextPlayer.name);
    setTotalCards(Math.max(0, Math.trunc(Number(payload.totalCards) || 0)));
    setOwnedCards(Math.max(0, Math.trunc(Number(payload.ownedCards) || 0)));
    setTotalDefinitions(Math.max(0, Math.trunc(Number(payload.totalDefinitions) || nextCards.length)));
    setDuplicateCap(Math.max(1, Math.trunc(Number(payload.duplicateCap) || 3)));
  }, []);

  const loadCollection = useCallback(async (silent = false): Promise<boolean> => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/collection", { cache: "no-store" });
      const payload = await response.json() as CollectionPayload;
      if (!payload.ok) {
        if (!silent) setMessage(`❌ ${payload.error || "Não foi possível carregar sua coleção."}`);
        return false;
      }
      applySnapshot(payload);
      return true;
    } catch {
      if (!silent) setMessage("❌ Não foi possível sincronizar sua coleção com o servidor.");
      return false;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [applySnapshot]);

  useDeferredEffect(() => {
    let cancelled = false;
    void ensurePlayerSession(localStorage.getItem("runeforge_playername") || "")
      .then(async (profile) => {
        if (cancelled) return;
        if (profile.player?.name) setPlayerName(String(profile.player.name));
        await loadCollection();
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setMessage("❌ Não foi possível estabelecer a identidade do jogador.");
        }
      });
    return () => { cancelled = true; };
  }, [loadCollection]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return cards
      .filter((card) => card.collectible !== false)
      .filter((card) => regionFilter === "All" || card.region === regionFilter)
      .filter((card) => rarityFilter === "All" || card.rarity === rarityFilter)
      .filter((card) => typeFilter === "All" || card.type === typeFilter)
      .filter((card) => matchesCost(card.cost, costFilter))
      .filter((card) => keywordFilter === "All" || (card.keywords ?? []).includes(keywordFilter))
      .filter((card) => {
        if (ownFilter === "Owned") return card.owned > 0;
        if (ownFilter === "Missing") return card.owned === 0;
        if (ownFilter === "Complete") return card.owned >= duplicateCap;
        return true;
      })
      .filter((card) => {
        if (!query) return true;
        return card.name.toLowerCase().includes(query)
          || (card.description ?? "").toLowerCase().includes(query)
          || (card.race ?? "").toLowerCase().includes(query)
          || String(card.region).toLowerCase().includes(query)
          || (card.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const aOwned = a.owned > 0 ? 1 : 0;
        const bOwned = b.owned > 0 ? 1 : 0;
        if (aOwned !== bOwned) return bOwned - aOwned;
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "rarity") return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.cost - b.cost || a.name.localeCompare(b.name);
        return a.cost - b.cost || a.name.localeCompare(b.name);
      });
  }, [cards, regionFilter, rarityFilter, typeFilter, ownFilter, costFilter, keywordFilter, sortBy, search, duplicateCap]);

  const stats = useMemo(() => {
    const byRarity: Record<Rarity, { owned: number; total: number }> = {
      Common: { owned: 0, total: 0 },
      Rare: { owned: 0, total: 0 },
      Epic: { owned: 0, total: 0 },
      Legend: { owned: 0, total: 0 },
    };
    let complete = 0;
    for (const card of cards) {
      if (card.collectible === false) continue;
      byRarity[card.rarity].total += 1;
      if (card.owned > 0) byRarity[card.rarity].owned += 1;
      if (card.owned >= duplicateCap) complete += 1;
    }
    return { byRarity, complete };
  }, [cards, duplicateCap]);

  const selectedCard = useMemo(
    () => cards.find((card) => card.defId === selectedCardId) ?? null,
    [cards, selectedCardId],
  );

  const completion = totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 0;
  const missingCards = Math.max(0, totalCards - ownedCards);
  const activeFilters = [regionFilter, rarityFilter, typeFilter, ownFilter, costFilter, keywordFilter].filter((value) => value !== "All").length + (search.trim() ? 1 : 0);

  const clearFilters = () => {
    setRegionFilter("All");
    setRarityFilter("All");
    setTypeFilter("All");
    setOwnFilter("All");
    setCostFilter("All");
    setKeywordFilter("All");
    setSortBy("curve");
    setSearch("");
  };

  const doAction = async (action: "craft" | "disenchant", card: CollectionCard, amount = 1) => {
    if (!player || actionKey) return;
    const fingerprint = `${action}:${card.defId}:${amount}`;
    setActionKey(fingerprint);
    setMessage("");
    try {
      const operationId = pendingEconomyOperationId(fingerprint);
      const response = await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Operation-Id": operationId },
        body: JSON.stringify({ action, defId: card.defId, amount, operationId }),
      });
      const payload = await response.json() as CollectionPayload;
      settleEconomyOperation(fingerprint, response.status);

      if (!payload.ok) {
        setMessage(`❌ ${payload.error || "A operação foi recusada pelo servidor."}`);
        return;
      }

      const successMessage = action === "craft"
        ? `✨ ${amount}x ${card.name} forjada(s) por ${Number(payload.dustSpent) || card.craftCost * amount} de pó.`
        : `💠 ${amount}x ${card.name} desencantada(s) por ${Number(payload.dustGained) || card.dustValue * amount} de pó.`;
      const refreshed = await loadCollection(true);
      setMessage(refreshed ? successMessage : `${successMessage} A operação foi confirmada, mas a coleção precisa ser atualizada novamente.`);
    } catch {
      setMessage("⚠️ Não foi possível confirmar a operação. Tente novamente: o mesmo identificador será reutilizado com segurança.");
    } finally {
      setActionKey(null);
    }
  };

  return (
    <main className="rf-app-page">
      <SiteNav />
      <div className="rf-app-shell">
        <header className="rf-app-heading">
          <div>
            <p className="rf-eyebrow"><span /> ARQUIVO DO INVOCADOR</p>
            <h1>Coleção de Cartas</h1>
            <p>Consulte seu acervo, encontre lacunas e transforme pó em cópias com operações protegidas pelo ledger da economia.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/album" className="rf-button rf-button-secondary">ÁLBUM VANILLA</Link>
            <Link href="/collections" className="rf-button rf-button-secondary">CALENDÁRIO</Link>
            <Link href="/store" className="rf-button rf-button-primary">LOJA</Link>
          </div>
        </header>

        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Resumo da coleção">
          <SummaryCard label="Conclusão" value={`${completion}%`} detail={`${ownedCards}/${totalCards} cartas distintas`} />
          <SummaryCard label="Faltando" value={missingCards} detail="definições colecionáveis" />
          <SummaryCard label="No limite" value={stats.complete} detail={`com ${duplicateCap}/${duplicateCap} cópias`} />
          <SummaryCard label="Pó" value={player?.dust ?? "—"} detail="saldo para forja" />
          <SummaryCard label="Identidade" value={playerName || "Sincronizando"} detail={player ? `nível ${player.level} · ${player.gold} ouro` : "sessão estável"} />
        </section>

        <section className="mb-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4" aria-labelledby="collection-progress-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Progresso do acervo</p>
              <h2 id="collection-progress-heading" className="mt-1 text-xl font-black text-white">Domínio por raridade</h2>
              <p className="mt-1 text-xs text-slate-400">{totalDefinitions || cards.length} definições carregadas · limite atual de {duplicateCap} cópias por carta.</p>
            </div>
            <div className="min-w-[180px] flex-1 md:max-w-sm">
              <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500"><span>Conclusão geral</span><span>{completion}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Conclusão geral da coleção" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion}>
                <div className="h-full bg-amber-400 transition-[width]" style={{ width: `${Math.min(100, Math.max(0, completion))}%` }} />
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(["Common", "Rare", "Epic", "Legend"] as Rarity[]).map((rarity) => {
              const rarityStats = stats.byRarity[rarity];
              const percent = rarityStats.total > 0 ? Math.round((rarityStats.owned / rarityStats.total) * 100) : 0;
              return (
                <div key={rarity} className={`rounded-xl border p-3 ${RARITY_BG[rarity]}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-black ${RARITY_COLOR[rarity]}`}>{RARITY_LABEL[rarity]}</span>
                    <span className="text-xs text-slate-400">{rarityStats.owned}/{rarityStats.total}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label={`Progresso ${RARITY_LABEL[rarity]}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                    <div className="h-full bg-white/70" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {message && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100" role="status" aria-live="polite">
            <span>{message}</span>
            <button type="button" className="text-xs font-black uppercase tracking-wider text-amber-200 hover:text-white" onClick={() => setMessage("")}>Fechar</button>
          </div>
        )}

        <CollectionsShowcase />

        <section className="my-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4" aria-labelledby="collection-filters-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-slate-500">Catálogo pessoal</p>
              <h2 id="collection-filters-heading" className="mt-1 text-lg font-black text-white">Filtrar coleção</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{filtered.length} resultado(s)</span>
              {activeFilters > 0 && <button type="button" onClick={clearFilters} className="font-bold text-amber-300 hover:text-amber-200">Limpar {activeFilters} filtro(s)</button>}
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <label className="sm:col-span-2 xl:col-span-2">
              <span className="sr-only">Buscar cartas</span>
              <input className="input w-full" placeholder="Buscar nome, texto, raça ou keyword…" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <FilterSelect label="Região" value={regionFilter} onChange={(value) => setRegionFilter(value as Region | "All")} options={REGIONS.map((value) => ({ value, label: value === "All" ? "Todas regiões" : value }))} />
            <FilterSelect label="Raridade" value={rarityFilter} onChange={(value) => setRarityFilter(value as Rarity | "All")} options={RARITIES.map((value) => ({ value, label: value === "All" ? "Todas raridades" : RARITY_LABEL[value] }))} />
            <FilterSelect label="Tipo" value={typeFilter} onChange={(value) => setTypeFilter(value as CardType | "All")} options={TYPES.map((value) => ({ value, label: value === "All" ? "Todos tipos" : value }))} />
            <FilterSelect label="Posse" value={ownFilter} onChange={(value) => setOwnFilter(value as OwnershipFilter)} options={OWNERSHIP.map((value) => ({ value, label: value === "All" ? "Toda posse" : value === "Owned" ? "Obtidas" : value === "Missing" ? "Faltando" : "No limite" }))} />
            <FilterSelect label="Custo" value={costFilter} onChange={(value) => setCostFilter(value as CostFilter)} options={COSTS.map((value) => ({ value, label: value === "All" ? "Todo custo" : value }))} />
            <FilterSelect label="Keyword" value={keywordFilter} onChange={(value) => setKeywordFilter(value as Keyword | "All")} options={KEYWORDS.map((value) => ({ value, label: value === "All" ? "Toda keyword" : value }))} />
            <FilterSelect label="Ordenação" value={sortBy} onChange={(value) => setSortBy(value as SortMode)} options={[{ value: "curve", label: "Curva de mana" }, { value: "name", label: "Nome" }, { value: "rarity", label: "Raridade" }]} />
          </div>
        </section>

        {loading ? (
          <EmptyState title="Sincronizando coleção" text="Carregando acervo, custos de forja e saldo da sua identidade estável." />
        ) : cards.length === 0 ? (
          <EmptyState title="Coleção indisponível" text="Nenhuma definição foi carregada. Tente sincronizar novamente." action={<button type="button" className="rf-button rf-button-secondary" onClick={() => void loadCollection()}>TENTAR NOVAMENTE</button>} />
        ) : filtered.length === 0 ? (
          <EmptyState title="Nenhuma carta corresponde aos filtros" text="A coleção está carregada; ajuste ou limpe os filtros para voltar ao catálogo." action={<button type="button" className="rf-button rf-button-secondary" onClick={clearFilters}>LIMPAR FILTROS</button>} />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section aria-label="Cartas da coleção">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {filtered.map((card) => {
                  const selected = selectedCardId === card.defId;
                  return (
                    <button
                      type="button"
                      key={card.defId}
                      onClick={() => setSelectedCardId(card.defId)}
                      aria-pressed={selected}
                      aria-label={`${card.name}, ${RARITY_LABEL[card.rarity]}, ${card.owned} de ${duplicateCap} cópias`}
                      className={`group relative flex min-w-0 flex-col items-center gap-2 rounded-xl border p-2 text-left transition ${selected ? "border-amber-400/70 bg-amber-400/10" : "border-white/10 bg-white/[.025] hover:border-white/25 hover:bg-white/[.045]"} ${card.owned === 0 ? "opacity-55" : ""}`}
                    >
                      {card.shiny && <span className="absolute right-2 top-2 z-10 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-cyan-200">Brilhante</span>}
                      <div className={`pointer-events-none transition ${card.owned === 0 ? "grayscale" : "group-hover:-translate-y-0.5"}`}><CardTip defId={card.defId} size="sm" /></div>
                      <div className="flex w-full items-center justify-between gap-2 px-1 text-[10px]">
                        <span className={`font-black uppercase tracking-wider ${RARITY_COLOR[card.rarity]}`}>{RARITY_LABEL[card.rarity]}</span>
                        <span className="font-black text-slate-200">{card.owned}/{duplicateCap}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="self-start rounded-2xl border border-white/10 bg-slate-950/55 p-4 lg:sticky lg:top-4" aria-label="Detalhes e ações da carta">
              {selectedCard ? (
                <CardEconomyPanel card={selectedCard} duplicateCap={duplicateCap} dust={player?.dust ?? 0} busy={Boolean(actionKey)} actionKey={actionKey} onAction={doAction} />
              ) : (
                <div className="py-12 text-center">
                  <div className="text-4xl">◇</div>
                  <h3 className="mt-3 font-black text-white">Selecione uma carta</h3>
                  <p className="mx-auto mt-2 max-w-[230px] text-xs leading-5 text-slate-400">O painel mostra suas cópias, custo de forja, retorno de desencanto e ações seguras de economia.</p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-4">
      <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-2xl font-black text-white" title={String(value)}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select className="input w-full" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-6 py-14 text-center">
      <div className="text-4xl">◇</div>
      <h2 className="mt-3 text-xl font-black text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">{text}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

function CardEconomyPanel({ card, duplicateCap, dust, busy, actionKey, onAction }: { card: CollectionCard; duplicateCap: number; dust: number; busy: boolean; actionKey: string | null; onAction: (action: "craft" | "disenchant", card: CollectionCard, amount: number) => Promise<void> }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-center"><CardTip defId={card.defId} size="lg" /></div>
      <div className="text-center">
        <h3 className="text-lg font-black text-white">{card.name}</h3>
        <p className={`mt-1 text-xs font-black uppercase tracking-wider ${RARITY_COLOR[card.rarity]}`}>{RARITY_LABEL[card.rarity]} · {card.region} · {card.type}</p>
        {card.shiny && <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-cyan-200">Cópia brilhante registrada</p>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="Você possui" value={`${card.owned}/${duplicateCap}`} />
        <Metric label="Pó disponível" value={dust} />
      </div>

      <section className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3" aria-label="Forjar cópias">
        <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-wider text-cyan-200">Forjar</p><p className="mt-1 text-xs text-slate-400">{card.craftCost} de pó por cópia.</p></div><span className="text-lg">💠</span></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {quantityOptions(Math.max(0, duplicateCap - card.owned)).map((amount) => {
            const key = `craft:${card.defId}:${amount}`;
            const cost = card.craftCost * amount;
            return <button type="button" key={amount} disabled={busy || dust < cost} onClick={() => void onAction("craft", card, amount)} className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-2 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-35">{actionKey === key ? "Confirmando…" : `+${amount} · ${cost} 💠`}</button>;
          })}
          {card.owned >= duplicateCap && <p className="col-span-full py-1 text-xs text-slate-500">Limite de cópias atingido.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3" aria-label="Desencantar cópias">
        <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-wider text-amber-200">Desencantar</p><p className="mt-1 text-xs text-slate-400">Retorno de {card.dustValue} de pó por cópia.</p></div><span className="text-lg">🔥</span></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {quantityOptions(card.owned).map((amount) => {
            const key = `disenchant:${card.defId}:${amount}`;
            const gain = card.dustValue * amount;
            return <button type="button" key={amount} disabled={busy} onClick={() => void onAction("disenchant", card, amount)} className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-2 py-2 text-xs font-black text-amber-100 hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-35">{actionKey === key ? "Confirmando…" : `-${amount} · +${gain} 💠`}</button>;
          })}
          {card.owned === 0 && <p className="col-span-full py-1 text-xs text-slate-500">Você não possui cópias para desencantar.</p>}
        </div>
      </section>

      <p className="text-xs leading-5 text-slate-400">{card.description}</p>
      <p className="rounded-lg border border-white/10 bg-white/[.025] px-3 py-2 text-[10px] leading-4 text-slate-500">Craft e desencanto usam operação idempotente. Em resposta de rede incerta, uma nova tentativa reutiliza o mesmo identificador antes de criar outra intenção.</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-center"><p className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p></div>;
}
