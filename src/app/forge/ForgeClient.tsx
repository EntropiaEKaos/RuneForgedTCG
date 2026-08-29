"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import CardTip from "@/components/CardTip";
import { useCatalogRevision } from "@/components/CatalogContext";
import { REGION_STYLE } from "@/components/CardView";
import SiteNav from "@/components/SiteNav";
import { CARD_REGIONS } from "@/game/card-authoring";
import { collectibleCards, getCard } from "@/game/cards";
import { analyzeDeck, type DeckInsight } from "@/game/deck-insights";
import { validateDeck } from "@/game/decks";
import type { FormatDef } from "@/game/format-definitions";
import { cardLegalInFormat } from "@/game/format-rules";
import { cardRegions, identityForRegions } from "@/game/region-identity";
import { getRuntimeDeckRules } from "@/game/runtime-config";
import { analyzeDeckSynergy, recommendSynergies } from "@/game/synergy-graph";
import type { Region } from "@/game/types";
import { ensurePlayerSession } from "@/lib/client-player-session";

interface SavedDeck {
  id: number;
  ownerName?: string;
  name: string;
  emoji: string;
  cards: string[];
  formatId?: string;
}

type DeckApiPayload = {
  ok?: boolean;
  decks?: unknown[];
  deck?: unknown;
  code?: string;
  errors?: string[];
  error?: string;
};

type FormatsPayload = {
  ok?: boolean;
  formats?: unknown[];
};

const REGIONS: Array<Region | "All"> = ["All", ...CARD_REGIONS];
const FALLBACK_FORMAT: FormatDef = {
  id: "vanilla",
  name: "Vanilla",
  description: "Somente a coleção inaugural Vanilla.",
  collectionKeys: ["vanilla"],
  active: true,
  rankedEligible: false,
};

function isSavedDeck(value: unknown): value is SavedDeck {
  if (!value || typeof value !== "object") return false;
  const deck = value as Partial<SavedDeck>;
  return typeof deck.id === "number"
    && typeof deck.name === "string"
    && typeof deck.emoji === "string"
    && Array.isArray(deck.cards)
    && deck.cards.every((card) => typeof card === "string");
}

function isFormatDef(value: unknown): value is FormatDef {
  if (!value || typeof value !== "object") return false;
  const format = value as Partial<FormatDef>;
  return typeof format.id === "string"
    && typeof format.name === "string"
    && typeof format.description === "string"
    && Array.isArray(format.collectionKeys)
    && typeof format.active === "boolean"
    && typeof format.rankedEligible === "boolean";
}

function firstError(payload: DeckApiPayload, fallback: string): string {
  return payload.errors?.[0] || payload.error || fallback;
}

export default function ForgeClient() {
  const catalogRevision = useCatalogRevision();
  const [playerName, setPlayerName] = useState("");
  const [saved, setSaved] = useState<SavedDeck[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("Novo Deck");
  const [emoji, setEmoji] = useState("🎴");
  const [list, setList] = useState<string[]>([]);
  const [filter, setFilter] = useState<Region | "All">("All");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [formatId, setFormatId] = useState("vanilla");
  const [formats, setFormats] = useState<FormatDef[]>([FALLBACK_FORMAT]);
  const [focusCard, setFocusCard] = useState<string | null>(null);
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  void catalogRevision;
  const deckRules = getRuntimeDeckRules();
  const deckMin = deckRules.deckMin;
  const deckMax = deckRules.deckMax;
  const maxCopies = deckRules.maxCopies;

  const loadDecks = useCallback(async (silent = false): Promise<boolean> => {
    if (!silent) setLoadingDecks(true);
    try {
      const response = await fetch("/api/decks", { cache: "no-store" });
      const payload = await response.json() as DeckApiPayload;
      if (!payload.ok) {
        if (!silent) setMessage(`❌ ${firstError(payload, "Não foi possível carregar seus decks.")}`);
        return false;
      }
      setSaved(Array.isArray(payload.decks) ? payload.decks.filter(isSavedDeck) : []);
      return true;
    } catch {
      if (!silent) setMessage("❌ Não foi possível sincronizar seus decks.");
      return false;
    } finally {
      if (!silent) setLoadingDecks(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void ensurePlayerSession(localStorage.getItem("runeforge_playername") || "")
      .then(async (profile) => {
        if (cancelled) return;
        if (profile.player?.name) setPlayerName(String(profile.player.name));
        await loadDecks();
      })
      .catch(() => {
        if (!cancelled) {
          setLoadingDecks(false);
          setMessage("❌ Não foi possível carregar seu perfil de jogador.");
        }
      });
    return () => { cancelled = true; };
  }, [loadDecks]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/formats", { cache: "no-store" })
      .then((response) => response.json() as Promise<FormatsPayload>)
      .then((payload) => {
        if (cancelled || !payload.ok || !Array.isArray(payload.formats)) return;
        const activeFormats = payload.formats.filter(isFormatDef).filter((format) => format.active !== false);
        if (!activeFormats.length) return;
        setFormats(activeFormats);
        setFormatId((current) => activeFormats.some((format) => format.id === current) ? current : activeFormats[0].id);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const id of list) result.set(id, (result.get(id) ?? 0) + 1);
    return result;
  }, [list]);

  const check = useMemo(() => { void catalogRevision; return validateDeck(list); }, [list, catalogRevision]);
  const insight = useMemo(() => { void catalogRevision; return analyzeDeck(list); }, [list, catalogRevision]);
  const synergy = useMemo(() => { void catalogRevision; return analyzeDeckSynergy(list); }, [list, catalogRevision]);
  const suggestions = useMemo(() => {
    void catalogRevision;
    return focusCard ? recommendSynergies(focusCard, 6).filter((item) => !counts.has(item.defId)) : [];
  }, [focusCard, counts, catalogRevision]);

  const selectedFormat = formats.find((format) => format.id === formatId) ?? formats[0] ?? FALLBACK_FORMAT;
  const identity = check.regions.length > 0 ? identityForRegions(check.regions) : null;
  const uniqueCards = counts.size;
  const progress = deckMax > 0 ? Math.min(100, Math.round((list.length / deckMax) * 100)) : 0;

  const pool = useMemo(() => {
    void catalogRevision;
    const normalizedQuery = query.trim().toLowerCase();
    return collectibleCards()
      .filter((card) => cardLegalInFormat(card.defId, selectedFormat))
      .filter((card) => filter === "All" || cardRegions(card).includes(filter))
      .filter((card) => !normalizedQuery
        || card.name.toLowerCase().includes(normalizedQuery)
        || card.description.toLowerCase().includes(normalizedQuery)
        || (card.race ?? "").toLowerCase().includes(normalizedQuery)
        || (card.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(normalizedQuery)))
      .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  }, [filter, query, catalogRevision, selectedFormat]);

  const addCard = (defId: string) => {
    const amount = counts.get(defId) ?? 0;
    if (amount >= maxCopies || list.length >= deckMax) return;
    setList((current) => [...current, defId]);
  };

  const removeCard = (defId: string) => {
    setList((current) => {
      const index = current.lastIndexOf(defId);
      if (index < 0) return current;
      return [...current.slice(0, index), ...current.slice(index + 1)];
    });
  };

  const resetNew = () => {
    setEditingId(null);
    setName("Novo Deck");
    setEmoji("🎴");
    setList([]);
    setMessage("");
    setFormatId(formats.some((format) => format.id === "vanilla") ? "vanilla" : (formats[0]?.id ?? "vanilla"));
    setFocusCard(null);
  };

  const loadDeck = (deck: SavedDeck) => {
    setEditingId(deck.id);
    setName(deck.name);
    setEmoji(deck.emoji);
    setList(deck.cards);
    setFormatId(deck.formatId && formats.some((format) => format.id === deck.formatId) ? deck.formatId : (formats[0]?.id ?? "vanilla"));
    setMessage(`✏️ Editando ${deck.name}.`);
    setFocusCard(null);
  };

  const save = async () => {
    if (!check.ok || saving || sharing || deletingId !== null) {
      if (!check.ok) setMessage(`❌ ${check.errors[0] ?? "Deck inválido."}`);
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(editingId ? `/api/decks/${editingId}` : "/api/decks", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, emoji, formatId, cards: list }),
      });
      const payload = await response.json() as DeckApiPayload;
      if (!payload.ok || !isSavedDeck(payload.deck)) {
        setMessage(`❌ ${firstError(payload, "Não foi possível salvar o deck.")}`);
        return;
      }
      setEditingId(payload.deck.id);
      setName(payload.deck.name);
      setEmoji(payload.deck.emoji);
      setFormatId(payload.deck.formatId || formatId);
      await loadDecks(true);
      setMessage("✅ Deck salvo e pronto para jogar.");
    } catch {
      setMessage("❌ Não foi possível confirmar o salvamento do deck.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (saving || sharing || deletingId !== null) return;
    setDeletingId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/decks/${id}`, { method: "DELETE" });
      const payload = await response.json() as DeckApiPayload;
      if (!payload.ok) {
        setMessage(`❌ ${firstError(payload, "Não foi possível excluir o deck.")}`);
        return;
      }
      if (editingId === id) resetNew();
      await loadDecks(true);
      setMessage("✅ Deck removido.");
    } catch {
      setMessage("❌ Não foi possível confirmar a exclusão do deck.");
    } finally {
      setDeletingId(null);
    }
  };

  const shareToCommunity = async () => {
    if (!check.ok || sharing || saving || deletingId !== null) {
      if (!check.ok) setMessage(`❌ ${check.errors[0] ?? "Deck inválido."}`);
      return;
    }
    setSharing(true);
    setMessage("");
    try {
      const response = await fetch("/api/decks/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: playerName ? `Deck de ${playerName}` : "Deck RuneForge",
          cards: list,
          archetype: insight.archetype || "Custom",
          formatId,
        }),
      });
      const payload = await response.json() as DeckApiPayload;
      if (!payload.ok || !payload.code) {
        setMessage(`❌ ${firstError(payload, "Não foi possível compartilhar o deck.")}`);
        return;
      }
      await navigator.clipboard.writeText(payload.code).catch(() => {});
      setMessage(`🌐 Deck publicado na comunidade. Código copiado: ${payload.code.slice(0, 20)}…`);
    } catch {
      setMessage("❌ Não foi possível confirmar o compartilhamento do deck.");
    } finally {
      setSharing(false);
    }
  };

  const copyCode = async () => {
    if (!check.ok) {
      setMessage("❌ O deck precisa ser válido antes de gerar um código.");
      return;
    }
    try {
      const { encodeDeck } = await import("@/lib/deck-codec");
      const code = encodeDeck(name, list);
      await navigator.clipboard.writeText(code);
      setMessage(`📋 Código copiado: ${code.slice(0, 25)}…`);
    } catch {
      setMessage("❌ Não foi possível copiar o código do deck.");
    }
  };

  return (
    <main className="rf-app-page">
      <SiteNav />
      <div className="rf-app-shell">
        <header className="rf-app-heading">
          <div>
            <p className="rf-eyebrow"><span /> ARSENAL DO NEXUS</p>
            <h1>Forja de Decks</h1>
            <p>Construa seu deck, descubra combinações e salve listas prontas para jogar dentro das regras de cada formato.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/collection" className="rf-button rf-button-secondary">COLEÇÃO</Link>
            <Link href="/community" className="rf-button rf-button-secondary">COMUNIDADE</Link>
            <Link href="/play" className="rf-button rf-button-primary">JOGAR</Link>
          </div>
        </header>

        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Resumo da Forja">
          <SummaryCard label="Deck" value={`${list.length}/${deckMax}`} detail={`${deckMin}–${deckMax} cartas permitidas`} />
          <SummaryCard label="Cartas únicas" value={uniqueCards} detail={`máximo ${maxCopies} cópias por carta`} />
          <SummaryCard label="Identidade" value={identity?.name ?? "Em aberto"} detail={check.regions.length ? check.regions.join(" · ") : `até ${deckRules.maxRegions} regiões`} />
          <SummaryCard label="Formato" value={selectedFormat.name} detail="regras do formato ativas" />
          <SummaryCard label="Invocador" value={playerName || "Sincronizando"} detail={`${saved.length} deck(s) salvo(s)`} />
        </section>

        <section className="mb-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4" aria-labelledby="forge-editor-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Configuração</p>
              <h2 id="forge-editor-heading" className="mt-1 text-xl font-black text-white">{editingId ? "Editar deck salvo" : "Novo projeto"}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">Escolha um nome, um emblema e o formato em que este deck será usado.</p>
            </div>
            <button type="button" onClick={resetNew} className="rf-button rf-button-secondary">+ NOVO DECK</button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_minmax(220px,.8fr)]">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Nome do deck
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} className="input mt-1 w-full normal-case tracking-normal text-slate-100" />
            </label>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Emblema
              <input value={emoji} onChange={(event) => setEmoji(event.target.value)} maxLength={8} className="input mt-1 w-full text-center text-lg normal-case tracking-normal" />
            </label>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Formato
              <select className="input mt-1 w-full normal-case tracking-normal" value={formatId} onChange={(event) => { setFormatId(event.target.value); setMessage(""); }}>
                {formats.map((format) => <option key={format.id} value={format.id}>{format.name}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(240px,.8fr)]">
            <div>
              <div className="mb-1 flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-500"><span>Construção</span><span>{progress}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Preenchimento do deck" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <div className="h-full bg-amber-400 transition-[width]" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Formato selecionado</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">{selectedFormat.description}</p>
            </div>
          </div>
        </section>

        {identity && (
          <section className="mb-5 rounded-2xl border border-cyan-300/20 bg-cyan-400/[.06] px-4 py-3" aria-label="Identidade regional do deck">
            <div className="flex items-center gap-3">
              <b className="text-2xl">{identity.sigils}</b>
              <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-300">Identidade do deck</p><strong className="block text-sm text-white">{identity.name}</strong><span className="text-[10px] text-slate-400">{check.regions.join(" · ")}</span></div>
            </div>
          </section>
        )}

        {message && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100" role="status" aria-live="polite">
            <span>{message}</span>
            <button type="button" className="text-xs font-black uppercase tracking-wider text-amber-200 hover:text-white" onClick={() => setMessage("")}>Fechar</button>
          </div>
        )}

        <section className="mb-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4" aria-labelledby="saved-decks-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-[.2em] text-slate-500">Biblioteca privada</p><h2 id="saved-decks-heading" className="mt-1 text-lg font-black text-white">Meus decks</h2></div>
            {loadingDecks && <span className="text-xs text-slate-500">Sincronizando…</span>}
          </div>
          {!loadingDecks && saved.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-slate-500">Nenhum deck salvo ainda. Construa sua primeira lista abaixo.</p>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {saved.map((deck) => (
                <article key={deck.id} className={`rounded-xl border p-3 ${editingId === deck.id ? "border-amber-400/50 bg-amber-400/10" : "border-white/10 bg-white/[.025]"}`}>
                  <button type="button" onClick={() => loadDeck(deck)} className="w-full text-left" aria-pressed={editingId === deck.id}>
                    <div className="flex items-center gap-2"><span className="text-xl">{deck.emoji}</span><div className="min-w-0"><p className="truncate text-sm font-black text-white">{deck.name}</p><p className="text-[10px] uppercase tracking-wider text-slate-500">{deck.cards.length} cartas · {deck.formatId || "padrão"}</p></div></div>
                  </button>
                  <button type="button" disabled={deletingId !== null || saving || sharing} onClick={() => void remove(deck.id)} className="mt-3 w-full rounded-lg border border-red-400/15 bg-red-400/5 px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-red-200 hover:bg-red-400/10 disabled:opacity-35">{deletingId === deck.id ? "Excluindo…" : "Excluir"}</button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mb-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4" aria-labelledby="forge-catalog-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-[.2em] text-slate-500">Catálogo do formato</p><h2 id="forge-catalog-heading" className="mt-1 text-lg font-black text-white">Escolha as cartas</h2></div>
            <span className="text-xs text-slate-500">{pool.length} carta(s) disponível(is)</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {REGIONS.map((region) => <button type="button" key={region} onClick={() => setFilter(region)} className={`rounded-full border px-3 py-1 text-xs font-black ${filter === region ? "border-amber-300/40 bg-amber-300/15 text-amber-100" : "border-white/10 bg-white/[.025] text-slate-400 hover:text-white"}`}>{region === "All" ? "Todas regiões" : region}</button>)}
            <label className="ml-auto min-w-[220px] flex-1 md:max-w-sm"><span className="sr-only">Buscar cartas</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar carta, raça ou habilidade…" className="input w-full" /></label>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <section aria-label="Catálogo de cartas para o deck">
            {pool.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-6 py-12 text-center"><div className="text-4xl">◇</div><h3 className="mt-3 font-black text-white">Nenhuma carta disponível</h3><p className="mt-2 text-sm text-slate-400">Ajuste região, busca ou formato para ampliar o catálogo.</p></div>
            ) : (
              <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
                {pool.map((card) => {
                  const amount = counts.get(card.defId) ?? 0;
                  const disabled = amount >= maxCopies || list.length >= deckMax;
                  return <CardTip key={card.defId} defId={card.defId} size="md" count={amount || undefined} dimmed={disabled} onClick={() => { addCard(card.defId); setFocusCard(card.defId); }} />;
                })}
              </div>
            )}
          </section>

          <aside className="self-start rounded-2xl border border-white/10 bg-slate-950/60 p-4 lg:sticky lg:top-4" aria-label="Deck em construção">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Deck atual</p><h3 className="mt-1 truncate text-lg font-black text-amber-100">{emoji} {name}</h3><p className="mt-1 text-[10px] text-slate-400">{check.regions.join(" · ") || "Identidade ainda em aberto"}</p></div>
              <span className={`rounded-full border px-2 py-1 text-xs font-black ${check.ok ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-red-400/25 bg-red-400/10 text-red-200"}`}>{list.length}/{deckMax}</span>
            </div>

            <DeckInsightPanel insight={insight} />

            <ul className="mt-3 max-h-[360px] space-y-1 overflow-y-auto pr-1 text-xs">
              {[...counts.entries()].sort((a, b) => getCard(a[0]).cost - getCard(b[0]).cost || getCard(a[0]).name.localeCompare(getCard(b[0]).name)).map(([id, amount]) => {
                const card = getCard(id);
                const style = REGION_STYLE[card.region];
                return (
                  <li key={id}>
                    <button type="button" onClick={() => removeCard(id)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left hover:border-white/10 hover:bg-white/[.035]" aria-label={`Remover uma cópia de ${card.name}`}>
                      <span className="min-w-0 truncate"><span className="mr-2 inline-block w-4 text-center font-black text-sky-300">{card.cost}</span>{card.emoji} {card.name}</span><span className={`shrink-0 font-black ${style.text}`}>×{amount}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {list.length === 0 && <p className="py-8 text-center text-xs text-slate-500">Adicione cartas do catálogo para começar.</p>}

            {!check.ok && <ul className="mt-3 space-y-1 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-[11px] text-red-200">{check.errors.map((error) => <li key={error}>• {error}</li>)}</ul>}

            <section className="mt-4 rounded-xl border border-violet-400/20 bg-violet-400/[.05] p-3">
              <div className="flex items-center justify-between"><div><small className="font-black tracking-[.15em] text-violet-300">SINERGIA DO DECK</small><b className="block text-sm text-white">{synergy.score}/100 · {synergy.links.length} conexões</b></div><span className="text-2xl">🕸️</span></div>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">Selecione uma carta no catálogo para receber sugestões sem alterar o deck automaticamente.</p>
              {focusCard && suggestions.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{suggestions.map((item) => <button type="button" key={item.defId} onClick={() => { addCard(item.defId); setFocusCard(item.defId); }} className="rounded border border-white/10 px-2 py-1 text-[10px] hover:bg-white/10">+ {getCard(item.defId).name} · {item.score}</button>)}</div>}
            </section>

            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => void save()} className="rf-button rf-button-primary w-full" disabled={!check.ok || saving || sharing || deletingId !== null}>{saving ? "SALVANDO…" : editingId ? "SALVAR ALTERAÇÕES" : "SALVAR DECK"}</button>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void shareToCommunity()} className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-2 text-xs font-black text-fuchsia-100 hover:bg-fuchsia-400/15 disabled:opacity-35" disabled={!check.ok || sharing || saving || deletingId !== null}>{sharing ? "Publicando…" : "🌐 Publicar"}</button>
                <button type="button" onClick={() => void copyCode()} className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-400/15 disabled:opacity-35" disabled={!check.ok}>📋 Código</button>
              </div>
              <Link href="/play" className="rf-button rf-button-secondary w-full text-center">JOGAR COM ESTE DECK</Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="rounded-xl border border-white/10 bg-slate-950/45 p-4"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">{label}</p><p className="mt-1 truncate text-2xl font-black text-white" title={String(value)}>{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div>;
}

function DeckInsightPanel({ insight }: { insight: DeckInsight }) {
  return (
    <section className="forge-insight" aria-label="Diagnóstico estratégico do deck">
      <header><strong>{insight.grade}</strong><div><small>DIAGNÓSTICO · {insight.score}/100</small><b>{insight.title}</b><span>{insight.archetype}</span></div></header>
      <div className="forge-role-grid"><span><b>{insight.roleCounts.early}</b>Início</span><span><b>{insight.roleCounts.interaction}</b>Interação</span><span><b>{insight.roleCounts.defense}</b>Defesa</span><span><b>{insight.roleCounts.finishers}</b>Fim</span></div>
      {insight.strengths.length > 0 && <ul className="forge-strengths">{insight.strengths.map((item) => <li key={item}>✓ {item}</li>)}</ul>}
      {insight.warnings.length > 0 && <ul className="forge-warnings">{insight.warnings.map((item) => <li key={item}>! {item}</li>)}</ul>}
      {insight.recommendations[0] && <p><small>PRÓXIMA MELHORIA</small>{insight.recommendations[0]}</p>}
    </section>
  );
}
