"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type CardSummary = { defId: string; name: string; rarity?: string; region?: string | string[]; emoji?: string };
type PublicCatalogCard = { defId: string; name: string; rarity?: string; region?: string; regions?: string[] };
type Asset = {
  id: number;
  defId: string;
  variantId: string;
  frameId: string;
  finish: string;
  tradable: boolean;
  locked?: boolean;
  lockKind?: string | null;
  card: CardSummary;
};
type Listing = {
  id: number;
  assetId: number;
  priceGold: number;
  feeGold: number;
  sellerPlayerId?: number;
  sellerName?: string;
  status?: string;
  expiresAt?: string;
  variantId: string;
  frameId: string;
  finish: string;
  card: CardSummary;
};
type TradeAsset = { assetId?: number; defId: string; variantId?: string; frameId?: string; finish?: string; card: CardSummary };
type Trade = {
  id: number;
  proposerName: string;
  recipientName: string;
  direction: "incoming" | "outgoing";
  effectiveStatus: string;
  offeredAssets: TradeAsset[];
  requestedAssets: TradeAsset[];
  note?: string;
  expiresAt: string;
};
type Tab = "market" | "inventory" | "mine" | "trades" | "history";

function operationId(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}

function collectibleLabel(item: { variantId?: string; frameId?: string; finish?: string }) {
  return [item.variantId && item.variantId !== "standard" ? item.variantId : null, item.frameId && item.frameId !== "default" ? item.frameId : null, item.finish && item.finish !== "normal" ? item.finish : null].filter(Boolean).join(" · ") || "Padrão";
}

function catalogCardLabel(card: PublicCatalogCard) {
  const region = card.region || card.regions?.join("/") || "Multirregional";
  return `${card.name}${card.rarity ? ` · ${card.rarity}` : ""}${region ? ` · ${region}` : ""}`;
}

export default function MarketClient() {
  const [tab, setTab] = useState<Tab>("market");
  const [listings, setListings] = useState<Listing[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeCatalog, setTradeCatalog] = useState<PublicCatalogCard[]>([]);
  const [gold, setGold] = useState(0);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [feeBps, setFeeBps] = useState(500);
  const [query, setQuery] = useState("");
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [recipient, setRecipient] = useState("");
  const [offeredAssetId, setOfferedAssetId] = useState("");
  const [requestedDefId, setRequestedDefId] = useState("");
  const [tradeNote, setTradeNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadMarket = useCallback(async (view: "listings" | "inventory" | "mine" | "history" = "listings") => {
    const suffix = view === "listings" && query ? `?q=${encodeURIComponent(query)}` : `?view=${view}`;
    const response = await fetch(`/api/market${suffix}`, { credentials: "include", cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Falha ao carregar o mercado");
    if (data.player) {
      setGold(Number(data.player.gold || 0));
      setPlayerId(Number(data.player.id || 0));
    }
    if (data.settings) setFeeBps(Number(data.settings.feeBps || 0));
    if (view === "inventory") setAssets(data.assets || []);
    else setListings(view === "history" ? data.history || [] : data.listings || []);
  }, [query]);

  const loadTrades = useCallback(async () => {
    const response = await fetch("/api/trades", { credentials: "include", cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Falha ao carregar trocas");
    setTrades(data.trades || []);
  }, []);

  const loadTradeCatalog = useCallback(async () => {
    const firstResponse = await fetch("/api/public/game/cards?page=1&pageSize=100&sort=name-asc", { cache: "no-store" });
    const first = await firstResponse.json();
    if (!firstResponse.ok || !first.ok) throw new Error(first.error || "Falha ao carregar catálogo de cartas");

    const totalPages = Math.max(1, Number(first.totalPages || 1));
    const pages = totalPages > 1
      ? await Promise.all(Array.from({ length: totalPages - 1 }, async (_, index) => {
          const response = await fetch(`/api/public/game/cards?page=${index + 2}&pageSize=100&sort=name-asc`, { cache: "no-store" });
          const data = await response.json();
          if (!response.ok || !data.ok) throw new Error(data.error || "Falha ao carregar catálogo de cartas");
          return data.items || [];
        }))
      : [];

    const allCards = [first.items || [], ...pages].flat() as PublicCatalogCard[];
    const unique = new Map(allCards.map((card) => [card.defId, card]));
    setTradeCatalog([...unique.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR") || a.defId.localeCompare(b.defId)));
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      if (tab === "trades") {
        await Promise.all([loadTrades(), loadMarket("inventory"), loadTradeCatalog()]);
      } else if (tab === "inventory") await loadMarket("inventory");
      else if (tab === "mine") await loadMarket("mine");
      else if (tab === "history") await loadMarket("history");
      else await loadMarket("listings");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao sincronizar mercado");
    } finally {
      setBusy(false);
    }
  }, [loadMarket, loadTradeCatalog, loadTrades, tab]);

  useEffect(() => { void refresh(); }, [refresh]);

  const post = useCallback(async (path: "/api/market" | "/api/trades", body: Record<string, unknown>, prefix: string) => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-operation-id": operationId(prefix) },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Operação recusada");
      setMessage("Operação concluída.");
      await Promise.all([loadMarket("inventory"), loadMarket(tab === "mine" ? "mine" : "listings"), loadTrades()]);
      return data;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operação falhou");
      return null;
    } finally {
      setBusy(false);
    }
  }, [loadMarket, loadTrades, tab]);

  const availableAssets = useMemo(() => assets.filter((asset) => asset.tradable && !asset.locked), [assets]);
  const activeListings = useMemo(() => listings.filter((listing) => !listing.status || listing.status === "active"), [listings]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <section className="rf-panel overflow-hidden">
        <div className="p-6 sm:p-8">
          <p className="rf-eyebrow"><span /> BOLSA DOS FORJADORES</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Mercado & Trocas</h1>
              <p className="mt-2 max-w-3xl opacity-75">Compre e venda cartas por Gold ou negocie carta por carta. Toda negociação usa escrow autoritativo e deixa rastros de auditoria.</p>
            </div>
            <div className="text-right">
              <small className="block opacity-60">SALDO</small>
              <b className="text-2xl">¤ {gold.toLocaleString("pt-BR")}</b>
              <small className="mt-1 block opacity-60">Taxa de venda atual: {(feeBps / 100).toFixed(2)}%</small>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {([
              ["market", "Mercado"], ["inventory", "Meu acervo"], ["mine", "Meus anúncios"], ["trades", "Trocas diretas"], ["history", "Histórico"],
            ] as Array<[Tab, string]>).map(([id, label]) => (
              <button key={id} className={tab === id ? "rf-button rf-button-primary" : "rf-button rf-button-secondary"} onClick={() => setTab(id)}>{label}</button>
            ))}
            <Link href="/collection" className="rf-button rf-button-secondary">Coleção</Link>
          </div>
          {message && <div className="mt-4 rounded-lg border border-white/10 p-3 text-sm">{message}</div>}
        </div>
      </section>

      {tab === "market" && (
        <section className="mt-6">
          <div className="mb-4 flex gap-2">
            <input className="rf-input min-w-0 flex-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar carta, vendedor, frame ou acabamento…" />
            <button className="rf-button rf-button-primary" disabled={busy} onClick={() => void loadMarket("listings")}>Buscar</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activeListings.map((listing) => (
              <article key={listing.id} className="rf-panel p-5">
                <div className="flex items-start justify-between gap-4">
                  <div><small className="opacity-60">{listing.card.rarity || "Carta"}</small><h2 className="text-xl font-bold">{listing.card.emoji || "◆"} {listing.card.name}</h2><small className="opacity-60">{collectibleLabel(listing)}</small></div>
                  <b className="text-xl">¤ {listing.priceGold}</b>
                </div>
                <p className="mt-3 text-sm opacity-70">Vendedor: {listing.sellerName || "Forjador"}</p>
                <button className="rf-button rf-button-primary mt-4 w-full" disabled={busy || listing.sellerPlayerId === playerId} onClick={() => void post("/api/market", { action: "buy", listingId: listing.id }, "market-buy")}>{listing.sellerPlayerId === playerId ? "Seu anúncio" : "Comprar"}</button>
              </article>
            ))}
            {!busy && activeListings.length === 0 && <div className="rf-panel p-8 opacity-70">Nenhum anúncio disponível.</div>}
          </div>
        </section>
      )}

      {tab === "inventory" && (
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => (
            <article key={asset.id} className="rf-panel p-5">
              <small className="opacity-60">Cópia #{asset.id} · {collectibleLabel(asset)}</small>
              <h2 className="mt-1 text-lg font-bold">{asset.card.emoji || "◆"} {asset.card.name}</h2>
              {asset.locked ? <p className="mt-3 text-sm">Em escrow: {asset.lockKind === "trade" ? "troca" : "anúncio"}</p> : (
                <div className="mt-4 flex gap-2">
                  <input className="rf-input min-w-0 flex-1" type="number" min={1} value={prices[asset.id] || ""} onChange={(event) => setPrices((old) => ({ ...old, [asset.id]: event.target.value }))} placeholder="Preço em Gold" />
                  <button className="rf-button rf-button-primary" disabled={busy || !asset.tradable} onClick={() => void post("/api/market", { action: "list", assetId: asset.id, priceGold: Number(prices[asset.id]) }, "market-list")}>Anunciar</button>
                </div>
              )}
            </article>
          ))}
          {!busy && assets.length === 0 && <div className="rf-panel p-8 opacity-70">Sua coleção ainda não possui cópias negociáveis.</div>}
        </section>
      )}

      {tab === "mine" && (
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => (
            <article key={listing.id} className="rf-panel p-5">
              <div className="flex justify-between gap-3"><h2 className="font-bold">{listing.card.name}</h2><b>¤ {listing.priceGold}</b></div>
              <p className="mt-2 text-sm opacity-70">Status: {listing.status}</p>
              {listing.status === "active" && <button className="rf-button rf-button-secondary mt-4" disabled={busy} onClick={() => void post("/api/market", { action: "cancel", listingId: listing.id }, "market-cancel")}>Cancelar anúncio</button>}
            </article>
          ))}
        </section>
      )}

      {tab === "trades" && (
        <section className="mt-6 space-y-6">
          <div className="rf-panel p-6">
            <h2 className="text-xl font-bold">Propor troca direta</h2>
            <p className="mt-1 text-sm opacity-70">A sua cópia ficará em escrow até a outra pessoa aceitar, recusar, expirar ou você cancelar.</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-4">
              <input className="rf-input" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Nome exato do jogador" />
              <select className="rf-input" value={offeredAssetId} onChange={(event) => setOfferedAssetId(event.target.value)}>
                <option value="">Carta que você oferece</option>
                {availableAssets.map((asset) => <option key={asset.id} value={asset.id}>#{asset.id} — {asset.card.name} ({collectibleLabel(asset)})</option>)}
              </select>
              <select className="rf-input" value={requestedDefId} onChange={(event) => setRequestedDefId(event.target.value)} aria-label="Carta que você deseja receber">
                <option value="">Carta que você deseja receber</option>
                {tradeCatalog.map((card) => <option key={card.defId} value={card.defId}>{catalogCardLabel(card)}</option>)}
              </select>
              <button className="rf-button rf-button-primary" disabled={busy || !recipient || !offeredAssetId || !requestedDefId} onClick={() => void post("/api/trades", { action: "create", recipientName: recipient, offeredAssetIds: [Number(offeredAssetId)], requestedAssets: [{ defId: requestedDefId }], note: tradeNote }, "trade-create")}>Propor troca</button>
            </div>
            <input className="rf-input mt-3 w-full" value={tradeNote} onChange={(event) => setTradeNote(event.target.value)} maxLength={240} placeholder="Mensagem opcional" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {trades.map((trade) => (
              <article key={trade.id} className="rf-panel p-5">
                <div className="flex items-start justify-between gap-4"><div><small className="opacity-60">Troca #{trade.id}</small><h3 className="font-bold">{trade.proposerName} → {trade.recipientName}</h3></div><b>{trade.effectiveStatus}</b></div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div><small className="opacity-60">OFERECE</small>{trade.offeredAssets.map((asset, index) => <p key={`${asset.assetId || index}`}>{asset.card.name}</p>)}</div>
                  <div><small className="opacity-60">PEDE</small>{trade.requestedAssets.map((asset, index) => <p key={`${asset.defId}:${index}`}>{asset.card.name}</p>)}</div>
                </div>
                {trade.note && <p className="mt-3 text-sm opacity-70">“{trade.note}”</p>}
                {trade.effectiveStatus === "active" && trade.direction === "incoming" && <div className="mt-4 flex gap-2"><button className="rf-button rf-button-primary" disabled={busy} onClick={() => void post("/api/trades", { action: "accept", tradeId: trade.id }, "trade-accept")}>Aceitar</button><button className="rf-button rf-button-secondary" disabled={busy} onClick={() => void post("/api/trades", { action: "decline", tradeId: trade.id }, "trade-decline")}>Recusar</button></div>}
                {trade.effectiveStatus === "active" && trade.direction === "outgoing" && <button className="rf-button rf-button-secondary mt-4" disabled={busy} onClick={() => void post("/api/trades", { action: "cancel", tradeId: trade.id }, "trade-cancel")}>Cancelar</button>}
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "history" && (
        <section className="mt-6 overflow-hidden rf-panel">
          <div className="divide-y divide-white/10">
            {listings.map((listing) => <div key={listing.id} className="flex flex-wrap items-center justify-between gap-4 p-4"><span><b>{listing.card.name}</b><small className="ml-2 opacity-60">{collectibleLabel(listing)}</small></span><b>¤ {listing.priceGold}</b></div>)}
            {!busy && listings.length === 0 && <div className="p-8 opacity-70">Ainda não há vendas concluídas.</div>}
          </div>
        </section>
      )}
    </main>
  );
}
