"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
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
    <main className="rf-app-page">
      <SiteNav />
      <div className="rf-app-shell max-w-6xl">
        <header className="rf-app-heading">
          <div>
            <p className="rf-eyebrow"><span /> REDE DO NEXUS</p>
            <h1>Círculo de aliados</h1>
            <p>Encontre outros forjadores, acompanhe quem está online e lance desafios PvP diretamente da sua lista.</p>
          </div>
          <Link href="/pvp" className="rf-button rf-button-primary">⚔ ABRIR DUELO PVP</Link>
        </header>

        <section className="mb-6 grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] sm:items-end sm:p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300/70">Identidade ativa</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
              Sua identidade local é usada para sincronizar amizades, convites e desafios nesta sessão.
            </p>
          </div>
          <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Nome do jogador
            <input
              className="input mt-2 w-full"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onBlur={() => {
                void ensurePlayerSession(playerName).then((profile) => {
                  if (profile.player?.name) setPlayerName(String(profile.player.name));
                });
              }}
              autoComplete="nickname"
              aria-label="Nome do jogador ativo"
            />
          </label>
        </section>

        {message && (
          <div
            className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100"
            role="status"
            aria-live="polite"
          >
            <span>{message}</span>
            <button className="text-xs font-bold text-amber-200 underline underline-offset-4" onClick={() => setMessage("")}>Fechar</button>
          </div>
        )}

        <section className="mb-8 overflow-hidden rounded-2xl border border-emerald-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,.09),rgba(3,5,8,.64))] p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300/70">Expandir o círculo</p>
              <h2 className="mt-1 text-xl font-black text-slate-100">Adicionar um aliado</h2>
              <p className="mt-1 text-sm text-slate-400">Busque pelo nome exato do jogador e envie uma solicitação.</p>
            </div>
            <form
              className="flex w-full max-w-xl flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void addFriend();
              }}
            >
              <label className="sr-only" htmlFor="friend-name">Nome do jogador</label>
              <input
                id="friend-name"
                className="input min-w-0 flex-1"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Nome do jogador..."
                autoComplete="off"
              />
              <button type="submit" disabled={!addName.trim()} className="rf-button rf-button-primary disabled:cursor-not-allowed disabled:opacity-40">
                + ENVIAR SOLICITAÇÃO
              </button>
            </form>
          </div>
        </section>

        {!data ? (
          <section className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center" aria-busy="true" aria-live="polite">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-amber-300" aria-hidden="true" />
            <p className="font-bold text-slate-200">Sincronizando sua rede…</p>
            <p className="mt-1 text-sm text-slate-500">Consultando aliados e solicitações pendentes.</p>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="friends-heading">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Esquadrão</p>
                  <h2 id="friends-heading" className="mt-1 text-xl font-black text-slate-100">Meus amigos</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">{data.friends.length}</span>
              </div>
              <div className="space-y-2">
                {data.friends.length === 0 ? (
                  <EmptyState icon="◇" title="Seu círculo ainda está vazio" copy="Adicione um jogador acima para começar a montar sua rede no Nexus." />
                ) : data.friends.map((f) => (
                  <article key={f.id} className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 transition hover:border-amber-300/20 hover:bg-white/[0.055]">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/30 text-2xl" aria-hidden="true">
                        {f.avatar || "🎮"}
                        <span className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-[#080b10] ${f.online ? "bg-emerald-400" : "bg-slate-600"}`} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-100">{f.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Nível {f.level} · {f.mmr} MMR · <span className={f.online ? "text-emerald-300" : "text-slate-500"}>{f.online ? "Online" : "Offline"}</span>
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/pvp?friend=${encodeURIComponent(f.name)}`}
                      className="rf-button rf-button-secondary min-h-9 shrink-0 !px-3"
                      aria-label={`Desafiar ${f.name} para um duelo PvP`}
                    >
                      ⚔ DESAFIAR
                    </Link>
                  </article>
                ))}
              </div>
            </section>

            <section aria-labelledby="pending-heading">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Convites</p>
                  <h2 id="pending-heading" className="mt-1 text-xl font-black text-slate-100">Solicitações pendentes</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">{data.pending.length}</span>
              </div>
              <div className="space-y-2">
                {data.pending.length === 0 ? (
                  <EmptyState icon="◎" title="Nenhuma solicitação" copy="Novos convites aparecerão aqui quando outros jogadores encontrarem você." />
                ) : data.pending.map((p) => (
                  <article key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.055] p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-amber-300/15 bg-black/20 text-2xl" aria-hidden="true">{p.avatar || "🎮"}</span>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-100">{p.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">Nível {p.level}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        onClick={() => void accept(p.friendshipId)}
                        className="rounded-md border border-emerald-300/20 bg-emerald-500/15 px-2.5 py-2 text-[10px] font-black text-emerald-200 transition hover:bg-emerald-500/25"
                        aria-label={`Aceitar solicitação de ${p.name}`}
                      >
                        ✓ ACEITAR
                      </button>
                      <button
                        onClick={() => void reject(p.friendshipId)}
                        className="rounded-md border border-red-300/15 bg-red-500/10 px-2.5 py-2 text-[10px] font-black text-red-200 transition hover:bg-red-500/20"
                        aria-label={`Recusar solicitação de ${p.name}`}
                      >
                        ✕ RECUSAR
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {data.sent.length > 0 && (
                <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Aguardando resposta</h3>
                    <span className="text-xs text-slate-500">{data.sent.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {data.sent.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs">
                        <span aria-hidden="true">{s.avatar || "🎮"}</span>
                        <span className="font-semibold text-slate-300">{s.name}</span>
                        <span className="ml-auto text-slate-600">Pendente</span>
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

function EmptyState({ icon, title, copy }: { icon: string; title: string; copy: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center">
      <div className="text-3xl text-amber-200/70" aria-hidden="true">{icon}</div>
      <p className="mt-3 font-bold text-slate-300">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">{copy}</p>
    </div>
  );
}
