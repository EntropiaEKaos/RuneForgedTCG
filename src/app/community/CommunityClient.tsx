"use client";

import { CARD_REGIONS } from "@/game/card-authoring";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import CardTip from "@/components/CardTip";
import { REGION_STYLE } from "@/components/CardView";
import { getCard } from "@/game/cards";
import { encodeDeck, decodeDeck, isValidDeckCode } from "@/lib/deck-codec";
import type { Region } from "@/game/types";
import { ensurePlayerSession } from "@/lib/client-player-session";

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

  // Import via code
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
      if (data.ok) setDecks(data.decks);
    } finally {
      setLoading(false);
    }
  }, [regionFilter, archetypeFilter]);

  useDeferredEffect(() => {
    loadDecks();
  }, [loadDecks]);

  const upvote = async (deck: SharedDeck) => {
    await fetch(`/api/decks/share/${deck.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upvote" }),
    });
    await loadDecks();
  };

  const download = async (deck: SharedDeck) => {
    // Save as custom deck for player
    const cards = parseDeckCards(deck.cards);
    if (!cards) {
      setMessage("❌ Este deck compartilhado contém dados inválidos.");
      return;
    }
    const res = await fetch("/api/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerName: playerName,
        name: `${deck.name} (copy)`,
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
      setMessage("❌ Formato de código inválido");
      return;
    }
    const decoded = decodeDeck(code);
    if (!decoded) {
      setMessage("❌ Código inválido ou corrompido");
      return;
    }
    setImportedDeck(decoded);
    setMessage("");
  };

  const saveImported = async () => {
    if (!importedDeck) return;
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
  };

  const getCardsSummary = (cardsJson: string): { unique: number; total: number } => {
    try {
      const cards: string[] = JSON.parse(cardsJson);
      return { unique: new Set(cards).size, total: cards.length };
    } catch {
      return { unique: 0, total: 0 };
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#1e293b,#0f172a_55%,#020617)] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl">
        {/* Nav */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4">
            <Link href="/" className="text-sm text-slate-400 hover:text-white">
              ← Home
            </Link>
            <Link href="/play" className="text-sm text-slate-400 hover:text-white">
              Play
            </Link>
            <Link href="/collection" className="text-sm text-slate-400 hover:text-white">
              Collection
            </Link>
            <Link href="/forge" className="text-sm text-slate-400 hover:text-white">
              Forge
            </Link>
            <Link href="/profile" className="text-sm text-slate-400 hover:text-white">
              Profile
            </Link>
          </div>
          <input
            className="input max-w-[180px]"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onBlur={() => { void ensurePlayerSession(playerName).then((profile) => { if (profile.player?.name) setPlayerName(String(profile.player.name)); }); }}
            placeholder="Your name"
          />
        </div>

        <h1 className="mb-2 text-3xl font-black text-amber-300">🌐 Biblioteca da Comunidade</h1>
        <p className="mb-6 text-sm text-slate-400">Descubra, compartilhe e importe decks de outros jogadores</p>

        {message && (
          <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            {message}
            <button className="ml-3 text-xs underline" onClick={() => setMessage("")}>
              dismiss
            </button>
          </div>
        )}

        {/* Import section */}
        <section className="mb-6 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
          <h2 className="text-lg font-black text-cyan-300">📥 Importar via Código</h2>
          <p className="mt-1 text-xs text-slate-400">Cole um código de deck para importá-lo</p>
          <div className="mt-3 flex gap-2">
            <input
              className="input flex-1 font-mono text-xs"
              maxLength={12_000}
              value={importCode}
              onChange={(e) => setImportCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && tryImport()}
              placeholder="eyJuIjoiTXkgRGVjayIsImMi..."
            />
            <button onClick={tryImport} className="btn-primary !px-4 !py-2 text-xs">
              🔍 Decodificar
            </button>
          </div>
          {importedDeck && (
            <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-emerald-300">✓ {importedDeck.name}</p>
                  <p className="text-xs text-slate-400">{importedDeck.cards.length} cartas</p>
                </div>
                <button onClick={saveImported} className="btn-primary !px-3 !py-1 text-xs">
                  💾 Salvar em Meus Decks
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
          <span className="text-xs font-bold text-slate-400">Filtros:</span>
          <select
            className="input max-w-[130px]"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value as Region | "All")}
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            className="input max-w-[130px]"
            value={archetypeFilter}
            onChange={(e) => setArchetypeFilter(e.target.value)}
          >
            {ARCHETYPES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">{decks.length} decks</span>
          <button onClick={loadDecks} className="ml-auto btn-ghost !px-3 !py-1 text-xs">
            ↻ Atualizar
          </button>
        </div>

        {/* Grid + Detail */}
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            {decks.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-12 text-center text-slate-500">
                {loading ? "Carregando…" : "Nenhum deck encontrado. Seja o primeiro a compartilhar!"}
              </div>
            ) : (
              decks.map((deck) => {
                const style = REGION_STYLE[deck.region1 as Region];
                const summary = getCardsSummary(deck.cards);
                return (
                  <article
                    key={deck.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDeck(deck)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedDeck(deck);
                      }
                    }}
                    className={`block w-full rounded-xl border p-4 text-left transition-all hover:scale-[1.01] ${
                      selectedDeck?.id === deck.id
                        ? `${style?.border} ${style?.ring} ring-2`
                        : "border-white/10"
                    } bg-gradient-to-r ${style?.grad || "from-slate-800 to-slate-900"} bg-opacity-20`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-white">{deck.name}</h3>
                          <span className="rounded bg-black/40 px-2 py-0.5 text-[10px] font-bold">
                            {deck.archetype}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-white/70">
                          {deck.region1}
                          {deck.region2 && ` + ${deck.region2}`}
                          {deck.region3 && ` + ${deck.region3}`}
                          {" · "}
                          {summary.total} cartas ({summary.unique} únicas)
                        </p>
                        {deck.description && (
                          <p className="mt-2 line-clamp-2 text-xs text-white/60">{deck.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="rounded bg-white/10 px-2 py-1 text-xs">👍 {deck.upvotes}</span>
                        <span className="text-[10px] text-white/60">⬇️ {deck.downloads}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          upvote(deck);
                        }}
                        className="rounded bg-emerald-600/80 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-500"
                      >
                        👍 Curtir
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          download(deck);
                        }}
                        className="rounded bg-cyan-600/80 px-2 py-1 text-xs font-bold text-white hover:bg-cyan-500"
                      >
                        ⬇️ Baixar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyCode(deck);
                        }}
                        className="rounded bg-slate-700 px-2 py-1 text-xs font-bold text-white hover:bg-slate-600"
                      >
                        📋 Código
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {/* Detail panel */}
          <aside className="sticky top-4 self-start rounded-xl border border-white/10 bg-white/5 p-4">
            {selectedDeck ? (
              <DeckDetail deck={selectedDeck} />
            ) : (
              <div className="py-12 text-center text-sm text-slate-500">
                <div className="text-4xl">🎴</div>
                <p className="mt-2">Selecione um deck para ver as cartas</p>
              </div>
            )}
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
    .filter((x): x is { def: ReturnType<typeof getCard>; count: number } => x !== null)
    .sort((a, b) => a.def.cost - b.def.cost);

  const totalCost = cards.reduce((sum, id) => {
    try {
      return sum + getCard(id).cost;
    } catch {
      return sum;
    }
  }, 0);
  const avgCost = cards.length > 0 ? (totalCost / cards.length).toFixed(1) : "0";

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-black text-white">{deck.name}</h3>
        <p className="text-xs text-slate-400">
          {deck.region1}
          {deck.region2 && ` + ${deck.region2}`}
          {deck.region3 && ` + ${deck.region3}`}
        </p>
        {deck.description && <p className="mt-2 text-xs text-slate-300">{deck.description}</p>}
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg bg-black/40 p-2 text-center text-xs">
        <div>
          <p className="text-slate-500">Cartas</p>
          <p className="font-black text-white">{cards.length}</p>
        </div>
        <div>
          <p className="text-slate-500">Únicas</p>
          <p className="font-black text-white">{sorted.length}</p>
        </div>
        <div>
          <p className="text-slate-500">Custo médio</p>
          <p className="font-black text-white">{avgCost}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-slate-400">Lista de Cartas</p>
        <div className="max-h-[400px] space-y-1 overflow-y-auto">
          {sorted.map(({ def, count }) => (
            <div key={def.defId} className="flex items-center gap-2 rounded bg-white/5 px-2 py-1 text-xs">
              <span className="w-6 rounded bg-sky-600 text-center font-bold">{def.cost}</span>
              <span className="text-lg">{def.emoji}</span>
              <span className="flex-1 truncate font-semibold">{def.name}</span>
              <span className="rounded bg-black/40 px-1.5 text-[10px] font-bold">x{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
