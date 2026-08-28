"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ensurePlayerSession } from "@/lib/client-player-session";
import { PRESET_DECK_OPTIONS } from "@/game/preset-deck-options";

interface DeckOption {
  id: string;
  name: string;
  emoji: string;
}

interface PvpRoom {
  id: number;
  code: string;
  hostName: string;
  hostDeck: string | null;
  guestName: string | null;
  guestDeck: string | null;
  state: string;
  mode?: string;
  viewerSide?: "host" | "guest" | null;
  createdAt: string;
  updatedAt?: string;
}

interface ChatMessage {
  id: number;
  playerName: string;
  message: string;
  createdAt: string;
}

type ConnectionState = "connecting" | "online" | "offline";
type BusyAction = "create" | "join" | "leave" | "chat" | null;

function isDeckOption(value: unknown): value is DeckOption {
  if (!value || typeof value !== "object") return false;
  const deck = value as Record<string, unknown>;
  return typeof deck.id === "string" && typeof deck.name === "string" && typeof deck.emoji === "string";
}

function isPvpRoom(value: unknown): value is PvpRoom {
  if (!value || typeof value !== "object") return false;
  const room = value as Record<string, unknown>;
  return Number.isInteger(room.id)
    && typeof room.code === "string"
    && typeof room.hostName === "string"
    && typeof room.state === "string"
    && typeof room.createdAt === "string";
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return Number.isInteger(item.id)
    && typeof item.playerName === "string"
    && typeof item.message === "string"
    && typeof item.createdAt === "string";
}

function roomAge(createdAt: string): string {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return "agora";
  const minutes = Math.max(0, Math.floor((Date.now() - created) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes === 1) return "há 1 min";
  return `há ${minutes} min`;
}

export default function PvpClient() {
  const [identityName, setIdentityName] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState(PRESET_DECK_OPTIONS[0].id);
  const [presetDecks, setPresetDecks] = useState<DeckOption[]>([...PRESET_DECK_OPTIONS]);
  const [joinCode, setJoinCode] = useState("");
  const [rooms, setRooms] = useState<PvpRoom[]>([]);
  const [myRoom, setMyRoom] = useState<PvpRoom | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [lobbyLoaded, setLobbyLoaded] = useState(false);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);

  useEffect(() => {
    const room = new URLSearchParams(window.location.search).get("room");
    if (room) window.location.replace(`/play?pvpRoom=${encodeURIComponent(room)}`);
  }, []);

  useDeferredEffect(() => {
    const saved = localStorage.getItem("runeforge_playername") || "";
    void ensurePlayerSession(saved)
      .then((profile) => {
        if (profile.ok && profile.player?.name) setIdentityName(String(profile.player.name));
        else setMessage(profile.error ? `❌ ${profile.error}` : "❌ Não foi possível iniciar sua sessão de jogador.");
      })
      .catch(() => setMessage("❌ Não foi possível iniciar sua sessão de jogador."))
      .finally(() => setSessionReady(true));
  }, []);

  useEffect(() => {
    fetch("/api/catalog", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: unknown) => {
        if (!data || typeof data !== "object") return;
        const payload = data as { ok?: boolean; decks?: unknown[] };
        if (!payload.ok || !Array.isArray(payload.decks)) return;
        const decks = payload.decks.filter(isDeckOption);
        if (!decks.length) return;
        setPresetDecks(decks);
        setSelectedDeck((current) => decks.some((deck) => deck.id === current) ? current : decks[0].id);
      })
      .catch(() => {});
  }, []);

  // Once the room transitions from "waiting" to "playing", automatically
  // enter GameClient's server-authoritative PvP transport. Keep this redirect
  // coupled to the authoritative room state rather than a client-side guess.
  const enteredMatchRef = useRef<string | null>(null);
  useEffect(() => {
    if (myRoom?.state === "playing" && myRoom.code && enteredMatchRef.current !== myRoom.code) {
      enteredMatchRef.current = myRoom.code;
      window.location.replace(`/play?pvpRoom=${encodeURIComponent(myRoom.code)}`);
    }
  }, [myRoom?.state, myRoom?.code]);

  const loadChat = useCallback(async (code: string) => {
    try {
      const res = await fetch(`/api/pvp/${encodeURIComponent(code)}`, { cache: "no-store" });
      const data: unknown = await res.json().catch(() => null);
      if (!data || typeof data !== "object") return;
      const payload = data as { ok?: boolean; chat?: unknown[] };
      if (payload.ok && Array.isArray(payload.chat)) setChat(payload.chat.filter(isChatMessage));
    } catch {
      setConnection("offline");
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/pvp", { cache: "no-store" });
      const data: unknown = await res.json().catch(() => null);
      if (!data || typeof data !== "object") throw new Error("Invalid lobby response");
      const payload = data as { ok?: boolean; error?: string; playerName?: string | null; rooms?: unknown[]; myRoom?: unknown };
      if (!res.ok || !payload.ok) throw new Error(payload.error || "Lobby unavailable");

      setConnection("online");
      if (payload.playerName) setIdentityName(payload.playerName);
      setRooms(Array.isArray(payload.rooms) ? payload.rooms.filter(isPvpRoom) : []);
      const nextMyRoom = isPvpRoom(payload.myRoom) ? payload.myRoom : null;
      setMyRoom(nextMyRoom);
      if (nextMyRoom) void loadChat(nextMyRoom.code);
      else setChat([]);
      setLobbyLoaded(true);
    } catch {
      setConnection("offline");
      setLobbyLoaded(true);
      setMessage((current) => current || "⚠️ Lobby offline. A reconexão automática continua ativa.");
    }
  }, [loadChat]);

  useDeferredEffect(() => {
    if (!sessionReady) return;
    void load();
    const timer = window.setInterval(() => { void load(); }, 3000);
    return () => window.clearInterval(timer);
  }, [sessionReady, load]);

  const selectedDeckLabel = useMemo(() => {
    const deck = presetDecks.find((item) => item.id === selectedDeck);
    return deck ? `${deck.emoji} ${deck.name}` : selectedDeck;
  }, [presetDecks, selectedDeck]);

  const createRoom = async () => {
    if (busyAction) return;
    setBusyAction("create");
    try {
      const res = await fetch("/api/pvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostDeck: selectedDeck }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setMessage(`✅ Sala criada. Código ${data.room.code}.`);
        await load();
      } else setMessage(`❌ ${data.error || "Não foi possível criar a sala."}`);
    } catch {
      setConnection("offline");
      setMessage("❌ Não foi possível criar a sala. Verifique sua conexão.");
    } finally {
      setBusyAction(null);
    }
  };

  const joinRoom = async (code: string) => {
    if (busyAction) return;
    const normalized = code.trim().toUpperCase();
    if (normalized.length < 4) return;
    setBusyAction("join");
    try {
      const res = await fetch(`/api/pvp/${encodeURIComponent(normalized)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", guestDeck: selectedDeck }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setMessage("✅ Entrada confirmada pelo servidor. Preparando partida…");
        setJoinCode("");
        await load();
      } else setMessage(`❌ ${data.error || "Não foi possível entrar na sala."}`);
    } catch {
      setConnection("offline");
      setMessage("❌ Não foi possível entrar na sala.");
    } finally {
      setBusyAction(null);
    }
  };

  const leaveRoom = async () => {
    if (!myRoom || busyAction) return;
    setBusyAction("leave");
    try {
      const response = await fetch(`/api/pvp/${encodeURIComponent(myRoom.code)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        setMessage(`❌ ${data.error || "Não foi possível sair da sala."}`);
        return;
      }
      setMyRoom(null);
      setChat([]);
      setMessage(myRoom.state === "waiting" ? "Sala cancelada com segurança." : "Saída registrada pelo servidor.");
      await load();
    } catch {
      setConnection("offline");
      setMessage("❌ Falha de conexão ao sair da sala.");
    } finally {
      setBusyAction(null);
    }
  };

  const sendChat = async () => {
    if (!myRoom || !chatInput.trim() || busyAction === "chat") return;
    setBusyAction("chat");
    try {
      const response = await fetch(`/api/pvp/${encodeURIComponent(myRoom.code)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chat", message: chatInput }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        setMessage(`❌ ${data.error || "Mensagem não enviada."}`);
        return;
      }
      setChatInput("");
      await loadChat(myRoom.code);
    } catch {
      setConnection("offline");
      setMessage("❌ Chat indisponível. Sua mensagem não foi enviada.");
    } finally {
      setBusyAction(null);
    }
  };

  const copyRoomCode = async () => {
    if (!myRoom?.code) return;
    try {
      await navigator.clipboard.writeText(myRoom.code);
      setMessage(`📋 Código ${myRoom.code} copiado.`);
    } catch {
      setMessage(`Código da sala: ${myRoom.code}`);
    }
  };

  const connectionLabel = connection === "online" ? "Lobby sincronizado" : connection === "offline" ? "Reconectando" : "Conectando";

  return (
    <main className="rf-app-page">
      <SiteNav />
      <div className="rf-app-shell">
        <header className="rf-app-heading">
          <div>
            <p className="rf-eyebrow"><span /> DUELO DO NEXUS</p>
            <h1>PvP casual</h1>
            <p>Crie ou encontre uma sala. O servidor valida identidade, decks e transições antes de a partida começar.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/friends" className="btn-ghost">Amigos</Link>
            <Link href="/ranked" className="btn-ghost">Ranked</Link>
          </div>
        </header>

        <section className="mb-5 grid gap-3 sm:grid-cols-3" aria-label="Estado do lobby PvP">
          <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
            <small className="font-black uppercase tracking-[.16em] text-slate-500">Sessão</small>
            <strong className="mt-1 block text-lg text-white">{identityName || (sessionReady ? "Jogador" : "Iniciando…")}</strong>
            <span className="text-xs text-slate-400">Identidade estável do servidor</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
            <small className="font-black uppercase tracking-[.16em] text-slate-500">Conexão</small>
            <strong className={connection === "online" ? "mt-1 block text-lg text-emerald-300" : connection === "offline" ? "mt-1 block text-lg text-amber-300" : "mt-1 block text-lg text-slate-200"}>
              {connection === "online" ? "● " : connection === "offline" ? "◌ " : "○ "}{connectionLabel}
            </strong>
            <span className="text-xs text-slate-400">Polling autoritativo a cada 3 s</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
            <small className="font-black uppercase tracking-[.16em] text-slate-500">Salas abertas</small>
            <strong className="mt-1 block text-lg text-white">{lobbyLoaded ? rooms.length : "—"}</strong>
            <span className="text-xs text-slate-400">Deck adversário oculto no lobby</span>
          </div>
        </section>

        {message && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[.07] px-4 py-3 text-sm text-amber-100" role="status" aria-live="polite">
            <span>{message}</span>
            <button className="text-xs font-bold text-amber-200/70 hover:text-amber-100" onClick={() => setMessage("")}>Fechar</button>
          </div>
        )}

        {!sessionReady || !lobbyLoaded ? (
          <section className="rounded-3xl border border-white/10 bg-white/[.025] p-10 text-center">
            <div className="text-4xl">⚔️</div>
            <h2 className="mt-3 text-xl font-black text-white">Sincronizando lobby</h2>
            <p className="mt-2 text-sm text-slate-400">Estabelecendo sua sessão e consultando salas autoritativas.</p>
          </section>
        ) : myRoom ? (
          <section className="rounded-3xl border border-amber-300/20 bg-amber-300/[.055] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.18em] text-amber-300/70">Sua sala</p>
                <h2 className="mt-1 font-mono text-3xl font-black tracking-[.14em] text-amber-100">{myRoom.code}</h2>
                <p className="mt-1 text-sm text-slate-300">
                  {myRoom.state === "waiting" ? "Aguardando um segundo jogador." : "O servidor iniciou a partida; entrando no campo de batalha."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={copyRoomCode} className="btn-ghost">Copiar código</button>
                {myRoom.state === "playing" && (
                  <a href={`/play?pvpRoom=${encodeURIComponent(myRoom.code)}`} className="btn-primary">Entrar na partida</a>
                )}
                <button onClick={leaveRoom} className="btn-ghost" disabled={busyAction === "leave"}>
                  {busyAction === "leave" ? "Processando…" : myRoom.state === "waiting" ? "Cancelar sala" : "Sair da partida"}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <small className="font-black uppercase tracking-[.16em] text-slate-500">Host</small>
                <h3 className="mt-1 text-lg font-black text-white">👑 {myRoom.hostName}</h3>
                <p className="mt-1 text-xs text-slate-400">Deck {myRoom.hostDeck || "protegido"}</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <small className="font-black uppercase tracking-[.16em] text-slate-500">Convidado</small>
                {myRoom.guestName ? (
                  <>
                    <h3 className="mt-1 text-lg font-black text-white">🎮 {myRoom.guestName}</h3>
                    <p className="mt-1 text-xs text-slate-400">Deck {myRoom.guestDeck || "protegido"}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Nenhum oponente conectado ainda.</p>
                )}
              </article>
            </div>

            <section className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4" aria-label="Chat da sala">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <small className="font-black uppercase tracking-[.16em] text-slate-500">Chat da sala</small>
                  <p className="mt-1 text-xs text-slate-400">Mensagens passam pela moderação e rate limit do servidor.</p>
                </div>
                <span className="text-xs text-slate-500">{chat.length}/30 recentes</span>
              </div>
              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-white/5 bg-black/20 p-3 text-sm" aria-live="polite">
                {chat.length === 0 ? (
                  <p className="py-4 text-center text-sm italic text-slate-600">Sem mensagens ainda.</p>
                ) : chat.map((item) => (
                  <div key={item.id} className={item.playerName === identityName ? "text-right" : "text-left"}>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.playerName}</span>
                    <p className={item.playerName === identityName ? "ml-auto mt-0.5 w-fit max-w-[85%] rounded-xl bg-cyan-400/10 px-3 py-1.5 text-slate-100" : "mt-0.5 w-fit max-w-[85%] rounded-xl bg-white/[.06] px-3 py-1.5 text-slate-200"}>{item.message}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className="input flex-1"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") void sendChat(); }}
                  placeholder="Mensagem para o oponente…"
                  aria-label="Mensagem do chat PvP"
                />
                <button onClick={sendChat} className="btn-primary" disabled={!chatInput.trim() || busyAction === "chat"}>
                  {busyAction === "chat" ? "Enviando…" : "Enviar"}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {["gg!", "wp!", "gl hf!", "😎", "🔥", "😱", "🎉"].map((emote) => (
                  <button key={emote} onClick={() => setChatInput(emote)} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/[.06]">{emote}</button>
                ))}
              </div>
            </section>

            <p className="mt-4 text-center text-xs text-slate-500">Sala autoritativa · identidade estável · reconexão automática · transições versionadas no servidor</p>
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Loadout casual</p>
                  <h2 className="mt-1 text-xl font-black text-white">Escolha seu deck antes de entrar</h2>
                  <p className="mt-1 text-sm text-slate-400">O servidor valida propriedade e formato novamente ao criar ou entrar em uma sala.</p>
                </div>
                <label className="w-full max-w-sm text-xs font-bold text-slate-400">
                  Deck selecionado
                  <select className="input mt-1" value={selectedDeck} onChange={(event) => setSelectedDeck(event.target.value)} disabled={busyAction !== null}>
                    {presetDecks.map((deck) => <option key={deck.id} value={deck.id}>{deck.emoji} {deck.name}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <article className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[.05] p-5">
                <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-300/70">Hospedar</p>
                <h2 className="mt-1 text-xl font-black text-white">Criar sala</h2>
                <p className="mt-2 text-sm text-slate-400">Abra uma sala pública com {selectedDeckLabel}. O código pode ser compartilhado diretamente com um amigo.</p>
                <button onClick={createRoom} className="btn-primary mt-5 w-full" disabled={busyAction !== null || connection === "offline"}>
                  {busyAction === "create" ? "Criando…" : "Criar nova sala"}
                </button>
              </article>

              <article className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[.05] p-5">
                <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-300/70">Convite</p>
                <h2 className="mt-1 text-xl font-black text-white">Entrar por código</h2>
                <p className="mt-2 text-sm text-slate-400">Use o código de seis caracteres enviado pelo host. A entrada só é confirmada após validação do servidor.</p>
                <div className="mt-5 flex gap-2">
                  <input
                    className="input flex-1 font-mono uppercase tracking-[.12em]"
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                    maxLength={6}
                    placeholder="ABC123"
                    aria-label="Código da sala PvP"
                  />
                  <button onClick={() => void joinRoom(joinCode)} disabled={joinCode.length < 4 || busyAction !== null || connection === "offline"} className="btn-primary">Entrar</button>
                </div>
              </article>
            </div>

            <section className="mt-6">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Match browser</p>
                  <h2 className="mt-1 text-xl font-black text-white">Salas públicas</h2>
                </div>
                <span className="text-xs text-slate-500">Atualização automática a cada 3 s</span>
              </div>
              {rooms.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[.02] p-8 text-center">
                  <div className="text-3xl">🌐</div>
                  <p className="mt-2 text-sm font-bold text-slate-300">Nenhuma sala esperando oponente.</p>
                  <p className="mt-1 text-xs text-slate-500">Você pode criar a primeira sala ou entrar com um código privado.</p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {rooms.map((room) => {
                    const ownRoom = room.hostName === identityName;
                    return (
                      <article key={room.id} className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Sala {room.code}</p>
                            <h3 className="mt-1 font-black text-white">👑 {room.hostName}</h3>
                            <p className="mt-1 text-xs text-slate-500">Criada {roomAge(room.createdAt)} · deck oculto até a entrada</p>
                          </div>
                          <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[.07] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-300">Esperando</span>
                        </div>
                        <button onClick={() => void joinRoom(room.code)} disabled={ownRoom || busyAction !== null || connection === "offline"} className="btn-ghost mt-4 w-full">
                          {ownRoom ? "Sua sala" : busyAction === "join" ? "Entrando…" : "Entrar nesta sala"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
