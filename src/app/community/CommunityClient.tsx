"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import { REGION_STYLE } from "@/components/CardView";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { CARD_REGIONS } from "@/game/card-authoring";
import { getCard } from "@/game/cards";
import type { Region } from "@/game/types";
import { ensurePlayerSession } from "@/lib/client-player-session";
import { decodeDeck, encodeDeck, isValidDeckCode } from "@/lib/deck-codec";

interface SharedDeck {
  id: number;
  playerId: number;
  name: string;
  description: string;
  region1: string;
  region2: string | null;
  region3: string | null;
  cards: string;
  archetype: string;
  upvotes: number;
  downloads: number;
  createdAt: string;
}

const REGIONS: Array<Region | "All"> = ["All", ...CARD_REGIONS];
const ARCHETYPES = ["All", "Aggro", "Control", "Midrange", "Combo", "Tempo", "Custom"];

function parseDeckCards(raw: string): string[] | null {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === "string") ? parsed : null;
  } catch {
    return null;
  }
}

export default function CommunityClient() {
  const [decks, setDecks] = useState<SharedDeck[]>([]);
  const [loading, setLoading] = useState(false);
  const [regionFilter, setRegionFilter] = useState<Region | "All">("All");
  const [archetypeFilter, setArchetypeFilter] = useState("All");
  const [selectedDeck, setSelectedDeck] = useState<SharedDeck | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [message, setMessage] = useState("");
  const [busyDeckId, setBusyDeckId] = useState<number | null>(null);
  const [savingImport, setSavingImport] = useState(false);

  const [importCode, setImportCode] = useState("");
  const [importedDeck, setImportedDeck] = useState<{ name: string; cards: string[] } | null>(null);

  useDeferredEffect(() => {
    void ensurePlayerSession(localStorage.getItem("runeforge_playername") || "").then((profile) => {
      if (profile.player?.name) setPlayerName(String(profile.player.name));
    });
  }, []);

  const loadDecks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (regionFilter !== "All") params.set("region", regionFilter);
      if (archetypeFilter !== "All") params.set("archetype", archetypeFilter);
      const res = await fetch(`/api/decks/share?${params}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.decks)) {
        setDecks(data.decks);
        setSelectedDeck((current) => current && data.decks.some((deck: SharedDeck) => deck.id === current.id) ? current : null);
      }
    } finally {
      setLoading(false);
    }
  }, [regionFilter, archetypeFilter]);

  useDeferredEffect(() => {
    void loadDecks();
  }, [loadDecks]);

  const upvote = async (deck: SharedDeck) => {
    setBusyDeckId(deck.id);
    try {
      await fetch(`/api/decks/share/${deck.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upvote" }),
      });
      await loadDecks();
    } finally {
      setBusyDeckId(null);
    }
  };

  const download = async (deck: SharedDeck) => {
    if (!playerName) {
      setMessage("❌ Sua identidade ainda está sendo sincronizada. Tente novamente em instantes.");
      return;
    }
    const cards = parseDeckCards(deck.cards);
    if (!cards) {
      setMessage("❌ Este deck compartilhado contém dados inválidos.");
      return;
    }
    setBusyDeckId(deck.id);
    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: playerName,
          name: `${deck.name} (cópia)`,
          emoji: "📥",
          cards,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        await fetch(`/api/decks/share/${deck.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "download" }),
        });
        setMessage(`✅ Deck "${deck.name}" salvo em seus decks!`);
      } else {
        setMessage(`❌ ${data.error || "Erro ao baixar deck"}`);
      }
      await loadDecks();
    } finally {
      setBusyDeckId(null);
    }
  };

  const copyCode = async (deck: SharedDeck) => {
    const cards = parseDeckCards(deck.cards);
    if (!cards) {
      setMessage("❌ Este deck compartilhado contém dados inválidos.");
      return;
    }
    const code = encodeDeck(deck.name, cards);
    try {
      await navigator.clipboard.writeText(code);
      setMessage("📋 Código do deck copiado!");
    } catch {
      setMessage("❌ Não foi possível copiar o código.");
    }
  };

  const tryImport = () => {
    const code = importCode.trim();
    if (!code) {
      setImportedDeck(null);
      return;
    }
    if (code.length > 12_000 || !isValidDeckCode(code)) {
      setImportedDeck(null);
      setMessage("❌ Formato de código inválido");
      return;
    }
    const decoded = decodeDeck(code);
    if (!decoded) {
      setImportedDeck(null);
      setMessage("❌ Código inválido ou corrompido");
      return;
    }
    setImportedDeck(decoded);
    setMessage("");
  };

  const saveImported = async () => {
    if (!importedDeck || !playerName) return;
    setSavingImport(true);
    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: playerName,
          name: importedDeck.name,
          emoji: "📥",
          cards: importedDeck.cards,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(`✅ Deck "${importedDeck.name}" importado!`);
        setImportCode("");
        setImportedDeck(null);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } finally {
      setSavingImport(false);
    }
  };

  const getCardsSummary = (cardsJson: string): { unique: number; total: number } => {
    const cards = parseDeckCards(cardsJson);
    return cards ? { unique: new Set(cards).size, total: cards.length } : { unique: 0, total: 0 };
  };

  const totalUpvotes = decks.reduce((sum, deck) => sum + deck.upvotes, 0);
  const totalDownloads = decks.reduce((sum, deck) => sum + deck.downloads, 0);

  return (
    <main className="rf-app-page">
      <SiteNav />
      <div className="rf-app-shell max-w-7xl">
        <header className="rf-app-heading">
          <div>
            <p className="rf-eyebrow"><span /> ARQUIVO COLETIVO</p>
            <h1>Biblioteca da Comunidade</h1>
            <p>Descubra construções de outros forjadores, importe códigos e transforme boas ideias em novos decks da sua coleção.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/profile" className="rf-button rf-button-secondary">◆ MEU PERFIL</Link>
            <Link href="/forge" className="rf-button rf-button-primary">◇ ABRIR FORJA</Link>
          </div>
        </header>

        {message && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100" role="status" aria-live="polite">
            <span>{message}</span>
            <button className="text-xs font-bold text-amber-200 underline underline-offset-4" onClick={() => setMessage("")}>Fechar</button>
          </div>
        )}

        <section className="mb-6 grid gap-3 sm:grid-cols-3" aria-label="Resumo dos decks filtrados">
          <SummaryStat label="Decks encontrados" value={decks.length} copy="no filtro atual" />
          <SummaryStat label="Curtidas" value={totalUpvotes} copy="nos decks visíveis" />
          <SummaryStat label="Downloads" value={totalDownloads} copy="nos decks visíveis" />
        </section>

        <section className="mb-8 rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,.07),rgba(3,5,8,.6))] p-5 sm:p-6" aria-labelledby="import-heading">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-300/65">PORTAL DE IMPORTAÇÃO</p>
              <h2 id="import-heading" className="mt-1 text-xl font-black text-slate-100">Importar via código</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Cole um código de deck RuneForge. O conteúdo é validado pelo codec existente antes de qualquer gravação.</p>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2 text-xs text-slate-500">
              Identidade: <span className="font-bold text-slate-300">{playerName || "sincronizando…"}</span>
            </div>
          </div>

          <form
            className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start"
            onSubmit={(event) => {
              event.preventDefault();
              tryImport();
            }}
          >
            <label className="block">
              <span className="sr-only">Código do deck</span>
              <textarea
                className="input min-h-24 w-full resize-y font-mono text-xs leading-5"
                maxLength={12_000}
                value={importCode}
                onChange={(event) => setImportCode(event.target.value)}
                placeholder="Cole aqui o código do deck…"
                spellCheck={false}
              />
            </label>
            <button type="submit" className="rf-button rf-button-primary min-h-11" disabled={!importCode.trim()}>
              VALIDAR CÓDIGO
            </button>
          </form>

          {importedDeck && (
            <div className="mt-4 flex flex-col gap-4 rounded-xl border border-emerald-300/20 bg-emerald-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-300/65">CÓDIGO VÁLIDO</p>
                <p className="mt-1 font-black text-emerald-200">{importedDeck.name}</p>
                <p className="mt-1 text-xs text-slate-500">{importedDeck.cards.length} cartas prontas para importar.</p>
              </div>
              <button onClick={() => void saveImported()} disabled={savingImport || !playerName} className="rf-button rf-button-secondary min-h-10">
                {savingImport ? "SALVANDO…" : "SALVAR EM MEUS DECKS"}
              </button>
            </div>
          )}
        </section>

        <section className="mb-5 rounded-2xl border border-white/10 bg-black/20 p-4" aria-labelledby="filters-heading">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">CURADORIA</p>
              <h2 id="filters-heading" className="mt-1 text-lg font-black text-slate-100">Filtrar biblioteca</h2>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                Região
                <select className="input mt-1 min-w-40" value={regionFilter} onChange={(event) => setRegionFilter(event.target.value as Region | "All")}>
                  {REGIONS.map((region) => <option key={region} value={region}>{region === "All" ? "Todas" : region}</option>)}
                </select>
              </label>
              <label className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                Arquétipo
                <select className="input mt-1 min-w-40" value={archetypeFilter} onChange={(event) => setArchetypeFilter(event.target.value)}>
                  {ARCHETYPES.map((archetype) => <option key={archetype} value={archetype}>{archetype === "All" ? "Todos" : archetype}</option>)}
                </select>
              </label>
              <button onClick={() => void loadDecks()} disabled={loading} className="rf-button rf-button-secondary min-h-10 !px-3">
                {loading ? "ATUALIZANDO…" : "↻ ATUALIZAR"}
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-labelledby="deck-results-heading">
            <div className="mb-4 flex items-end justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">DESCOBERTA</p>
                <h2 id="deck-results-heading" className="mt-1 text-xl font-black text-slate-100">Decks publicados</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-bold text-slate-400">{decks.length}</span>
            </div>

            {loading && decks.length === 0 ? (
              <EmptyState icon="◇" title="Consultando a biblioteca…" copy="Carregando os decks que correspondem aos filtros atuais." busy />
            ) : decks.length === 0 ? (
              <EmptyState icon="◎" title="Nenhum deck encontrado" copy="Ajuste os filtros ou publique a primeira construção desta categoria." />
            ) : (
              <div className="space-y-3">
                {decks.map((deck) => {
                  const style = REGION_STYLE[deck.region1 as Region];
                  const summary = getCardsSummary(deck.cards);
                  const selected = selectedDeck?.id === deck.id;
                  const busy = busyDeckId === deck.id;
                  return (
                    <article
                      key={deck.id}
                      className={`overflow-hidden rounded-2xl border bg-gradient-to-r ${style?.grad || "from-slate-800 to-slate-900"} transition ${selected ? `${style?.border || "border-amber-300/30"} ${style?.ring || "ring-amber-300/20"} ring-1` : "border-white/10 hover:border-white/20"}`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedDeck(deck)}
                        className="block w-full p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-300/60 sm:p-5"
                        aria-pressed={selected}
                        aria-label={`Ver detalhes do deck ${deck.name}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate font-black text-white">{deck.name}</h3>
                              <span className="rounded border border-white/10 bg-black/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-slate-300">{deck.archetype}</span>
                            </div>
                            <p className="mt-1 text-xs text-white/65">{deck.region1}{deck.region2 && ` + ${deck.region2}`}{deck.region3 && ` + ${deck.region3}`} · {summary.total} cartas · {summary.unique} únicas</p>
                            {deck.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/55">{deck.description}</p>}
                          </div>
                          <div className="shrink-0 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-right text-xs">
                            <p className="font-bold text-slate-200">👍 {deck.upvotes}</p>
                            <p className="mt-1 text-slate-500">↓ {deck.downloads}</p>
                          </div>
                        </div>
                      </button>

                      <div className="flex flex-wrap gap-2 border-t border-white/[0.07] bg-black/15 px-4 py-3 sm:px-5">
                        <button onClick={() => void upvote(deck)} disabled={busy} className="rounded-md border border-emerald-300/15 bg-emerald-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-45" aria-label={`Curtir ${deck.name}`}>
                          👍 CURTIR
                        </button>
                        <button onClick={() => void download(deck)} disabled={busy || !playerName} className="rounded-md border border-cyan-300/15 bg-cyan-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-45" aria-label={`Salvar ${deck.name} nos meus decks`}>
                          ↓ BAIXAR
                        </button>
                        <button onClick={() => void copyCode(deck)} className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-slate-300 transition hover:bg-white/[0.07]" aria-label={`Copiar código de ${deck.name}`}>
                          ⧉ CÓDIGO
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="self-start xl:sticky xl:top-24" aria-label="Detalhes do deck selecionado">
            <div className="rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.018))] p-5 shadow-[0_24px_70px_rgba(0,0,0,.24)]">
              {selectedDeck ? (
                <DeckDetail deck={selectedDeck} />
              ) : (
                <EmptyState icon="◇" title="Selecione um deck" copy="Abra uma construção ao lado para inspecionar regiões, curva de custo e lista completa." />
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function DeckDetail({ deck }: { deck: SharedDeck }) {
  const cards = parseDeckCards(deck.cards) ?? [];
  const counts = new Map<string, number>();
  for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);

  const sorted = Array.from(counts.entries())
    .map(([id, count]) => {
      try {
        return { def: getCard(id), count };
      } catch {
        return null;
      }
    })
    .filter((item): item is { def: ReturnType<typeof getCard>; count: number } => item !== null)
    .sort((a, b) => a.def.cost - b.def.cost || a.def.name.localeCompare(b.def.name));

  const totalCost = cards.reduce((sum, id) => {
    try {
      return sum + getCard(id).cost;
    } catch {
      return sum;
    }
  }, 0);
  const avgCost = cards.length > 0 ? (totalCost / cards.length).toFixed(1) : "0";

  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-300/65">INSPEÇÃO DO DECK</p>
      <h2 className="mt-1 text-xl font-black text-white">{deck.name}</h2>
      <p className="mt-1 text-xs text-slate-500">{deck.region1}{deck.region2 && ` + ${deck.region2}`}{deck.region3 && ` + ${deck.region3}`} · {deck.archetype}</p>
      {deck.description && <p className="mt-3 text-xs leading-5 text-slate-400">{deck.description}</p>}

      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <DetailMetric label="Cartas" value={cards.length} />
        <DetailMetric label="Únicas" value={sorted.length} />
        <DetailMetric label="Custo médio" value={avgCost} />
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Lista de cartas</h3>
          <span className="text-xs text-slate-600">{sorted.length} entradas</span>
        </div>
        {sorted.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-slate-600">Lista indisponível ou inválida.</p>
        ) : (
          <div className="max-h-[480px] space-y-1.5 overflow-y-auto pr-1">
            {sorted.map(({ def, count }) => (
              <div key={def.defId} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2 text-xs">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-sky-300/15 bg-sky-500/15 font-black text-sky-200">{def.cost}</span>
                <span className="text-lg" aria-hidden="true">{def.emoji}</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-slate-200" title={def.name}>{def.name}</span>
                <span className="rounded border border-white/[0.07] bg-black/30 px-1.5 py-0.5 text-[10px] font-black text-slate-500">×{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryStat({ label, value, copy }: { label: string; value: number; copy: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-100">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{copy}</p>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/20 p-3">
      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-600">{label}</p>
      <p className="mt-1 font-black text-slate-100">{value}</p>
    </div>
  );
}

function EmptyState({ icon, title, copy, busy = false }: { icon: string; title: string; copy: string; busy?: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center" aria-busy={busy || undefined}>
      {busy ? (
        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-amber-300" aria-hidden="true" />
      ) : (
        <div className="text-3xl text-amber-200/65" aria-hidden="true">{icon}</div>
      )}
      <p className="mt-3 font-bold text-slate-300">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">{copy}</p>
    </div>
  );
}
