"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ACHIEVEMENTS, DAILY_QUESTS } from "@/lib/achievements";
import {
  ensurePlayerSession,
  renamePlayerDisplayName,
  rotatePlayerRecoveryCode,
  storedRecoveryCode,
} from "@/lib/client-player-session";

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
  const [nameInput, setNameInput] = useState("");
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [achievements, setAchievements] = useState<AchievementProgress[]>([]);
  const [dailies, setDailies] = useState<DailyProgress[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sharedDecks, setSharedDecks] = useState<SharedDeck[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [showRecoveryCode, setShowRecoveryCode] = useState(false);

  useDeferredEffect(() => {
    const saved = localStorage.getItem("runeforge_playername") || "";
    setPlayerName(saved);
    setNameInput(saved);
    setRecoveryCode(storedRecoveryCode());
  }, []);

  const loadProfile = useCallback(async (name: string) => {
    setLoading(true);
    try {
      const data = await ensurePlayerSession(name);
      if (data.ok && data.player) {
        const resolvedName = String(data.player.name);
        setPlayerName(resolvedName);
        setNameInput(resolvedName);
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
    void loadProfile(playerName);
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
          setMessage(`🎉 Recompensa: +${data.rewards.gold}🪙 +${data.rewards.dust}💠 +${data.rewards.xp}XP`);
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
    const nextName = nameInput.trim();
    if (!nextName || nextName === player?.name) return;
    setLoading(true);
    try {
      const result = await renamePlayerDisplayName(nextName);
      if (!result.ok) {
        setMessage(result.error || "Não foi possível alterar o nome.");
        return;
      }
      if (result.player?.name) {
        const resolvedName = String(result.player.name);
        setPlayerName(resolvedName);
        setNameInput(resolvedName);
        setPlayer((current) => current ? { ...current, name: resolvedName } : current);
      }
      setMessage("Nome atualizado.");
    } finally {
      setLoading(false);
    }
  };

  const rotateRecovery = async () => {
    setLoading(true);
    try {
      const result = await rotatePlayerRecoveryCode();
      if (!result.ok || !result.recoveryCode) {
        setMessage(result.error || "Não foi possível gerar nova chave.");
        return;
      }
      setRecoveryCode(result.recoveryCode);
      setShowRecoveryCode(true);
      setMessage("Nova chave gerada. A chave anterior deixou de funcionar.");
    } finally {
      setLoading(false);
    }
  };

  const copyRecovery = async () => {
    if (!recoveryCode) return;
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setMessage("Chave de recuperação copiada.");
    } catch {
      setMessage("Não foi possível copiar a chave automaticamente.");
    }
  };

  const winRate = stats && stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;
  const xpPct = player && player.nextLevelXp > 0
    ? Math.min(100, Math.max(0, (player.currentLevelXp / player.nextLevelXp) * 100))
    : 0;
  const completedAchievements = achievements.filter((achievement) => achievement.completed).length;
  const claimableDailies = dailies.filter((daily) => daily.completed && !daily.claimedAt).length;

  return (
    <main className="rf-app-page">
      <SiteNav />
      <div className="rf-app-shell max-w-6xl">
        <header className="rf-app-heading">
          <div>
            <p className="rf-eyebrow"><span /> IDENTIDADE DO FORJADOR</p>
            <h1>Perfil do Nexus</h1>
            <p>Acompanhe sua progressão, proteja o acesso à conta e transforme cada batalha em reputação dentro da forja.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/friends" className="rf-button rf-button-secondary">◎ ALIADOS</Link>
            <Link href="/leaderboard" className="rf-button rf-button-primary">◇ HALL DO NEXUS</Link>
          </div>
        </header>

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

        {!player && loading && (
          <section className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center" aria-busy="true" aria-live="polite">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-amber-300" aria-hidden="true" />
            <p className="font-bold text-slate-200">Sincronizando seu perfil…</p>
            <p className="mt-1 text-sm text-slate-500">Carregando progressão, missões e credenciais locais.</p>
          </section>
        )}

        {player && (
          <>
            <section className="relative mb-6 overflow-hidden rounded-2xl border border-amber-300/20 bg-[radial-gradient(circle_at_12%_15%,rgba(217,164,65,.13),transparent_28rem),linear-gradient(145deg,rgba(255,255,255,.04),rgba(255,255,255,.012))] p-5 sm:p-6">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/45 to-transparent" aria-hidden="true" />
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-4">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-amber-300/20 bg-black/30 text-3xl shadow-[0_0_30px_rgba(217,164,65,.08)]" aria-hidden="true">◆</span>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300/65">FORJADOR ATIVO</p>
                      <h2 className="mt-1 truncate text-2xl font-black text-slate-50">{player.name}</h2>
                      <p className="mt-1 text-xs text-slate-500">Membro desde {new Date(player.createdAt).toLocaleDateString("pt-BR")}</p>
                    </div>
                  </div>

                  <form
                    className="mt-5 flex max-w-xl flex-col gap-2 sm:flex-row"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveName();
                    }}
                  >
                    <label className="sr-only" htmlFor="profile-display-name">Nome público do jogador</label>
                    <input
                      id="profile-display-name"
                      className="input min-w-0 flex-1"
                      value={nameInput}
                      onChange={(event) => setNameInput(event.target.value)}
                      placeholder="Nome do jogador"
                      autoComplete="nickname"
                    />
                    <button
                      type="submit"
                      className="rf-button rf-button-secondary min-h-10 !px-4"
                      disabled={loading || !nameInput.trim() || nameInput.trim() === player.name}
                    >
                      SALVAR NOME
                    </button>
                  </form>

                  <div className="mt-5 max-w-xl">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-black uppercase tracking-[0.12em] text-amber-200">Nível {player.level}</span>
                      <span className="text-slate-500">{player.currentLevelXp} / {player.nextLevelXp} XP</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full border border-white/[0.06] bg-black/35" role="progressbar" aria-label="Progresso para o próximo nível" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(xpPct)}>
                      <div className="h-full bg-gradient-to-r from-amber-600 via-amber-300 to-yellow-100 shadow-[0_0_12px_rgba(251,191,36,.25)]" style={{ width: `${xpPct}%` }} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[440px] lg:grid-cols-2">
                  <Metric label="Ouro" value={player.gold} icon="🪙" tone="text-amber-200" />
                  <Metric label="Pó arcano" value={player.dust} icon="💠" tone="text-cyan-200" />
                  <Metric label="Partidas" value={stats?.matches ?? 0} icon="⚔" tone="text-slate-100" />
                  <Metric label="Vitórias" value={stats ? `${stats.wins} · ${winRate}%` : "0"} icon="◇" tone="text-emerald-200" />
                </div>
              </div>
            </section>

            {recoveryCode && (
              <section className="mb-8 rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,.07),rgba(3,5,8,.58))] p-5" aria-labelledby="recovery-heading">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-300/65">SEGURANÇA DA CONTA</p>
                    <h2 id="recovery-heading" className="mt-1 text-xl font-black text-slate-100">Chave de recuperação</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">Guarde esta chave fora do navegador. Ela permite recuperar seu progresso em outro dispositivo. Não compartilhe a chave com outros jogadores.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="rf-button rf-button-secondary min-h-9 !px-3" onClick={() => setShowRecoveryCode((visible) => !visible)}>
                      {showRecoveryCode ? "OCULTAR" : "MOSTRAR"}
                    </button>
                    <button type="button" className="rf-button rf-button-secondary min-h-9 !px-3" onClick={() => void copyRecovery()}>
                      COPIAR
                    </button>
                    <button type="button" className="rf-button rf-button-secondary min-h-9 !px-3" disabled={loading} onClick={() => void rotateRecovery()}>
                      GERAR NOVA
                    </button>
                  </div>
                </div>
                <code className="mt-4 block min-h-10 select-all break-all rounded-lg border border-white/[0.07] bg-black/30 px-3 py-2.5 text-xs text-cyan-100" aria-label={showRecoveryCode ? "Chave de recuperação visível" : "Chave de recuperação oculta"}>
                  {showRecoveryCode ? recoveryCode : "•••••••• •••••••• •••••••• ••••••••"}
                </code>
              </section>
            )}

            <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumo de progressão">
              <SummaryCard label="Conquistas" value={`${completedAchievements}/${ACHIEVEMENTS.length}`} copy="marcos concluídos" />
              <SummaryCard label="Missões prontas" value={claimableDailies} copy="recompensas a coletar" />
              <SummaryCard label="Decks próprios" value={stats?.customDecks ?? 0} copy="construções salvas" />
              <SummaryCard label="Cartas únicas" value={stats?.uniqueCards ?? 0} copy="descobertas na coleção" />
            </section>

            <div className="grid gap-8 lg:grid-cols-2">
              <section aria-labelledby="dailies-heading">
                <SectionHeading
                  id="dailies-heading"
                  eyebrow="RITUAL DIÁRIO"
                  title="Missões diárias"
                  action={(
                    <button onClick={() => void claimDailies()} disabled={loading} className="rf-button rf-button-secondary min-h-9 !px-3">
                      {claimableDailies > 0 ? `COLETAR (${claimableDailies})` : "ATUALIZAR"}
                    </button>
                  )}
                />
                <div className="space-y-2">
                  {dailies.length === 0 ? (
                    <EmptyState icon="◇" title="As missões ainda não foram geradas" copy="Use Atualizar para sincronizar seus desafios diários." />
                  ) : dailies.map((daily) => {
                    const def = daily.def;
                    if (!def) return null;
                    const pct = Math.min(100, Math.max(0, (daily.progress / def.requirement) * 100));
                    return (
                      <article
                        key={daily.questId}
                        className={`rounded-xl border p-4 ${daily.completed ? daily.claimedAt ? "border-emerald-300/10 bg-emerald-500/[0.035] opacity-65" : "border-amber-300/25 bg-amber-300/[0.055]" : "border-white/10 bg-white/[0.025]"}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 gap-3">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/20 text-xl" aria-hidden="true">{def.icon}</span>
                            <div className="min-w-0">
                              <h3 className="font-bold text-slate-100">{def.name}</h3>
                              <p className="mt-1 text-xs leading-5 text-slate-500">{def.description}</p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right text-xs">
                            <p className="font-bold text-slate-300">{daily.progress}/{def.requirement}</p>
                            <p className="mt-1 text-amber-200">+{def.rewardGold}🪙 +{def.rewardDust}💠</p>
                          </div>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/35" role="progressbar" aria-label={`Progresso da missão ${def.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
                          <div className={`h-full ${daily.completed ? "bg-emerald-400" : "bg-amber-300"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section aria-labelledby="achievements-heading">
                <SectionHeading id="achievements-heading" eyebrow="LEGADO" title="Conquistas" />
                <div className="space-y-2">
                  {ACHIEVEMENTS.map((achievement) => {
                    const progress = achievements.find((item) => item.achievementId === achievement.id);
                    const current = progress?.progress ?? 0;
                    const completed = progress?.completed ?? false;
                    const pct = Math.min(100, Math.max(0, (current / achievement.requirement) * 100));
                    return (
                      <article key={achievement.id} className={`rounded-xl border p-4 ${completed ? "border-amber-300/20 bg-amber-300/[0.05]" : "border-white/10 bg-white/[0.025]"}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 gap-3">
                            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/20 text-xl ${completed ? "" : "grayscale opacity-45"}`} aria-hidden="true">{achievement.icon}</span>
                            <div className="min-w-0">
                              <h3 className="font-bold text-slate-100">{achievement.name} {completed && <span className="text-emerald-300">✓</span>}</h3>
                              <p className="mt-1 text-xs leading-5 text-slate-500">{achievement.description}</p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right text-xs">
                            <p className="font-bold text-slate-300">{current}/{achievement.requirement}</p>
                            <p className="mt-1 text-amber-200">+{achievement.rewardGold}🪙</p>
                          </div>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/35" role="progressbar" aria-label={`Progresso da conquista ${achievement.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
                          <div className={`h-full ${completed ? "bg-amber-300" : "bg-slate-600"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>

            <section className="mt-10" aria-labelledby="shared-decks-heading">
              <div className="mb-4 flex flex-col gap-2 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300/65">REPUTAÇÃO PÚBLICA</p>
                  <h2 id="shared-decks-heading" className="mt-1 text-2xl font-black text-slate-100">Decks compartilhados</h2>
                </div>
                <Link href="/community" className="text-[9px] font-black uppercase tracking-[0.14em] text-amber-200 hover:text-amber-100">ABRIR COMUNIDADE →</Link>
              </div>
              {sharedDecks.length === 0 ? (
                <EmptyState icon="◎" title="Nenhum deck publicado" copy="Compartilhe uma construção na Comunidade para acompanhar votos e downloads por aqui." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {sharedDecks.map((deck) => (
                    <article key={deck.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-amber-300/15 hover:bg-white/[0.04]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-bold text-slate-100">{deck.name}</h3>
                          <p className="mt-1 text-xs text-slate-500">{deck.region1}{deck.region2 && ` + ${deck.region2}`} · {deck.archetype}</p>
                          {deck.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{deck.description}</p>}
                        </div>
                        <div className="shrink-0 rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2 text-right text-xs">
                          <p className="text-slate-300">👍 {deck.upvotes}</p>
                          <p className="mt-1 text-slate-600">↓ {deck.downloads}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {!player && !loading && (
          <EmptyState icon="◆" title="Perfil indisponível" copy="Não foi possível resolver a identidade local. Recarregue a página para criar ou recuperar sua sessão." />
        )}
      </div>
    </main>
  );
}

function Metric({ label, value, icon, tone }: { label: string; value: string | number; icon: string; tone: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-[0.12em] text-slate-600">
        <span>{label}</span><span aria-hidden="true">{icon}</span>
      </div>
      <p className={`mt-2 text-xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function SummaryCard({ label, value, copy }: { label: string; value: string | number; copy: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-100">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{copy}</p>
    </div>
  );
}

function SectionHeading({ id, eyebrow, title, action }: { id: string; eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3 border-b border-white/10 pb-3">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">{eyebrow}</p>
        <h2 id={id} className="mt-1 text-xl font-black text-slate-100">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ icon, title, copy }: { icon: string; title: string; copy: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center">
      <div className="text-3xl text-amber-200/65" aria-hidden="true">{icon}</div>
      <p className="mt-3 font-bold text-slate-300">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">{copy}</p>
    </div>
  );
}
