"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ensurePlayerSession } from "@/lib/client-player-session";

interface Friend {
  id: number;
  name: string;
  avatar: string | null;
  level: number;
  mmr: number;
  online: boolean;
}

interface Pending {
  id: number;
  name: string;
  avatar: string | null;
  level: number;
  friendshipId: number;
}

interface FriendsData {
  friends: Friend[];
  pending: Pending[];
  sent: { id: number; name: string; avatar: string | null }[];
}

export default function FriendsClient() {
  const [playerName, setPlayerName] = useState("");
  const [data, setData] = useState<FriendsData | null>(null);
  const [addName, setAddName] = useState("");
  const [message, setMessage] = useState("");

  useDeferredEffect(() => {
    const saved = localStorage.getItem("runeforge_playername");
    if (saved) setPlayerName(saved);
  }, []);

  const load = useCallback(async (name: string) => {
    const profile = await ensurePlayerSession(name);
    if (profile.player?.name) setPlayerName(String(profile.player.name));
    const res = await fetch(`/api/friends?name=${encodeURIComponent(name)}`);
    const d = await res.json();
    if (d.ok) setData(d);
  }, []);

  useDeferredEffect(() => {
    load(playerName);
  }, [playerName, load]);

  const addFriend = async () => {
    if (!addName.trim()) return;
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: playerName, targetName: addName, action: "add" }),
    });
    const d = await res.json();
    if (d.ok) {
      setMessage(`✅ Solicitação enviada para ${addName}`);
      setAddName("");
      await load(playerName);
    } else {
      setMessage(`❌ ${d.error}`);
    }
  };

  const accept = async (id: number) => {
    await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: playerName, action: "accept", friendshipId: id }),
    });
    await load(playerName);
  };

  const reject = async (id: number) => {
    await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: playerName, action: "reject", friendshipId: id }),
    });
    await load(playerName);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#1e293b,#0f172a_55%,#020617)] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4">
            <Link href="/" className="text-sm text-slate-400 hover:text-white">← Home</Link>
            <Link href="/pvp" className="text-sm text-slate-400 hover:text-white">PvP</Link>
            <Link href="/profile" className="text-sm text-slate-400 hover:text-white">Profile</Link>
          </div>
          <input
            className="input max-w-[180px]"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onBlur={() => { void ensurePlayerSession(playerName).then((profile) => { if (profile.player?.name) setPlayerName(String(profile.player.name)); }); }}
          />
        </div>

        <h1 className="mb-4 text-3xl font-black text-amber-300">👥 Amigos</h1>

        {message && (
          <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            {message}
            <button className="ml-3 text-xs underline" onClick={() => setMessage("")}>dismiss</button>
          </div>
        )}

        {/* Add Friend */}
        <section className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <h2 className="text-lg font-black text-emerald-300">➕ Adicionar Amigo</h2>
          <div className="mt-3 flex gap-2">
            <input
              className="input flex-1"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFriend()}
              placeholder="Nome do jogador..."
            />
            <button onClick={addFriend} disabled={!addName.trim()} className="btn-primary">
              Enviar Solicitação
            </button>
          </div>
        </section>

        {data && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Friends List */}
            <section>
              <h2 className="mb-3 text-xl font-black text-amber-200">
                🤝 Meus Amigos ({data.friends.length})
              </h2>
              <div className="space-y-2">
                {data.friends.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-500">
                    Nenhum amigo ainda. Adicione um!
                  </p>
                ) : data.friends.map((f) => (
                  <div key={f.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-3">
                      <span className="relative text-2xl">
                        {f.avatar || "🎮"}
                        {f.online && (
                          <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-slate-900 bg-emerald-400" />
                        )}
                      </span>
                      <div>
                        <p className="font-bold">{f.name}</p>
                        <p className="text-xs text-slate-500">
                          Lvl {f.level} · {f.mmr} MMR · {f.online ? "🟢 Online" : "⚫ Offline"}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/pvp?friend=${encodeURIComponent(f.name)}`}
                      className="rounded bg-cyan-600 px-3 py-1 text-xs font-bold hover:bg-cyan-500"
                    >
                      ⚔️ Desafiar
                    </Link>
                  </div>
                ))}
              </div>
            </section>

            {/* Pending Requests */}
            <section>
              <h2 className="mb-3 text-xl font-black text-amber-200">
                📬 Solicitações Pendentes ({data.pending.length})
              </h2>
              <div className="space-y-2">
                {data.pending.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-500">
                    Sem solicitações
                  </p>
                ) : data.pending.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{p.avatar || "🎮"}</span>
                      <div>
                        <p className="font-bold">{p.name}</p>
                        <p className="text-xs text-slate-500">Lvl {p.level}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => accept(p.friendshipId)}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs font-bold hover:bg-emerald-500"
                      >
                        ✓ Aceitar
                      </button>
                      <button
                        onClick={() => reject(p.friendshipId)}
                        className="rounded bg-red-600 px-2 py-1 text-xs font-bold hover:bg-red-500"
                      >
                        ✗ Rejeitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {data.sent.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-bold text-slate-400">Enviadas ({data.sent.length})</h3>
                  <div className="space-y-1">
                    {data.sent.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 rounded border border-white/10 bg-white/5 p-2 text-xs">
                        <span>{s.avatar || "🎮"}</span>
                        <span>{s.name}</span>
                        <span className="ml-auto text-slate-500">Aguardando...</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
