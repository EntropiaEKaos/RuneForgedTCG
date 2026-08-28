"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ACHIEVEMENTS, DAILY_QUESTS } from "@/lib/achievements";
import { ensurePlayerSession, renamePlayerDisplayName, rotatePlayerRecoveryCode, storedRecoveryCode } from "@/lib/client-player-session";

interface PlayerData {
  id: number;
  name: string;
  xp: number;
  level: number;
  gold: number;
  dust: number;
  currentLevelXp: number;
  nextLevelXp: number;
  createdAt: string;
}

interface AchievementProgress {
  achievementId: string;
  progress: number;
  completed: boolean;
  claimedAt: string | null;
  def?: (typeof ACHIEVEMENTS)[number];
}

interface DailyProgress {
  questId: string;
  progress: number;
  completed: boolean;
  claimedAt: string | null;
  expiresAt: string;
  def?: (typeof DAILY_QUESTS)[number];
}

interface Stats {
  matches: number;
  wins: number;
  customDecks: number;
  uniqueCards: number;
}

interface SharedDeck {
  id: number;
  name: string;
  description: string;
  region1: string;
  region2: string | null;
  archetype: string;
  upvotes: number;
  downloads: number;
  createdAt: string;
}

export default function ProfileClient() {
  const [playerName, setPlayerName] = useState("");
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [achievements, setAchievements] = useState<AchievementProgress[]>([]);
  const [dailies, setDailies] = useState<DailyProgress[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sharedDecks, setSharedDecks] = useState<SharedDeck[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  useDeferredEffect(() => {
    const saved = localStorage.getItem("runeforge_playername");
    if (saved) setPlayerName(saved);
    setRecoveryCode(storedRecoveryCode());
  }, []);

  const loadProfile = useCallback(async (name: string) => {
    setLoading(true);
    try {
      const data = await ensurePlayerSession(name);
      if (data.ok && data.player) {
        setPlayerName(String(data.player.name));
        setPlayer(data.player as unknown as PlayerData);
        setAchievements(Array.isArray(data.achievements) ? data.achievements as AchievementProgress[] : []);
        setDailies(Array.isArray(data.dailies) ? data.dailies as DailyProgress[] : []);
        setStats(data.stats && typeof data.stats === "object" ? data.stats as unknown as Stats : null);
        setSharedDecks(Array.isArray(data.sharedDecks) ? data.sharedDecks as SharedDeck[] : []);
        setRecoveryCode(storedRecoveryCode());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    loadProfile(playerName);
  }, [playerName, loadProfile]);

  const claimDailies = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/dailies/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: playerName }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.claimed.length > 0) {
          setMessage(
            `🎉 Recompensa: +${data.rewards.gold}🪙 +${data.rewards.dust}💠 +${data.rewards.xp}XP`,
          );
        } else {
          setMessage("Missões diárias atualizadas!");
        }
        await loadProfile(playerName);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveName = async () => {
    const result = await renamePlayerDisplayName(playerName);
    if (!result.ok) { setMessage(result.error || "Não foi possível alterar o nome."); return; }
    if (result.player?.name) { setPlayerName(result.player.name); setPlayer((current) => current ? { ...current, name: String(result.player!.name) } : current); }
    setMessage("Nome atualizado.");
  };

  const rotateRecovery = async () => {
    const result = await rotatePlayerRecoveryCode();
    if (!result.ok || !result.recoveryCode) { setMessage(result.error || "Não foi possível gerar nova chave."); return; }
    setRecoveryCode(result.recoveryCode);
    setMessage("Nova chave gerada. A chave anterior deixou de funcionar.");
  };

  const winRate = stats && stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;
  const xpPct = player ? (player.currentLevelXp / player.nextLevelXp) * 100 : 0;

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#1e293b,#0f172a_55%,#020617)] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
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
            <Link href="/community" className="text-sm text-slate-400 hover:text-white">
              Community
            </Link>
          </div>
          <div className="flex gap-2">
            <input
              className="input max-w-[180px]"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onBlur={saveName}
              placeholder="Your name"
            />
          </div>
        </div>

        <h1 className="mb-4 text-3xl font-black text-amber-300">👤 Meu Perfil</h1>

        {message && (
          <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            {message}
            <button className="ml-3 text-xs underline" onClick={() => setMessage("")}>
              dismiss
            </button>
          </div>
        )}

        {player && (
          <>
            {recoveryCode && (
              <div className="mb-4 rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-cyan-200">Chave de recuperação da conta</p>
                    <p className="mt-1 text-xs text-slate-400">Guarde esta chave fora do navegador. Ela recupera seu progresso em outro dispositivo.</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary !px-3 !py-1 text-xs" onClick={async () => { await navigator.clipboard?.writeText(recoveryCode); setMessage("Chave de recuperação copiada."); }}>Copiar chave</button>
                    <button type="button" className="btn-ghost !px-3 !py-1 text-xs" onClick={rotateRecovery}>Gerar nova</button>
                  </div>
                </div>
                <code className="mt-3 block select-all break-all rounded bg-black/20 px-3 py-2 text-xs text-cyan-100">{recoveryCode}</code>
              </div>
            )}

            {/* Player Card */}
            <div className="mb-6 rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 to-transparent p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">🎮</span>
                    <div>
                      <h2 className="text-2xl font-black text-white">{player.name}</h2>
                      <p className="text-xs text-slate-400">
                        Membro desde {new Date(player.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-300">Level {player.level}</span>
                      <span className="text-slate-400">
                        {player.currentLevelXp} / {player.nextLevelXp} XP
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-64 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-400"
                        style={{ width: `${xpPct}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                  <div className="rounded-lg bg-white/5 px-4 py-2">
                    <p className="text-xs text-slate-400">Gold</p>
                    <p className="text-xl font-black text-amber-300">🪙 {player.gold}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 px-4 py-2">
                    <p className="text-xs text-slate-400">Dust</p>
                    <p className="text-xl font-black text-cyan-300">💠 {player.dust}</p>
                  </div>
                  {stats && (
                    <>
                      <div className="rounded-lg bg-white/5 px-4 py-2">
                        <p className="text-xs text-slate-400">Partidas</p>
                        <p className="text-xl font-black">{stats.matches}</p>
                      </div>
                      <div className="rounded-lg bg-white/5 px-4 py-2">
                        <p className="text-xs text-slate-400">Vitórias</p>
                        <p className="text-xl font-black text-emerald-300">
                          {stats.wins} ({winRate}%)
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Dailies */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xl font-black text-amber-200">📅 Missões Diárias</h2>
                  <button
                    onClick={claimDailies}
                    disabled={loading}
                    className="btn-primary !px-3 !py-1 text-xs"
                  >
                    {dailies.some((d) => d.completed && !d.claimedAt) ? "🎁 Coletar" : "🔄 Atualizar"}
                  </button>
                </div>
                <div className="space-y-2">
                  {dailies.length === 0 ? (
                    <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center text-xs text-slate-500">
                      Clique em &quot;Atualizar&quot; para gerar missões diárias
                    </p>
                  ) : (
                    dailies.map((d) => {
                      const def = d.def;
                      if (!def) return null;
                      const pct = Math.min(100, (d.progress / def.requirement) * 100);
                      return (
                        <div
                          key={d.questId}
                          className={`rounded-xl border p-3 ${
                            d.completed
                              ? d.claimedAt
                                ? "border-emerald-500/30 bg-emerald-500/5 opacity-60"
                                : "border-amber-500/50 bg-amber-500/10 shadow-lg shadow-amber-500/10"
                              : "border-white/10 bg-white/[0.02]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{def.icon}</span>
                              <div>
                                <p className="text-sm font-bold">{def.name}</p>
                                <p className="text-[10px] text-slate-400">{def.description}</p>
                              </div>
                            </div>
                            <div className="text-right text-xs">
                              <p className="text-slate-300">
                                {d.progress}/{def.requirement}
                              </p>
                              <p className="text-amber-300">
                                +{def.rewardGold}🪙 +{def.rewardDust}💠
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={`h-full ${d.completed ? "bg-emerald-400" : "bg-amber-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {/* Achievements */}
              <section>
                <h2 className="mb-3 text-xl font-black text-amber-200">🏆 Conquistas</h2>
                <div className="space-y-2">
                  {ACHIEVEMENTS.map((ach) => {
                    const progress = achievements.find((a) => a.achievementId === ach.id);
                    const current = progress?.progress ?? 0;
                    const completed = progress?.completed ?? false;
                    const pct = Math.min(100, (current / ach.requirement) * 100);
                    return (
                      <div
                        key={ach.id}
                        className={`rounded-xl border p-3 ${
                          completed
                            ? "border-amber-500/40 bg-amber-500/10"
                            : "border-white/10 bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-xl ${completed ? "" : "grayscale opacity-50"}`}>
                              {ach.icon}
                            </span>
                            <div>
                              <p className="text-sm font-bold">
                                {ach.name} {completed && "✓"}
                              </p>
                              <p className="text-[10px] text-slate-400">{ach.description}</p>
                            </div>
                          </div>
                          <div className="text-right text-xs">
                            <p className="text-slate-300">
                              {current}/{ach.requirement}
                            </p>
                            <p className="text-amber-300">+{ach.rewardGold}🪙</p>
                          </div>
                        </div>
                        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full ${completed ? "bg-amber-400" : "bg-slate-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Shared Decks */}
            {sharedDecks.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-3 text-xl font-black text-amber-200">📜 Meus Decks Compartilhados</h2>
                <div className="grid gap-2 md:grid-cols-2">
                  {sharedDecks.map((d) => (
                    <div key={d.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold">{d.name}</p>
                          <p className="text-xs text-slate-500">
                            {d.region1}
                            {d.region2 && ` + ${d.region2}`} · {d.archetype}
                          </p>
                        </div>
                        <div className="text-right text-xs">
                          <p>👍 {d.upvotes}</p>
                          <p className="text-slate-500">⬇️ {d.downloads}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {!player && !loading && (
          <p className="py-12 text-center text-slate-500">Digite seu nome para carregar o perfil</p>
        )}
      </div>
    </main>
  );
}
