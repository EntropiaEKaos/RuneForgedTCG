"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import { collectibleCards, getCard } from "@/game/cards";
import {
  cardMatchesGeneralIdentity,
  FOUR_PLAYER_RULESET_V0,
  generalIdentity,
  validateFourPlayerDeck,
} from "@/game/four-player-rules";
import { ensurePlayerSession } from "@/lib/client-player-session";

type Deck4P = {
  id: number;
  name: string;
  emoji: string;
  cards: string[];
  generalDefId: string;
};

type RoomSeat = {
  seat: number;
  playerId: number;
  playerName: string;
  ready: boolean;
  eliminated: boolean;
  nexusHealth: number;
  generalDefId: string;
  generalCastCount: number;
  deck?: unknown;
};

type Room4P = {
  id: number;
  code: string;
  state: string;
  hostPlayerId: number;
  activeSeat: number;
  prioritySeat: number;
  turnNumber: number;
  viewerSeat: number | null;
  seats: RoomSeat[];
  publicState?: {
    phase?: string;
    winnerSeat?: number | null;
    seats?: Array<{ seat: number; handCount: number; deckCount: number; general?: { defId: string; zone: string; castCount: number } }>;
  };
};

function lookupCard(defId: string) {
  try { return getCard(defId); } catch { return undefined; }
}

export default function FourPlayerClient() {
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [featureDisabled, setFeatureDisabled] = useState(false);
  const [decks, setDecks] = useState<Deck4P[]>([]);
  const [rooms, setRooms] = useState<Room4P[]>([]);
  const [myRoom, setMyRoom] = useState<Room4P | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);
  const [generalDefId, setGeneralDefId] = useState("");
  const [deckName, setDeckName] = useState("Conselho de Guerra");
  const [list, setList] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const generals = useMemo(() => collectibleCards()
    .filter((card) => {
      const identity = generalIdentity(card);
      return identity.races.length > 0 || identity.classes.length > 0 || identity.affinities.length > 0;
    })
    .sort((a, b) => a.name.localeCompare(b.name)), []);

  const selectedGeneral = generalDefId ? lookupCard(generalDefId) : undefined;
  const identity = selectedGeneral ? generalIdentity(selectedGeneral) : null;
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const defId of list) map.set(defId, (map.get(defId) ?? 0) + 1);
    return map;
  }, [list]);
  const validation = useMemo(
    () => validateFourPlayerDeck(list, generalDefId, lookupCard),
    [list, generalDefId],
  );
  const pool = useMemo(() => {
    const q = query.trim().toLowerCase();
    return collectibleCards()
      .filter((card) => card.defId !== generalDefId)
      .filter((card) => !identity || cardMatchesGeneralIdentity(card, identity))
      .filter((card) => !q || card.name.toLowerCase().includes(q) || card.defId.toLowerCase().includes(q))
      .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  }, [generalDefId, identity, query]);

  const refresh = useCallback(async (silent = false) => {
    try {
      const [deckResponse, roomResponse] = await Promise.all([
        fetch("/api/four-player/decks", { cache: "no-store" }),
        fetch("/api/four-player", { cache: "no-store" }),
      ]);
      const deckPayload = await deckResponse.json();
      const roomPayload = await roomResponse.json();
      if (deckPayload?.code === "FOUR_PLAYER_DISABLED" || roomPayload?.code === "FOUR_PLAYER_DISABLED") {
        setFeatureDisabled(true);
        return;
      }
      if (deckPayload?.ok && Array.isArray(deckPayload.decks)) {
        setDecks(deckPayload.decks);
        setSelectedDeckId((current) => current ?? deckPayload.decks[0]?.id ?? null);
      }
      if (roomPayload?.ok) {
        setRooms(Array.isArray(roomPayload.rooms) ? roomPayload.rooms : []);
        setMyRoom(roomPayload.myRoom ?? null);
      }
    } catch {
      if (!silent) setMessage("Não foi possível sincronizar o modo 4P.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void ensurePlayerSession(localStorage.getItem("runeforge_playername") || "")
      .then((profile) => {
        if (cancelled) return;
        setPlayerId(Number(profile.player?.id) || null);
        return refresh();
      })
      .catch(() => { if (!cancelled) setMessage("Sessão de jogador necessária."); });
    return () => { cancelled = true; };
  }, [refresh]);

  useEffect(() => {
    if (featureDisabled) return;
    const timer = window.setInterval(() => void refresh(true), 2500);
    return () => window.clearInterval(timer);
  }, [featureDisabled, refresh]);

  const addCard = (defId: string) => {
    if (list.length >= FOUR_PLAYER_RULESET_V0.mainDeckCards || (counts.get(defId) ?? 0) >= FOUR_PLAYER_RULESET_V0.maxCopies) return;
    setList((current) => [...current, defId]);
  };
  const removeCard = (defId: string) => {
    setList((current) => {
      const index = current.lastIndexOf(defId);
      return index < 0 ? current : [...current.slice(0, index), ...current.slice(index + 1)];
    });
  };

  const saveDeck = async () => {
    if (!validation.ok || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/four-player/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: deckName, emoji: "⚔️", cards: list, generalDefId }),
      });
      const payload = await response.json();
      if (!payload?.ok) return setMessage(payload?.errors?.[0] || payload?.error || "Falha ao salvar deck 4P.");
      setMessage("Deck 80+1 salvo.");
      await refresh(true);
      setSelectedDeckId(payload.deck.id);
    } finally { setBusy(false); }
  };

  const roomAction = async (code: string, action: string, extra: Record<string, unknown> = {}) => {
    if (busy) return;
    setBusy(true);
    try {
      const gameplay = ["pass", "end-turn", "forfeit"].includes(action);
      const response = await fetch(`/api/four-player/${encodeURIComponent(code)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(gameplay ? { actionId: crypto.randomUUID() } : {}), ...extra }),
      });
      const payload = await response.json();
      if (!payload?.ok) setMessage(payload?.error || "Ação 4P recusada.");
      else {
        if (payload.room) setMyRoom(payload.room);
        setMessage(action === "start" ? "Mesa 4P iniciada." : "");
        await refresh(true);
      }
    } finally { setBusy(false); }
  };

  const createRoom = async () => {
    if (!selectedDeckId || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/four-player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId: selectedDeckId }),
      });
      const payload = await response.json();
      if (!payload?.ok) setMessage(payload?.error || "Não foi possível criar a sala.");
      else {
        setMyRoom(payload.room);
        setMessage(`Sala ${payload.room.code} criada.`);
      }
    } finally { setBusy(false); }
  };

  if (featureDisabled) {
    return (
      <main className="rf-app-page">
        <SiteNav />
        <div className="rf-app-shell">
          <section className="mx-auto mt-16 max-w-2xl rounded-3xl border border-amber-300/20 bg-slate-950/70 p-8 text-center">
            <p className="rf-eyebrow"><span /> FOUR PLAYER LAB</p>
            <h1 className="mt-3 text-4xl font-black text-white">4 Jogadores + General</h1>
            <p className="mt-4 text-slate-300">O modo está instalado atrás de feature flag e permanece fechado ao público até concluir a certificação específica de quatro clientes.</p>
            <Link href="/play" className="rf-button rf-button-secondary mt-6 inline-flex">VOLTAR AO 1V1</Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="rf-app-page">
      <SiteNav />
      <div className="rf-app-shell">
        <header className="rf-app-heading">
          <div>
            <p className="rf-eyebrow"><span /> FOUR PLAYER LAB</p>
            <h1>Conselho dos Quatro</h1>
            <p>FFA separado do 1v1. Deck de 80 cartas + 1 General, prioridade circular e mesa para quatro jogadores reais.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/play" className="rf-button rf-button-secondary">1V1</Link>
            <button className="rf-button rf-button-primary" type="button" onClick={() => void createRoom()} disabled={!selectedDeckId || busy}>CRIAR SALA</button>
          </div>
        </header>

        {message && <div className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{message}</div>}

        {myRoom ? (
          <FourPlayerTable room={myRoom} playerId={playerId} decks={decks} selectedDeckId={selectedDeckId} setSelectedDeckId={setSelectedDeckId} busy={busy} onAction={roomAction} />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
            <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-300">Deck 80 + 1</p><h2 className="mt-1 text-xl font-black text-white">Forja do General</h2></div>
                <span className={`rounded-full border px-3 py-1 text-xs font-black ${validation.ok ? "border-emerald-400/30 text-emerald-200" : "border-white/10 text-slate-400"}`}>{list.length}/80</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-xs font-bold text-slate-400">Nome<input className="input mt-1 w-full" value={deckName} onChange={(event) => setDeckName(event.target.value)} maxLength={40} /></label>
                <label className="text-xs font-bold text-slate-400">General
                  <select className="input mt-1 w-full" value={generalDefId} onChange={(event) => { setGeneralDefId(event.target.value); setList([]); }}>
                    <option value="">Escolha um General</option>
                    {generals.map((card) => <option key={card.defId} value={card.defId}>{card.name}</option>)}
                  </select>
                </label>
              </div>
              {identity && <p className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[.04] px-3 py-2 text-xs text-cyan-100">Identidade: {[...identity.races, ...identity.classes, ...identity.affinities].join(" · ") || "—"}</p>}
              <input className="input mt-4 w-full" placeholder="Buscar carta legal para este General…" value={query} onChange={(event) => setQuery(event.target.value)} />
              <div className="mt-3 grid max-h-[440px] gap-1 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                {pool.map((card) => {
                  const amount = counts.get(card.defId) ?? 0;
                  const blocked = amount >= 2 || list.length >= 80;
                  return <button key={card.defId} type="button" disabled={blocked} onClick={() => addCard(card.defId)} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-left text-xs text-slate-200 disabled:opacity-30"><span className="truncate"><b className="mr-2 text-sky-300">{card.cost}</b>{card.name}</span><b>×{amount}</b></button>;
                })}
              </div>
              {!validation.ok && list.length > 0 && <p className="mt-3 text-xs text-rose-300">{validation.errors[0]}</p>}
              <button type="button" disabled={!validation.ok || busy} onClick={() => void saveDeck()} className="rf-button rf-button-primary mt-4 w-full">SALVAR DECK 4P</button>
            </section>

            <aside className="space-y-4">
              <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <h2 className="font-black text-white">Lista atual</h2>
                <p className="mt-1 text-xs text-slate-400">Máximo de 2 cópias por carta.</p>
                <div className="mt-3 max-h-[320px] space-y-1 overflow-y-auto">
                  {[...counts.entries()].map(([defId, amount]) => <button type="button" key={defId} onClick={() => removeCard(defId)} className="flex w-full justify-between rounded-lg px-2 py-1.5 text-left text-xs text-slate-300 hover:bg-white/5"><span className="truncate">{getCard(defId).name}</span><b>×{amount}</b></button>)}
                </div>
              </section>
              <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <h2 className="font-black text-white">Meus decks 4P</h2>
                <select className="input mt-3 w-full" value={selectedDeckId ?? ""} onChange={(event) => setSelectedDeckId(Number(event.target.value) || null)}>
                  <option value="">Selecione</option>
                  {decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.emoji} {deck.name}</option>)}
                </select>
              </section>
              <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <h2 className="font-black text-white">Salas abertas</h2>
                <div className="mt-3 space-y-2">
                  {rooms.map((room) => <div key={room.id} className="rounded-xl border border-white/10 p-3"><div className="flex justify-between"><b>{room.code}</b><span className="text-xs text-slate-400">{room.seats.length}/4</span></div><button type="button" disabled={!selectedDeckId || busy} onClick={() => selectedDeckId && void roomAction(room.code, "join", { deckId: selectedDeckId })} className="mt-2 w-full rounded-lg border border-cyan-300/20 px-2 py-1.5 text-xs font-black text-cyan-100">ENTRAR</button></div>)}
                  {rooms.length === 0 && <p className="text-xs text-slate-500">Nenhuma sala aberta.</p>}
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function FourPlayerTable(props: {
  room: Room4P;
  playerId: number | null;
  decks: Deck4P[];
  selectedDeckId: number | null;
  setSelectedDeckId: (id: number | null) => void;
  busy: boolean;
  onAction: (code: string, action: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const { room, playerId, decks, selectedDeckId, setSelectedDeckId, busy, onAction } = props;
  const viewer = room.viewerSeat ?? 0;
  const relative = (seat: number) => (seat - viewer + 4) % 4;
  const positions = ["bottom", "left", "top", "right"] as const;
  const me = room.seats.find((seat) => seat.playerId === playerId);
  const runtimeSeats = room.publicState?.seats ?? [];
  const isHost = room.hostPlayerId === playerId;
  const allReady = room.seats.length === 4 && room.seats.every((seat) => seat.ready);

  return (
    <section className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-300">Sala {room.code}</p><h2 className="text-xl font-black text-white">{room.state === "playing" ? `Turno ${room.turnNumber}` : "Mesa de preparação"}</h2></div>
        <div className="flex gap-2">
          {room.state !== "playing" && <button type="button" disabled={busy} onClick={() => void onAction(room.code, "ready", { ready: !me?.ready })} className="rf-button rf-button-secondary">{me?.ready ? "NÃO PRONTO" : "PRONTO"}</button>}
          {room.state === "ready" && allReady && isHost && <button type="button" disabled={busy} onClick={() => void onAction(room.code, "start")} className="rf-button rf-button-primary">INICIAR 4P</button>}
          {room.state === "playing" && <button type="button" disabled={busy} onClick={() => void onAction(room.code, "pass")} className="rf-button rf-button-secondary">PASSAR</button>}
          {room.state === "playing" && room.activeSeat === viewer && <button type="button" disabled={busy} onClick={() => void onAction(room.code, "end-turn")} className="rf-button rf-button-primary">ENCERRAR TURNO</button>}
          <button type="button" disabled={busy} onClick={() => void onAction(room.code, room.state === "playing" ? "forfeit" : "leave")} className="rounded-lg border border-rose-400/20 px-3 py-2 text-xs font-black text-rose-200">{room.state === "playing" ? "DESISTIR" : "SAIR"}</button>
        </div>
      </div>

      <div className="relative mt-5 min-h-[620px] overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(14,116,144,.16),rgba(2,6,23,.9)_58%)]">
        <div className="absolute left-1/2 top-1/2 w-56 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-violet-300/15 bg-black/30 p-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-300">Stack / Resolução</p>
          <b className="mt-2 block text-white">{room.publicState?.phase ?? room.state}</b>
          <span className="mt-1 block text-xs text-slate-400">Prioridade: P{room.prioritySeat + 1} · Ativo: P{room.activeSeat + 1}</span>
        </div>
        {room.seats.map((seat) => {
          const position = positions[relative(seat.seat)];
          const runtime = runtimeSeats.find((entry) => entry.seat === seat.seat);
          const posClass = position === "bottom" ? "bottom-5 left-1/2 -translate-x-1/2" : position === "top" ? "top-5 left-1/2 -translate-x-1/2" : position === "left" ? "left-5 top-1/2 -translate-y-1/2" : "right-5 top-1/2 -translate-y-1/2";
          return <article key={seat.seat} className={`absolute w-52 rounded-2xl border p-3 ${posClass} ${room.activeSeat === seat.seat ? "border-amber-300/50 bg-amber-300/10" : "border-white/10 bg-slate-950/85"} ${seat.eliminated ? "opacity-40 grayscale" : ""}`}>
            <div className="flex justify-between"><b className="truncate text-white">P{seat.seat + 1} · {seat.playerName}</b><span>{seat.ready ? "✓" : "…"}</span></div>
            <p className="mt-1 text-xs text-rose-200">Nexus {seat.nexusHealth}</p>
            <p className="mt-1 truncate text-[10px] text-cyan-200">General: {lookupCard(seat.generalDefId)?.name ?? seat.generalDefId}</p>
            <p className="mt-1 text-[10px] text-slate-400">Mão {runtime?.handCount ?? "—"} · Deck {runtime?.deckCount ?? "—"} · casts {runtime?.general?.castCount ?? seat.generalCastCount}</p>
          </article>;
        })}
        {[0, 1, 2, 3].filter((seat) => !room.seats.some((entry) => entry.seat === seat)).map((seat) => {
          const position = positions[relative(seat)];
          const posClass = position === "bottom" ? "bottom-5 left-1/2 -translate-x-1/2" : position === "top" ? "top-5 left-1/2 -translate-x-1/2" : position === "left" ? "left-5 top-1/2 -translate-y-1/2" : "right-5 top-1/2 -translate-y-1/2";
          return <div key={seat} className={`absolute w-52 rounded-2xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-600 ${posClass}`}>Assento P{seat + 1} livre</div>;
        })}
      </div>

      {room.state !== "playing" && !me && (
        <div className="mt-4 flex gap-2">
          <select className="input flex-1" value={selectedDeckId ?? ""} onChange={(event) => setSelectedDeckId(Number(event.target.value) || null)}>
            <option value="">Escolha seu deck 4P</option>
            {decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
          </select>
          <button type="button" disabled={!selectedDeckId || busy} onClick={() => selectedDeckId && void onAction(room.code, "join", { deckId: selectedDeckId })} className="rf-button rf-button-primary">ENTRAR</button>
        </div>
      )}
    </section>
  );
}
