"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ensurePlayerSession } from "@/lib/client-player-session";
import { DECKS, type DeckDef } from "@/game/decks";

interface PvpRoom {
  id: number;
  code: string;
  hostName: string;
  hostDeck: string | null;
  guestName: string | null;
  guestDeck: string | null;
  state: string;
  createdAt: string;
}

interface ChatMessage {
  id: number;
  playerName: string;
  message: string;
  createdAt: string;
}

export default function PvpClient() {
  const [playerName, setPlayerName] = useState("");
  const [identityName, setIdentityName] = useState<string | null>(null);
  const [selectedDeck, setSelectedDeck] = useState(DECKS[0].id);
  const [presetDecks, setPresetDecks] = useState<DeckDef[]>(DECKS);
  const [joinCode, setJoinCode] = useState("");
  const [rooms, setRooms] = useState<PvpRoom[]>([]);
  const [myRoom, setMyRoom] = useState<PvpRoom | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [connection, setConnection] = useState<"connecting" | "online" | "offline">("connecting");
  const bootstrappedRef = useRef(false);
  useEffect(() => {
    const room = new URLSearchParams(window.location.search).get("room");
    if (room) window.location.replace(`/play?pvpRoom=${encodeURIComponent(room)}`);
  }, []);
  useEffect(() => { fetch("/api/catalog", { cache: "no-store" }).then((response) => response.json()).then((data) => { if (data.ok && Array.isArray(data.decks) && data.decks.length) { setPresetDecks(data.decks); setSelectedDeck((current) => data.decks.some((deck: DeckDef) => deck.id === current) ? current : data.decks[0].id); } }).catch(() => {}); }, []);

  // Once the room transitions from "waiting" to "playing" (the opponent
  // joined), automatically send the player into the actual match. Before
  // this, the lobby only updated a status label to "⚔️ Em jogo" — there was
  // no link or redirect anywhere in the UI that could get either player from
  // the lobby into GameClient's already-working PvP mode
  // (`/play?pvpRoom=<code>`), so the entire server-authoritative PvP match
  // flow (locking, versioning, settlement, replay verification) was
  // reachable only by manually typing the URL.
  const enteredMatchRef = useRef<string | null>(null);
  useEffect(() => {
    if (myRoom?.state === "playing" && myRoom.code && enteredMatchRef.current !== myRoom.code) {
      enteredMatchRef.current = myRoom.code;
      window.location.replace(`/play?pvpRoom=${encodeURIComponent(myRoom.code)}`);
    }
  }, [myRoom?.state, myRoom?.code]);

  useDeferredEffect(() => {
    const saved = localStorage.getItem("runeforge_playername");
    if (saved) setPlayerName(saved);
  }, []);

  const loadChat = useCallback(async (code: string) => {
    try {
      const res = await fetch(`/api/pvp/${code}`);
      const data = await res.json();
      if (data.ok) setChat(data.chat);
    } catch { setConnection("offline"); }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/pvp?name=${encodeURIComponent(playerName)}`);
      const data = await res.json();
      if (!data.playerName && !bootstrappedRef.current) {
        bootstrappedRef.current = true;
        const profile = await ensurePlayerSession(playerName).catch(() => null);
        if (profile?.ok && profile.player) {
          setIdentityName(profile.player.name);
          setPlayerName(profile.player.name);
          return;
        }
      }
      if (data.ok) {
        setConnection("online");
        if (data.playerName) {
          setIdentityName(data.playerName);
          setPlayerName(data.playerName);
        }
        setRooms(data.rooms);
        setMyRoom(data.myRoom);
        if (data.myRoom) {
          loadChat(data.myRoom.code);
        }
      }
    } catch {
      setConnection("offline");
      setMessage("⚠️ Lobby offline. Tentando reconectar automaticamente…");
    }
  }, [playerName, loadChat]);

  useDeferredEffect(() => {
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [load]);

  const createRoom = async () => {
    try {
      const res = await fetch("/api/pvp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hostDeck: selectedDeck }) });
      const data = await res.json();
      if (data.ok) { setMessage(`✅ Sala criada! Código: ${data.room.code}`); await load(); }
      else setMessage(`❌ ${data.error}`);
    } catch { setConnection("offline"); setMessage("❌ Não foi possível criar a sala. Verifique sua conexão."); }
  };

  const joinRoom = async (code: string) => {
    try {
      const res = await fetch(`/api/pvp/${code.toUpperCase()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join", guestDeck: selectedDeck }) });
      const data = await res.json();
      if (data.ok) { setMessage("✅ Entrou na sala!"); await load(); }
      else setMessage(`❌ ${data.error}`);
    } catch { setConnection("offline"); setMessage("❌ Não foi possível entrar na sala."); }
  };

  const leaveRoom = async () => {
    if (!myRoom) return;
    try {
      const response = await fetch(`/api/pvp/${myRoom.code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) { setMessage(`❌ ${data.error || "Não foi possível sair da sala."}`); return; }
      setMyRoom(null);
      setChat([]);
      await load();
    } catch {
      setConnection("offline");
      setMessage("❌ Falha de conexão ao sair da sala.");
    }
  };

  const sendChat = async () => {
    if (!myRoom || !chatInput.trim()) return;
    try {
      const response = await fetch(`/api/pvp/${myRoom.code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chat", message: chatInput }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) { setMessage(`❌ ${data.error || "Mensagem não enviada."}`); return; }
      setChatInput("");
      await loadChat(myRoom.code);
    } catch {
      setConnection("offline");
      setMessage("❌ Chat indisponível. Sua mensagem não foi enviada.");
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#1e293b,#0f172a_55%,#020617)] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4">
            <Link href="/" className="text-sm text-slate-400 hover:text-white">← Home</Link>
            <Link href="/play" className="text-sm text-slate-400 hover:text-white">Play</Link>
            <Link href="/friends" className="text-sm text-slate-400 hover:text-white">Amigos</Link>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold">
            <span className={connection === "online" ? "text-emerald-300" : connection === "offline" ? "text-red-300" : "text-amber-300"}>●</span>
            {identityName || playerName}
          </div>
        </div>

        <h1 className="mb-4 text-3xl font-black text-amber-300">⚔️ Batalha PvP</h1>

        {message && (
          <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            {message}
            <button className="ml-3 text-xs underline" onClick={() => setMessage("")}>dismiss</button>
          </div>
        )}

        {myRoom ? (
          <div className="rounded-2xl border-2 border-amber-400/40 bg-amber-500/10 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">Sala: {myRoom.code}</h2>
                <p className="text-sm text-slate-300">
                  Status: {myRoom.state === "waiting" ? "🕐 Aguardando oponente..." : "⚔️ Em jogo"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {myRoom.state === "playing" && (
                  <a
                    href={`/play?pvpRoom=${encodeURIComponent(myRoom.code)}`}
                    className="btn-primary"
                  >
                    ⚔️ Entrar na partida
                  </a>
                )}
                <button onClick={leaveRoom} className="btn-ghost">
                  🚪 Sair da Sala
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-slate-400">Host</p>
                <p className="font-bold">👑 {myRoom.hostName}</p>
                <p className="text-xs text-slate-500">Deck: {myRoom.hostDeck}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-slate-400">Guest</p>
                {myRoom.guestName ? (
                  <>
                    <p className="font-bold">🎮 {myRoom.guestName}</p>
                    <p className="text-xs text-slate-500">Deck: {myRoom.guestDeck}</p>
                  </>
                ) : (
                  <p className="italic text-slate-500">Aguardando...</p>
                )}
              </div>
            </div>

            {/* Chat */}
            <div className="mt-4 rounded-lg border border-white/10 bg-black/40 p-3">
              <h3 className="mb-2 text-xs font-bold text-slate-400">💬 Chat</h3>
              <div className="mb-2 max-h-40 space-y-1 overflow-y-auto text-sm">
                {chat.length === 0 ? (
                  <p className="italic text-slate-600">Sem mensagens ainda</p>
                ) : chat.map((c) => (
                  <div key={c.id} className={c.playerName === playerName ? "text-right" : ""}>
                    <span className="text-xs text-slate-500">{c.playerName}:</span>{" "}
                    <span>{c.message}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="input flex-1 !py-1 text-sm"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="Digite uma mensagem..."
                />
                <button onClick={sendChat} className="btn-primary !px-3 !py-1 text-xs">
                  Enviar
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {["gg!", "wp!", "gl hf!", "😎", "🔥", "😱", "🎉"].map((emote) => (
                  <button
                    key={emote}
                    onClick={() => setChatInput(emote)}
                    className="rounded bg-white/10 px-2 py-0.5 text-xs hover:bg-white/20"
                  >
                    {emote}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-3 text-center text-xs text-slate-500">
              Partida autoritativa · identidade protegida pela sessão · reconexão automática
            </p>
          </div>
        ) : (
          <>
            {/* Setup */}
            <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="mb-3 text-lg font-black text-amber-200">🛠️ Configuração</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-bold text-slate-400">
                  Identidade da sessão
                  <div className="input mt-1 cursor-not-allowed opacity-80">{identityName || playerName}</div>
                </label>
                <label className="text-xs font-bold text-slate-400">
                  Seu Deck
                  <select
                    className="input mt-1"
                    value={selectedDeck}
                    onChange={(e) => setSelectedDeck(e.target.value)}
                  >
                    {presetDecks.map((d) => (
                      <option key={d.id} value={d.id}>{d.emoji} {d.name}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <h3 className="text-lg font-black text-emerald-300">🏠 Criar Sala</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Crie uma sala e compartilhe o código com um amigo
                </p>
                <button onClick={createRoom} className="btn-primary mt-3 w-full">
                  ✨ Criar Nova Sala
                </button>
              </div>

              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                <h3 className="text-lg font-black text-cyan-300">🔑 Entrar por Código</h3>
                <p className="mt-1 text-xs text-slate-400">Digite o código de uma sala</p>
                <div className="mt-3 flex gap-2">
                  <input
                    className="input flex-1 font-mono uppercase"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    placeholder="ABC123"
                  />
                  <button
                    onClick={() => joinRoom(joinCode)}
                    disabled={joinCode.length < 4}
                    className="btn-primary disabled:opacity-30"
                  >
                    Entrar
                  </button>
                </div>
              </div>
            </div>

            {/* Public Rooms */}
            <section className="mt-6">
              <h2 className="mb-3 text-xl font-black text-amber-200">🌐 Salas Públicas</h2>
              {rooms.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-slate-500">
                  Nenhuma sala pública no momento
                </div>
              ) : (
                <div className="space-y-2">
                  {rooms.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
                      <div>
                        <p className="font-bold">👑 {r.hostName}</p>
                        <p className="text-xs text-slate-500">Deck oculto até o início · Código: <span className="font-mono">{r.code}</span></p>
                      </div>
                      <button
                        onClick={() => joinRoom(r.code)}
                        disabled={r.hostName === (identityName || playerName)}
                        className="rounded bg-emerald-600 px-3 py-1 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-30"
                      >
                        Entrar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
