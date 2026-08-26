"use client";

import { CARD_REGIONS } from "@/game/card-authoring";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CardTip from "@/components/CardTip";
import { REGION_STYLE } from "@/components/CardView";
import { collectibleCards, getCard } from "@/game/cards";
import { validateDeck } from "@/game/decks";
import { getRuntimeDeckRules } from "@/game/runtime-config";
import type { Region } from "@/game/types";
import { analyzeDeck, type DeckInsight } from "@/game/deck-insights";
import { useCatalogRevision } from "@/components/CatalogContext";
import { cardRegions, identityForRegions } from "@/game/region-identity";
import { ensurePlayerSession } from "@/lib/client-player-session";
import { analyzeDeckSynergy, recommendSynergies } from "@/game/synergy-graph";
import { cardLegalInFormat } from "@/game/format-rules";

interface SavedDeck {
  id: number;
  ownerName: string;
  name: string;
  emoji: string;
  cards: string[];
  formatId?: string;
}

const REGIONS: Array<Region | "All"> = ["All", ...CARD_REGIONS];

export default function ForgeClient() {
  const catalogRevision = useCatalogRevision();
  const [ownerName, setOwnerName] = useState("");
  const [saved, setSaved] = useState<SavedDeck[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("My Deck");
  const [emoji, setEmoji] = useState("🎴");
  const [list, setList] = useState<string[]>([]);
  const [filter, setFilter] = useState<Region | "All">("All");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string>("");
  const [formatId, setFormatId] = useState("vanilla");
  const [formats, setFormats] = useState<any[]>([{id:"vanilla",name:"Vanilla",collectionKeys:["vanilla"],active:true}]);
  const [focusCard, setFocusCard] = useState<string | null>(null);
  void catalogRevision;
  const deckRules = getRuntimeDeckRules();
  const deckMin = deckRules.deckMin;
  const deckMax = deckRules.deckMax;
  const maxCopies = deckRules.maxCopies;

  const load = (owner: string) => {
    fetch(`/api/decks?owner=${encodeURIComponent(owner)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setSaved(data.decks);
      })
      .catch(() => {});
  };

  useEffect(() => {
    void ensurePlayerSession(localStorage.getItem("runeforge_playername") || "").then((profile) => {
      if (profile.player?.name) setOwnerName(String(profile.player.name));
    });
  }, []);

  useEffect(() => {
    if (ownerName) load(ownerName);
  }, [ownerName]);
  useEffect(()=>{fetch("/api/formats").then(r=>r.json()).then(d=>{if(d.ok&&d.formats?.length)setFormats(d.formats.filter((f:any)=>f.active!==false));}).catch(()=>{});},[]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const id of list) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [list]);

  const check = useMemo(() => { void catalogRevision; return validateDeck(list); }, [list, catalogRevision]);
  const insight = useMemo(() => { void catalogRevision; return analyzeDeck(list); }, [list, catalogRevision]);
  const synergy = useMemo(() => { void catalogRevision; return analyzeDeckSynergy(list); }, [list, catalogRevision]);
  const suggestions = useMemo(() => { void catalogRevision; return focusCard ? recommendSynergies(focusCard, 6).filter(x=>!counts.has(x.defId)) : []; }, [focusCard, counts, catalogRevision]);
  const selectedFormat = formats.find((f:any)=>f.id===formatId) || formats[0];

  const pool = useMemo(() => {
    void catalogRevision;
    const q = query.trim().toLowerCase();
    return collectibleCards()
      .filter((c) => cardLegalInFormat(c.defId, selectedFormat))
      .filter((c) => (filter === "All" ? true : cardRegions(c).includes(filter)))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
      .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  }, [filter, query, catalogRevision, selectedFormat]);

  const addCard = (defId: string) => {
    const n = counts.get(defId) ?? 0;
    if (n >= maxCopies || list.length >= deckMax) return;
    setList((prev) => [...prev, defId]);
  };

  const removeCard = (defId: string) => {
    setList((prev) => {
      const i = prev.lastIndexOf(defId);
      if (i < 0) return prev;
      return [...prev.slice(0, i), ...prev.slice(i + 1)];
    });
  };

  const resetNew = () => {
    setEditingId(null);
    setName("My Deck");
    setEmoji("🎴");
    setList([]);
    setMessage("");
    setFormatId("vanilla");
  };

  const loadDeck = (d: SavedDeck) => {
    setEditingId(d.id);
    setName(d.name);
    setEmoji(d.emoji);
    setList(d.cards);
    setFormatId(d.formatId || "eternal");
    setMessage(`Editing ${d.name}`);
  };

  const save = async () => {
    if (!check.ok) {
      setMessage(check.errors[0] ?? "Invalid deck");
      return;
    }
    const payload = { ownerName, name, emoji, formatId, cards: list };
    const res = await fetch(editingId ? `/api/decks/${editingId}` : "/api/decks", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.ok) {
      setMessage((data.errors && data.errors[0]) || data.error || "Save failed");
      return;
    }
    setEditingId(data.deck.id);
    setMessage("Deck saved.");
    load(ownerName);
  };

  const remove = async (id: number) => {
    await fetch(`/api/decks/${id}`, { method: "DELETE" });
    if (editingId === id) resetNew();
    load(ownerName);
  };

  const shareToCommunity = async () => {
    if (!check.ok) {
      setMessage(check.errors[0] ?? "Invalid deck");
      return;
    }
    const regions = check.regions;
    const res = await fetch("/api/decks/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerName: ownerName,
        name,
        description: `Deck by ${ownerName}`,
        region1: regions[0] || "Emberhold",
        region2: regions[1] || null,
        region3: regions[2] || null,
        cards: list,
        archetype: "Custom",
        formatId,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setMessage(`🌐 Deck compartilhado! Código: ${data.code.slice(0, 20)}...`);
      navigator.clipboard.writeText(data.code).catch(() => {});
    } else {
      setMessage(`❌ ${(data.errors && data.errors[0]) || data.error || "Erro ao compartilhar"}`);
    }
  };

  const copyCode = () => {
    if (!check.ok) {
      setMessage("Deck inválido para copiar código");
      return;
    }
    // Encode deck locally using deck-codec (client-side)
    import("@/lib/deck-codec").then(({ encodeDeck }) => {
      const code = encodeDeck(name, list);
      navigator.clipboard.writeText(code).catch(() => {});
      setMessage(`📋 Código copiado: ${code.slice(0, 25)}...`);
    });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#1e293b,#0f172a_55%,#020617)] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-400 hover:text-white">
            ← Home
          </Link>
          <div className="flex gap-4 text-sm text-slate-400">
            <Link href="/play" className="hover:text-white">
              ⚔️ Play
            </Link>
            <Link href="/codex" className="hover:text-white">
              📖 Codex
            </Link>
          </div>
        </div>

        <h1 className="text-center text-3xl font-black text-amber-300">🔨 The Forge</h1>
        <p className="mt-1 text-center text-sm text-slate-400">
          Build a {deckMin}–{deckMax} card deck. Max {maxCopies} copies. Up to {deckRules.maxRegions} regions.
        </p>

        {check.regions.length > 0 && (
          <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/[.06] px-4 py-3">
            <small className="font-black tracking-[.16em] text-cyan-300">IDENTIDADE DO DECK</small>
            <div className="mt-1 flex items-center gap-3">
              <b className="text-xl">{identityForRegions(check.regions).sigils}</b>
              <div><strong className="block text-sm text-white">{identityForRegions(check.regions).name}</strong><span className="text-[10px] text-slate-400">{check.regions.join(" · ")}</span></div>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-slate-400">
            Your Name
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-slate-800 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs font-semibold text-slate-400">
            Deck Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-slate-800 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs font-semibold text-slate-400">
            Emblem
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={4}
              className="mt-1 w-full rounded-lg border border-white/15 bg-slate-800 px-3 py-2 text-sm text-white"
            />
          </label>
        </div>


        <div className="mt-3 max-w-sm"><label className="text-xs font-semibold text-slate-400">Formato<select className="mt-1 input" value={formatId} onChange={e=>{setFormatId(e.target.value);setMessage("");}}>{formats.map((f:any)=><option key={f.id} value={f.id}>{f.name}{f.rankedEligible?" · Ranked":""}</option>)}</select></label><p className="mt-1 text-[10px] text-slate-500">A legalidade é revalidada pelo servidor ao salvar e compartilhar.</p></div>

        {saved.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={resetNew} className="btn-ghost !px-3 !py-1 text-xs">
              + New
            </button>
            {saved.map((d) => (
              <div
                key={d.id}
                className={[
                  "flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs",
                  editingId === d.id ? "ring-1 ring-amber-400" : "",
                ].join(" ")}
              >
                <button onClick={() => loadDeck(d)}>
                  {d.emoji} {d.name} ({d.cards.length})
                </button>
                <button onClick={() => remove(d.id)} className="text-red-300 hover:text-red-200">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={[
                "rounded-full px-3 py-1 text-xs font-bold",
                filter === r ? "bg-amber-400 text-slate-950" : "bg-white/10 text-slate-300",
              ].join(" ")}
            >
              {r}
            </button>
          ))}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards…"
            className="ml-auto rounded-lg border border-white/15 bg-slate-800 px-3 py-1.5 text-xs"
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="flex flex-wrap gap-2">
            {pool.map((c) => {
              const n = counts.get(c.defId) ?? 0;
              return (
                <CardTip
                  key={c.defId}
                  defId={c.defId}
                  size="md"
                  count={n || undefined}
                  dimmed={n >= maxCopies || list.length >= deckMax}
                  onClick={() => { addCard(c.defId); setFocusCard(c.defId); }}
                />
              );
            })}
          </div>

          <aside className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-amber-200">
                {emoji} {name}
              </h3>
              <span className={list.length < deckMin || list.length > deckMax ? "text-red-300" : "text-emerald-300"}>
                {list.length}/{deckMax}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">{check.regions.join(" · ") || "No regions yet"}</p>
            <DeckInsightPanel insight={insight} />

            <ul className="mt-3 max-h-[420px] space-y-1 overflow-y-auto text-xs">
              {[...counts.entries()]
                .sort((a, b) => getCard(a[0]).cost - getCard(b[0]).cost)
                .map(([id, n]) => {
                  const c = getCard(id);
                  const style = REGION_STYLE[c.region];
                  return (
                    <li key={id}>
                      <button
                        onClick={() => removeCard(id)}
                        className="flex w-full items-center justify-between rounded px-2 py-1 hover:bg-white/10"
                      >
                        <span>
                          <span className="mr-2 inline-block w-4 text-center font-black text-sky-300">{c.cost}</span>
                          {c.emoji} {c.name}
                        </span>
                        <span className={`font-bold ${style.text}`}>×{n}</span>
                      </button>
                    </li>
                  );
                })}
            </ul>

            {!check.ok && (
              <ul className="mt-3 space-y-1 text-[11px] text-red-300">
                {check.errors.map((e) => (
                  <li key={e}>• {e}</li>
                ))}
              </ul>
            )}

            {message && <p className="mt-3 text-xs text-amber-200">{message}</p>}


            <section className="mt-4 rounded-xl border border-violet-400/20 bg-violet-400/[.05] p-3"><div className="flex items-center justify-between"><div><small className="font-black tracking-[.15em] text-violet-300">SYNERGY GRAPH</small><b className="block text-sm">{synergy.score}/100 · {synergy.links.length} conexões</b></div><span className="text-2xl">🕸️</span></div><p className="mt-1 text-[10px] text-slate-500">Clique em uma carta no catálogo para receber sugestões sem alterar o deck automaticamente.</p>{focusCard&&<div className="mt-2 flex flex-wrap gap-1">{suggestions.map(x=><button key={x.defId} onClick={()=>addCard(x.defId)} className="rounded border border-white/10 px-2 py-1 text-[10px] hover:bg-white/10">+ {getCard(x.defId).name} · {x.score}</button>)}</div>}</section>

            <div className="mt-4 flex flex-col gap-2">
              <button onClick={save} className="btn-primary w-full" disabled={!check.ok}>
                💾 Save Deck
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={shareToCommunity}
                  className="rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-2 text-xs font-bold text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-30"
                  disabled={!check.ok}
                >
                  🌐 Share
                </button>
                <button
                  onClick={copyCode}
                  className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-30"
                  disabled={!check.ok}
                >
                  📋 Copy Code
                </button>
              </div>
              <Link href="/play" className="btn-ghost w-full text-center">
                ⚔️ Play with it
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
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
