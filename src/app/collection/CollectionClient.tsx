"use client";

import { CARD_REGIONS } from "@/game/card-authoring";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import CardTip from "@/components/CardTip";
import CollectionsShowcase from "@/components/CollectionsShowcase";
import { REGION_STYLE } from "@/components/CardView";
import type { CardDef, Rarity, Region, CardType, Keyword } from "@/game/types";
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

const REGIONS: Array<Region | "All"> = ["All", ...CARD_REGIONS];
const RARITIES: Array<Rarity | "All"> = ["All", "Common", "Rare", "Epic", "Legend"];
const TYPES: Array<CardType | "All"> = ["All", "Unit", "Spell", "Enchantment", "Artifact", "Equipment", "Sentinela"];
const OWNERSHIP: Array<"All" | "Owned" | "Missing" | "Complete"> = ["All", "Owned", "Missing", "Complete"];
const COSTS = ["All", "0-2", "3-5", "6+"] as const;
const KEYWORDS: Array<Keyword | "All"> = ["All", "Barrier", "Challenger", "Elusive", "Fearsome", "Flying", "Haste", "Lifesteal", "Overwhelm", "QuickAttack", "Regeneration", "Tough"];
const SORTS = ["curve", "name", "rarity"] as const;

const RARITY_COLOR: Record<Rarity, string> = {
  Common: "text-slate-300",
  Rare: "text-blue-300",
  Epic: "text-purple-300",
  Legend: "text-amber-300",
};

const RARITY_BG: Record<Rarity, string> = {
  Common: "bg-slate-500/10 border-slate-500/40",
  Rare: "bg-blue-500/10 border-blue-500/40",
  Epic: "bg-purple-500/10 border-purple-500/40",
  Legend: "bg-amber-500/10 border-amber-500/40",
};

export default function CollectionClient() {
  const [playerName, setPlayerName] = useState("");
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [ownedCards, setOwnedCards] = useState(0);
  const [duplicateCap, setDuplicateCap] = useState(3);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Filters
  const [regionFilter, setRegionFilter] = useState<Region | "All">("All");
  const [rarityFilter, setRarityFilter] = useState<Rarity | "All">("All");
  const [typeFilter, setTypeFilter] = useState<CardType | "All">("All");
  const [ownFilter, setOwnFilter] = useState<"All" | "Owned" | "Missing" | "Complete">("All");
  const [search, setSearch] = useState("");
  const [costFilter, setCostFilter] = useState<(typeof COSTS)[number]>("All");
  const [keywordFilter, setKeywordFilter] = useState<Keyword | "All">("All");
  const [sortBy, setSortBy] = useState<(typeof SORTS)[number]>("curve");
  const [selectedCard, setSelectedCard] = useState<CollectionCard | null>(null);

  useDeferredEffect(() => {
    const saved = localStorage.getItem("runeforge_playername");
    if (saved) setPlayerName(saved);
  }, []);

  const loadCollection = useCallback(async (name: string) => {
    setLoading(true);
    try {
      const profile = await ensurePlayerSession(name);
      if (profile.player?.name) setPlayerName(String(profile.player.name));
      const res = await fetch(`/api/collection?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.ok) {
        setPlayer(data.player);
        setCards(data.collection);
        setTotalCards(data.totalCards);
        setOwnedCards(data.ownedCards);
        setDuplicateCap(Math.max(1, Math.trunc(Number(data.duplicateCap) || 3)));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    loadCollection(playerName);
  }, [playerName, loadCollection]);

  const saveName = () => {
    void ensurePlayerSession(playerName).then((profile) => { if (profile.player?.name) setPlayerName(String(profile.player.name)); });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards
      .filter((c) => c.collectible !== false)
      .filter((c) => regionFilter === "All" || c.region === regionFilter)
      .filter((c) => rarityFilter === "All" || c.rarity === rarityFilter)
      .filter((c) => typeFilter === "All" || c.type === typeFilter)
      .filter((c) => costFilter === "All" || costFilter === "0-2" ? costFilter === "All" || c.cost <= 2 : costFilter === "3-5" ? c.cost >= 3 && c.cost <= 5 : c.cost >= 6)
      .filter((c) => keywordFilter === "All" || (c.keywords ?? []).includes(keywordFilter))
      .filter((c) => {
        if (ownFilter === "Owned") return c.owned > 0;
        if (ownFilter === "Missing") return c.owned === 0;
        if (ownFilter === "Complete") return c.owned >= duplicateCap;
        return true;
      })
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.race?.toLowerCase().includes(q) || (c.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(q)))
      .sort((a, b) => {
        // Owned first, then by cost, then by name
        if (a.owned > 0 !== b.owned > 0) return b.owned - a.owned;
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "rarity") return ["Legend", "Epic", "Rare", "Common"].indexOf(a.rarity) - ["Legend", "Epic", "Rare", "Common"].indexOf(b.rarity) || a.cost - b.cost;
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
    for (const c of cards) {
      if (c.collectible === false) continue;
      byRarity[c.rarity].total += 1;
      if (c.owned > 0) byRarity[c.rarity].owned += 1;
    }
    return byRarity;
  }, [cards]);

  const doAction = async (action: "craft" | "disenchant", card: CollectionCard, amount = 1) => {
    if (!player) return;
    setLoading(true);
    setMessage("");
    try {
      const fingerprint = `${action}:${card.defId}:${amount}`;
      const operationId = pendingEconomyOperationId(fingerprint);
      const res = await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Operation-Id": operationId },
        body: JSON.stringify({ name: playerName, action, defId: card.defId, amount, operationId }),
      });
      settleEconomyOperation(fingerprint, res.status);
      const data = await res.json();
      if (!data.ok) {
        setMessage(data.error || "Action failed");
        return;
      }
      if (action === "craft") {
        setMessage(`✨ Crafted ${amount}x ${card.name} for ${data.dustSpent} dust!`);
      } else {
        setMessage(`💠 Disenchanted ${amount}x ${card.name} for ${data.dustGained} dust!`);
      }
      await loadCollection(playerName);
    } catch {
      setMessage("Não foi possível confirmar a operação. Tente novamente; o mesmo identificador será reutilizado com segurança.");
    } finally {
      setLoading(false);
    }
  };

  const completion = totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 0;

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#1e293b,#0f172a_55%,#020617)] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4">
            <Link href="/" className="text-sm text-slate-400 hover:text-white">
              ← Home
            </Link>
            <Link href="/play" className="text-sm text-slate-400 hover:text-white">
              Play
            </Link>
            <Link href="/forge" className="text-sm text-slate-400 hover:text-white">
              Forge
            </Link>
            <Link href="/profile" className="text-sm text-slate-400 hover:text-white">
              Profile
            </Link>
            <Link href="/community" className="text-sm text-slate-400 hover:text-white">
              Community
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="input max-w-[180px]"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onBlur={saveName}
              placeholder="Your name"
            />
          </div>
        </div>

        {/* Title + Stats */}
        <div className="mb-6 grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <h1 className="text-3xl font-black text-amber-300">📚 Coleção de Cartas</h1>
            <p className="mt-1 text-sm text-slate-400">
              Colete, forge e desencante cartas para completar sua coleção
            </p>
          </div>
          {player && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <Stat icon="⭐" label="Level" value={player.level} />
              <Stat icon="🪙" label="Gold" value={player.gold} color="text-amber-300" />
              <Stat icon="💠" label="Dust" value={player.dust} color="text-cyan-300" />
              <Stat icon="📊" label="Completo" value={`${completion}%`} color="text-emerald-300" />
            </div>
          )}
        </div>

        {/* Rarity Progress */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {(["Common", "Rare", "Epic", "Legend"] as Rarity[]).map((r) => {
            const s = stats[r];
            const pct = s.total > 0 ? (s.owned / s.total) * 100 : 0;
            return (
              <div key={r} className={`rounded-xl border p-3 ${RARITY_BG[r]}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold ${RARITY_COLOR[r]}`}>{r}</span>
                  <span className="text-xs text-slate-400">
                    {s.owned}/{s.total}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-slate-800">
                  <div
                    className={`h-full ${
                      r === "Legend" ? "bg-amber-400" : r === "Epic" ? "bg-purple-400" : r === "Rare" ? "bg-blue-400" : "bg-slate-400"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {message && (
          <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            {message}
            <button className="ml-3 text-xs underline" onClick={() => setMessage("")}>
              dismiss
            </button>
          </div>
        )}

        <CollectionsShowcase />

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
          <input
            className="input min-w-[200px] flex-1"
            placeholder="🔍 Buscar cartas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input max-w-[130px]" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value as Region | "All")}>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select className="input max-w-[110px]" value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value as Rarity | "All")}>
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select className="input max-w-[130px]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as CardType | "All")}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            className="input max-w-[120px]"
            value={ownFilter}
            onChange={(e) => setOwnFilter(e.target.value as "All" | "Owned" | "Missing" | "Complete")}
          >
            {OWNERSHIP.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <select className="input max-w-[100px]" value={costFilter} onChange={(e) => setCostFilter(e.target.value as (typeof COSTS)[number])} aria-label="Filtrar custo">
            {COSTS.map((cost) => <option key={cost} value={cost}>{cost === "All" ? "Custo" : cost}</option>)}
          </select>
          <select className="input max-w-[130px]" value={keywordFilter} onChange={(e) => setKeywordFilter(e.target.value as Keyword | "All")} aria-label="Filtrar palavra-chave">
            {KEYWORDS.map((keyword) => <option key={keyword} value={keyword}>{keyword === "All" ? "Keyword" : keyword}</option>)}
          </select>
          <select className="input max-w-[115px]" value={sortBy} onChange={(e) => setSortBy(e.target.value as (typeof SORTS)[number])} aria-label="Ordenar coleção">
            <option value="curve">Curva</option><option value="name">Nome</option><option value="rarity">Raridade</option>
          </select>
          <span className="text-xs text-slate-500">{filtered.length} cartas</span>
        </div>

        {/* Grid + Panel */}
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((card) => (
              <button
                key={card.defId}
                onClick={() => setSelectedCard(card)}
                className={`relative flex flex-col items-center gap-1 rounded-xl border p-2 transition-all hover:scale-105 hover:border-amber-400 ${
                  selectedCard?.defId === card.defId ? "border-amber-400 bg-amber-500/10" : "border-white/10 bg-white/[0.02]"
                } ${card.owned === 0 ? "opacity-40 grayscale" : ""}`}
              >
                <div className="pointer-events-none">
                  <CardTip defId={card.defId} size="sm" />
                </div>
                <div className="flex w-full items-center justify-between px-1 text-xs">
                  <span className={RARITY_COLOR[card.rarity]}>{card.rarity[0]}</span>
                  <span className="font-bold text-slate-300">
                    {card.owned}/{duplicateCap}
                  </span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500">
                {loading ? "Carregando…" : "Nenhuma carta encontrada"}
              </div>
            )}
          </div>

          {/* Detail panel */}
          <aside className="sticky top-4 self-start rounded-xl border border-white/10 bg-white/5 p-4">
            {selectedCard ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <CardTip defId={selectedCard.defId} size="lg" />
                </div>

                <div className="text-center">
                  <h3 className="font-black text-white">{selectedCard.name}</h3>
                  <p className={`text-xs font-bold ${RARITY_COLOR[selectedCard.rarity]}`}>
                    {selectedCard.rarity} · {selectedCard.region} · {selectedCard.type}
                  </p>
                </div>

                <div className="rounded-lg bg-black/40 p-3 text-center">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Você possui</p>
                  <p className={`text-3xl font-black ${selectedCard.owned > 0 ? "text-amber-300" : "text-slate-600"}`}>
                    {selectedCard.owned} / {duplicateCap}
                  </p>
                </div>

                {/* Craft */}
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                  <p className="text-xs font-bold text-cyan-300">💠 Forjar</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Custo: {selectedCard.craftCost} dust por cópia
                  </p>
                  <div className="mt-2 flex gap-1">
                    {quantityOptions(Math.max(0, duplicateCap - selectedCard.owned)).map((n) => (
                      <button
                        key={n}
                        disabled={!player || player.dust < selectedCard.craftCost * n || loading}
                        onClick={() => doAction("craft", selectedCard, n)}
                        className="flex-1 rounded bg-cyan-600 px-2 py-1 text-xs font-bold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        +{n} ({selectedCard.craftCost * n} 💠)
                      </button>
                    ))}
                    {selectedCard.owned >= duplicateCap && <span className="text-xs text-slate-500">Limite atingido</span>}
                  </div>
                </div>

                {/* Disenchant */}
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <p className="text-xs font-bold text-amber-300">🔥 Desencantar</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Ganho: {selectedCard.dustValue} dust por cópia
                  </p>
                  <div className="mt-2 flex gap-1">
                    {quantityOptions(selectedCard.owned).map((n) => (
                      <button
                        key={n}
                        disabled={loading}
                        onClick={() => doAction("disenchant", selectedCard, n)}
                        className="flex-1 rounded bg-amber-600 px-2 py-1 text-xs font-bold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        -{n} (+{selectedCard.dustValue * n} 💠)
                      </button>
                    ))}
                    {selectedCard.owned === 0 && <span className="text-xs text-slate-500">Sem cópias</span>}
                  </div>
                </div>

                <p className="text-[10px] text-slate-500">{selectedCard.description}</p>
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-slate-500">
                <div className="text-4xl">🎴</div>
                <p className="mt-2">Clique em uma carta para ver detalhes</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function quantityOptions(max: number): number[] {
  const cap = Math.max(0, Math.trunc(max));
  if (cap <= 0) return [];
  return Array.from(new Set([1, Math.min(2, cap), cap])).filter((value) => value > 0 && value <= cap);
}

function Stat({ icon, label, value, color }: { icon: string; label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">{icon}</span>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
        <p className={`text-sm font-black ${color || "text-white"}`}>{value}</p>
      </div>
    </div>
  );
}
