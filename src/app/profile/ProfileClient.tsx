"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import SiteNav from "@/components/SiteNav";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ACHIEVEMENTS, DAILY_QUESTS } from "@/lib/achievements";
import {
  ensurePlayerSession,
  recoverPlayerSession,
  renamePlayerDisplayName,
  rotatePlayerRecoveryCode,
} from "@/lib/client-player-session";
import { trackClientEvent } from "@/lib/client-telemetry";

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
  mmr: number;
  peakMmr: number;
  rankedWins: number;
  rankedLosses: number;
  rankedGamesInPlacement: number;
  loginStreak: number;
  lastLogin: string | null;
  avatar: string | null;
  cardBack: string | null;
  title: string | null;
  bio: string | null;
  banner: string | null;
  status: string;
  badges: unknown;
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

type CollectionSnapshot = {
  ownedCards: number;
  totalCards: number;
  totalDefinitions: number;
};

type WardrobeSnapshot = {
  special: number;
  equipped: number;
  serialized: number;
};

type ProfileTab = "overview" | "ranked" | "collection" | "legacy" | "security";

const TABS: Array<{ id: ProfileTab; label: string; icon: string; hint: string }> = [
  { id: "overview", label: "Visão geral", icon: "◇", hint: "Identidade e progressão" },
  { id: "ranked", label: "Ranked", icon: "♜", hint: "MMR e desempenho" },
  { id: "collection", label: "Coleção", icon: "◈", hint: "Acervo e variantes" },
  { id: "legacy", label: "Legado", icon: "✦", hint: "Conquistas e decks" },
  { id: "security", label: "Acesso", icon: "⌘", hint: "Conta e recuperação" },
];

function asNumber(value: unknown) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.min(100, Math.max(0, Math.round(value / total * 100))) : 0;
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value || 0);
}

export default function ProfileClient() {
  const [playerName, setPlayerName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [achievements, setAchievements] = useState<AchievementProgress[]>([]);
  const [dailies, setDailies] = useState<DailyProgress[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sharedDecks, setSharedDecks] = useState<SharedDeck[]>([]);
  const [collection, setCollection] = useState<CollectionSnapshot>({ ownedCards: 0, totalCards: 0, totalDefinitions: 0 });
  const [wardrobe, setWardrobe] = useState<WardrobeSnapshot>({ special: 0, equipped: 0, serialized: 0 });
  const [tab, setTab] = useState<ProfileTab>("overview");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [recoveryInput, setRecoveryInput] = useState("");

  useDeferredEffect(() => {
    const saved = localStorage.getItem("runeforge_playername") || "";
    setPlayerName(saved);
    setNameInput(saved);
    trackClientEvent("profile.viewed", { surface: "profile_2_0" });
  }, []);

  const loadSupportingData = useCallback(async () => {
    const [collectionResponse, wardrobeResponse] = await Promise.allSettled([
      fetch("/api/collection", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/player/cosmetics", { cache: "no-store" }).then((response) => response.json()),
    ]);

    if (collectionResponse.status === "fulfilled" && collectionResponse.value?.ok) {
      setCollection({
        ownedCards: asNumber(collectionResponse.value.ownedCards),
        totalCards: asNumber(collectionResponse.value.totalCards),
        totalDefinitions: asNumber(collectionResponse.value.totalDefinitions),
      });
    }

    if (wardrobeResponse.status === "fulfilled" && wardrobeResponse.value?.ok && wardrobeResponse.value?.authenticated !== false) {
      const assets = Array.isArray(wardrobeResponse.value.wardrobe) ? wardrobeResponse.value.wardrobe as Array<Record<string, unknown>> : [];
      const preferences = Array.isArray(wardrobeResponse.value.preferences) ? wardrobeResponse.value.preferences : [];
      const special = assets.filter((asset) => String(asset.variantId ?? "standard") !== "standard" && asset.cosmetic).length;
      const serialized = assets.filter((asset) => asNumber(asset.serialNumber) > 0).length;
      setWardrobe({ special, equipped: preferences.length, serialized });
    }
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
        await loadSupportingData();
      }
    } finally {
      setLoading(false);
    }
  }, [loadSupportingData]);

  useDeferredEffect(() => {
    void loadProfile(playerName);
  }, [playerName, loadProfile]);

  const selectTab = (nextTab: ProfileTab) => {
    setTab(nextTab);
    trackClientEvent("profile.tab_selected", { tab: nextTab, surface: "profile_2_0" });
  };

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
          setMessage(`Recompensa recebida: +${data.rewards.gold} ouro · +${data.rewards.dust} pó · +${data.rewards.xp} XP`);
          trackClientEvent("progression.daily_claimed", { count: data.claimed.length });
        } else {
          setMessage("Missões diárias sincronizadas.");
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
      setMessage("Nome público atualizado.");
      trackClientEvent("profile.identity_updated", { field: "display_name" });
    } finally {
      setLoading(false);
    }
  };

  const rotateRecovery = async () => {
    setLoading(true);
    setMessage("");
    try {
      const result = await rotatePlayerRecoveryCode();
      setMessage(!result.ok || !result.recoveryCode
        ? result.error || "Não foi possível gerar nova chave."
        : "Nova chave gerada. Salve-a no aviso de segurança; a chave anterior deixou de funcionar.");
    } finally {
      setLoading(false);
    }
  };

  const recoverAccount = async () => {
    const code = recoveryInput.trim();
    if (!code) return;
    setLoading(true);
    setMessage("");
    try {
      const result = await recoverPlayerSession(code);
      if (!result.ok || !result.player) {
        setMessage(result.error || "Não foi possível recuperar a conta.");
        return;
      }
      const resolvedName = String(result.player.name);
      setRecoveryInput("");
      setPlayerName(resolvedName);
      setNameInput(resolvedName);
      setMessage("Conta recuperada. Uma nova chave foi emitida; salve-a agora.");
      await loadProfile(resolvedName);
    } finally {
      setLoading(false);
    }
  };

  const completedAchievements = achievements.filter((achievement) => achievement.completed).length;
  const claimableDailies = dailies.filter((daily) => daily.completed && !daily.claimedAt).length;
  const xpPct = player ? percentage(player.currentLevelXp, player.nextLevelXp) : 0;
  const rankedGames = (player?.rankedWins ?? 0) + (player?.rankedLosses ?? 0);
  const rankedWinRate = percentage(player?.rankedWins ?? 0, rankedGames);
  const overallWinRate = percentage(stats?.wins ?? 0, stats?.matches ?? 0);
  const collectionCompletion = percentage(collection.ownedCards, collection.totalCards);
  const badgeList = useMemo(() => Array.isArray(player?.badges) ? player.badges.map(String).slice(0, 6) : [], [player?.badges]);

  return (
    <main className="rf-app-page min-h-screen bg-[#05080d] text-slate-100">
      <SiteNav />
      <div className="mx-auto max-w-[1560px] px-4 py-5 sm:px-6 lg:px-8">
        {message && (
          <div className="mb-4 flex items-center justify-between gap-3 border border-amber-200/18 bg-amber-200/[.055] px-4 py-3 text-xs text-amber-50" role="status" aria-live="polite">
            <span>{message}</span>
            <button type="button" className="font-bold uppercase tracking-[.14em] text-amber-200" onClick={() => setMessage("")}>Fechar</button>
          </div>
        )}

        {!player && loading && <ProfileSkeleton />}

        {player && (
          <>
            <section className="relative overflow-hidden border border-amber-100/14 bg-[#091019] shadow-[0_28px_90px_rgba(0,0,0,.38)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(215,173,86,.17),transparent_34rem),radial-gradient(circle_at_88%_20%,rgba(70,130,180,.12),transparent_32rem),linear-gradient(110deg,rgba(5,8,13,.25),rgba(5,8,13,.92))]" />
              <div className="relative min-h-[250px] p-5 sm:p-7 lg:p-8">
                <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end">
                    <div className="relative shrink-0">
                      <div className="grid h-28 w-28 place-items-center rounded-full border-2 border-amber-200/45 bg-[#06090e] text-5xl shadow-[0_0_0_7px_rgba(224,181,91,.06),0_18px_50px_rgba(0,0,0,.5)] sm:h-32 sm:w-32 sm:text-6xl" aria-label="Avatar do jogador">
                        {player.avatar || "◆"}
                      </div>
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-amber-100/35 bg-[#111720] px-3 py-1 text-[9px] font-black uppercase tracking-[.14em] text-amber-100">NÍVEL {player.level}</span>
                    </div>
                    <div className="min-w-0 pb-1">
                      <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase tracking-[.18em] text-slate-500">
                        <span className="text-emerald-300/80">● {player.status || "active"}</span>
                        <span>·</span>
                        <span>{player.title || "Forjador"}</span>
                        {badgeList.map((badge) => <span key={badge} className="border border-white/10 bg-white/[.035] px-2 py-1 text-slate-400">{badge}</span>)}
                      </div>
                      <h1 className="mt-2 truncate font-[var(--font-display)] text-3xl font-black tracking-[.03em] text-[#f4e7c7] sm:text-4xl">{player.name}</h1>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{player.bio?.trim() || "Forjador do Nexus. Construa seu legado entre coleção, Ranked e conquistas."}</p>
                      <div className="mt-4 flex flex-wrap gap-2 text-[9px] font-bold uppercase tracking-[.12em] text-slate-500">
                        <span>Membro desde {new Date(player.createdAt).toLocaleDateString("pt-BR")}</span>
                        <span>·</span>
                        <span>Sequência {player.loginStreak || 0} dias</span>
                        <span>·</span>
                        <span>{compactNumber(stats?.matches ?? 0)} partidas</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-auto lg:min-w-[500px]">
                    <HeroMetric label="Ranked MMR" value={player.rankedGamesInPlacement > 0 ? `${player.mmr}` : `${player.mmr}`} detail={player.rankedGamesInPlacement > 0 ? `${player.rankedGamesInPlacement} jogos de colocação` : `pico ${player.peakMmr}`} />
                    <HeroMetric label="Coleção" value={`${collectionCompletion}%`} detail={`${collection.ownedCards}/${collection.totalCards || collection.totalDefinitions} distintas`} />
                    <HeroMetric label="Legado" value={`${completedAchievements}/${ACHIEVEMENTS.length}`} detail="conquistas concluídas" />
                  </div>
                </div>

                <div className="mt-7 max-w-2xl">
                  <div className="flex items-center justify-between gap-4 text-[9px] font-black uppercase tracking-[.16em]">
                    <span className="text-amber-100">PROGRESSÃO DA CONTA</span>
                    <span className="text-slate-500">{player.currentLevelXp}/{player.nextLevelXp} XP</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden bg-black/45" role="progressbar" aria-label="Progresso de nível" aria-valuemin={0} aria-valuemax={100} aria-valuenow={xpPct}>
                    <div className="h-full bg-gradient-to-r from-amber-700 via-amber-300 to-yellow-100 shadow-[0_0_18px_rgba(251,191,36,.28)] transition-[width] duration-500" style={{ width: `${xpPct}%` }} />
                  </div>
                </div>
              </div>
            </section>

            <div className="mt-4 grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
              <aside className="self-start border border-white/8 bg-[#080d14]/92 lg:sticky lg:top-4">
                <nav aria-label="Seções do perfil" className="p-2">
                  {TABS.map((item) => (
                    <button key={item.id} type="button" onClick={() => selectTab(item.id)} className={`flex w-full items-center gap-3 border px-3 py-3 text-left transition ${tab === item.id ? "border-amber-200/18 bg-amber-100/[.055] text-amber-50" : "border-transparent text-slate-400 hover:border-white/8 hover:bg-white/[.025] hover:text-slate-200"}`} aria-current={tab === item.id ? "page" : undefined}>
                      <span className="grid h-8 w-8 place-items-center text-base text-amber-200/65">{item.icon}</span>
                      <span className="min-w-0"><b className="block text-[10px] uppercase tracking-[.14em]">{item.label}</b><small className="mt-1 block truncate text-[9px] text-slate-600">{item.hint}</small></span>
                    </button>
                  ))}
                </nav>
                <div className="border-t border-white/8 p-3">
                  <Link href="/play" onClick={() => trackClientEvent("journey.play_intent", { source: "profile" })} className="flex items-center justify-between border border-amber-100/30 bg-amber-200/[.08] px-3 py-3 text-[10px] font-black uppercase tracking-[.16em] text-amber-100 hover:bg-amber-200/[.13]">JOGAR <span>→</span></Link>
                </div>
              </aside>

              <div className="min-w-0">
                {tab === "overview" && <OverviewPanel player={player} stats={stats} dailies={dailies} claimableDailies={claimableDailies} loading={loading} onClaim={claimDailies} nameInput={nameInput} setNameInput={setNameInput} onSaveName={saveName} overallWinRate={overallWinRate} />}
                {tab === "ranked" && <RankedPanel player={player} games={rankedGames} winRate={rankedWinRate} />}
                {tab === "collection" && <CollectionPanel snapshot={collection} wardrobe={wardrobe} uniqueCards={stats?.uniqueCards ?? 0} completion={collectionCompletion} />}
                {tab === "legacy" && <LegacyPanel achievements={achievements} sharedDecks={sharedDecks} />}
                {tab === "security" && <SecurityPanel loading={loading} recoveryInput={recoveryInput} setRecoveryInput={setRecoveryInput} onRotate={rotateRecovery} onRecover={recoverAccount} />}
              </div>
            </div>
          </>
        )}

        {!player && !loading && <Empty title="Perfil indisponível" copy="Não foi possível resolver sua identidade local. Entre na Forja ou recupere sua sessão para continuar." action={<Link href="/play" className="rf-button rf-button-primary">ENTRAR NA FORJA</Link>} />}
      </div>
    </main>
  );
}

function OverviewPanel({ player, stats, dailies, claimableDailies, loading, onClaim, nameInput, setNameInput, onSaveName, overallWinRate }: {
  player: PlayerData;
  stats: Stats | null;
  dailies: DailyProgress[];
  claimableDailies: number;
  loading: boolean;
  onClaim: () => Promise<void>;
  nameInput: string;
  setNameInput: (value: string) => void;
  onSaveName: () => Promise<void>;
  overallWinRate: number;
}) {
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
    <div className="space-y-4">
      <Panel eyebrow="CONTA" title="Resumo do Forjador">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SmallMetric label="Partidas" value={stats?.matches ?? 0} detail={`${overallWinRate}% de vitórias`} />
          <SmallMetric label="Decks" value={stats?.customDecks ?? 0} detail="construções próprias" />
          <SmallMetric label="Ouro" value={player.gold} detail="saldo atual" />
          <SmallMetric label="Pó arcano" value={player.dust} detail="saldo de forja" />
        </div>
        <form className="mt-5 grid gap-2 border-t border-white/8 pt-4 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={(event) => { event.preventDefault(); void onSaveName(); }}>
          <label className="sr-only" htmlFor="profile-display-name">Nome público</label>
          <input id="profile-display-name" className="input min-w-0" value={nameInput} onChange={(event) => setNameInput(event.target.value)} autoComplete="nickname" />
          <button className="rf-button rf-button-secondary" disabled={loading || !nameInput.trim() || nameInput.trim() === player.name}>ATUALIZAR NOME</button>
        </form>
      </Panel>

      <Panel eyebrow="RITUAL DIÁRIO" title="Missões" action={<button type="button" disabled={loading} onClick={() => void onClaim()} className="text-[9px] font-black uppercase tracking-[.14em] text-amber-200">{claimableDailies ? `COLETAR ${claimableDailies}` : "SINCRONIZAR"}</button>}>
        <div className="grid gap-2 md:grid-cols-2">
          {dailies.length ? dailies.slice(0, 4).map((daily) => {
            const def = daily.def;
            if (!def) return null;
            const pct = percentage(daily.progress, def.requirement);
            return <article key={daily.questId} className={`border p-4 ${daily.completed && !daily.claimedAt ? "border-amber-200/22 bg-amber-200/[.045]" : "border-white/8 bg-white/[.02]"}`}>
              <div className="flex items-start gap-3"><span className="text-xl">{def.icon}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><h3 className="text-xs font-bold text-slate-200">{def.name}</h3><span className="text-[9px] text-slate-500">{daily.progress}/{def.requirement}</span></div><p className="mt-1 text-[10px] leading-4 text-slate-600">{def.description}</p><div className="mt-3 h-1 bg-white/5"><div className="h-full bg-amber-300/70" style={{ width: `${pct}%` }} /></div></div></div>
            </article>;
          }) : <p className="text-xs text-slate-500">As missões serão exibidas quando forem sincronizadas.</p>}
        </div>
      </Panel>
    </div>

    <div className="space-y-4">
      <Panel eyebrow="PRÓXIMOS PASSOS" title="Continue sua jornada">
        <JourneyLink href="/ranked" icon="♜" title="Subir no Ranked" copy={`MMR atual ${player.mmr} · pico ${player.peakMmr}`} />
        <JourneyLink href="/collection" icon="◈" title="Completar a coleção" copy={`${stats?.uniqueCards ?? 0} cartas únicas descobertas`} />
        <JourneyLink href="/collection/variants" icon="✦" title="Personalizar cartas" copy="Escolha Full Art, Foil, Animated e Serialized" />
        <JourneyLink href="/forge" icon="◆" title="Ajustar seus decks" copy={`${stats?.customDecks ?? 0} decks próprios`} />
      </Panel>
      <Panel eyebrow="PRESENÇA" title="Identidade visual">
        <dl className="grid gap-3 text-xs">
          <MetaLine label="Avatar" value={player.avatar || "Padrão"} />
          <MetaLine label="Título" value={player.title || "Forjador"} />
          <MetaLine label="Banner" value={player.banner || "Padrão"} />
          <MetaLine label="Card back" value={player.cardBack || "Padrão"} />
        </dl>
      </Panel>
    </div>
  </div>;
}

function RankedPanel({ player, games, winRate }: { player: PlayerData; games: number; winRate: number }) {
  const placement = Math.max(0, player.rankedGamesInPlacement || 0);
  return <div className="space-y-4">
    <Panel eyebrow="COMPETITIVO" title="Ranked do Nexus" action={<Link href="/ranked" onClick={() => trackClientEvent("journey.ranked_intent", { source: "profile" })} className="text-[9px] font-black uppercase tracking-[.14em] text-amber-200">ABRIR RANKED →</Link>}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.7fr)]">
        <div className="relative overflow-hidden border border-amber-200/18 bg-[radial-gradient(circle_at_50%_0%,rgba(222,180,91,.17),transparent_22rem),#080d14] p-6 text-center sm:p-8">
          <div className="mx-auto grid h-28 w-28 place-items-center rounded-full border border-amber-100/30 bg-black/30 font-[var(--font-display)] text-3xl font-black text-amber-100 shadow-[0_0_50px_rgba(222,180,91,.12)]">{player.mmr}</div>
          <p className="mt-4 text-[9px] font-bold uppercase tracking-[.22em] text-amber-200/55">MMR ATUAL</p>
          <h3 className="mt-2 font-[var(--font-display)] text-xl font-black text-[#eee1c4]">{placement > 0 ? "Colocação em andamento" : "Classificação estabelecida"}</h3>
          <p className="mt-2 text-xs text-slate-500">Pico histórico: {player.peakMmr} MMR{placement > 0 ? ` · ${placement} jogos restantes na colocação` : ""}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SmallMetric label="Vitórias" value={player.rankedWins} detail="Ranked" />
          <SmallMetric label="Derrotas" value={player.rankedLosses} detail="Ranked" />
          <SmallMetric label="Win rate" value={`${winRate}%`} detail={`${games} jogos ranqueados`} />
          <SmallMetric label="Pico MMR" value={player.peakMmr} detail="melhor marca" />
        </div>
      </div>
    </Panel>
    <div className="grid gap-4 md:grid-cols-3">
      <FeatureCard icon="♜" title="Autoridade preservada" copy="O perfil apenas lê sua classificação real. Regras de MMR e matchmaking continuam sob a autoridade do runtime competitivo." />
      <FeatureCard icon="◇" title="Histórico consistente" copy="Vitórias, derrotas e pico vêm do mesmo registro usado pelas superfícies Ranked do jogo." />
      <FeatureCard icon="↗" title="Próxima meta" copy={placement > 0 ? `Conclua mais ${placement} jogos de colocação.` : player.mmr < player.peakMmr ? `Recupere ${player.peakMmr - player.mmr} MMR para igualar seu pico.` : "Você está no seu melhor MMR registrado."} />
    </div>
  </div>;
}

function CollectionPanel({ snapshot, wardrobe, uniqueCards, completion }: { snapshot: CollectionSnapshot; wardrobe: WardrobeSnapshot; uniqueCards: number; completion: number }) {
  const missing = Math.max(0, snapshot.totalCards - snapshot.ownedCards);
  return <div className="space-y-4">
    <Panel eyebrow="COLLECTION 2.0" title="Seu acervo" action={<div className="flex gap-3"><Link href="/collection" className="text-[9px] font-black uppercase tracking-[.14em] text-amber-200">COLEÇÃO →</Link><Link href="/collection/variants" className="text-[9px] font-black uppercase tracking-[.14em] text-sky-200">VARIANTES →</Link></div>}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(330px,.8fr)]">
        <div className="border border-white/8 bg-black/20 p-5">
          <div className="flex items-end justify-between gap-4"><div><p className="text-[9px] font-bold uppercase tracking-[.18em] text-slate-600">CONCLUSÃO</p><p className="mt-2 font-[var(--font-display)] text-4xl font-black text-[#eee1c4]">{completion}%</p></div><p className="text-right text-xs text-slate-500">{snapshot.ownedCards}/{snapshot.totalCards || snapshot.totalDefinitions}<br />cartas distintas</p></div>
          <div className="mt-5 h-2 bg-white/5"><div className="h-full bg-gradient-to-r from-amber-700 via-amber-300 to-yellow-100" style={{ width: `${completion}%` }} /></div>
          <div className="mt-5 grid grid-cols-3 gap-2"><Mini label="Descobertas" value={uniqueCards} /><Mini label="Faltando" value={missing} /><Mini label="Catálogo" value={snapshot.totalDefinitions || snapshot.totalCards} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SmallMetric label="Variantes" value={wardrobe.special} detail="cópias especiais" />
          <SmallMetric label="Equipadas" value={wardrobe.equipped} detail="preferências ativas" />
          <SmallMetric label="Serialized" value={wardrobe.serialized} detail="cópias numeradas" />
          <SmallMetric label="Base" value={snapshot.ownedCards} detail="cartas distintas" />
        </div>
      </div>
    </Panel>
    <div className="grid gap-4 md:grid-cols-3">
      <FeatureCard icon="◈" title="Álbum Vanilla" copy="Acompanhe a conclusão do set e as lacunas do acervo em uma visão de colecionador." href="/album" />
      <FeatureCard icon="✦" title="Ateliê de Variantes" copy="Equipe versões Full Art, Foil, Premium, Animated e Serialized sem alterar gameplay." href="/collection/variants" />
      <FeatureCard icon="◆" title="Deck Forge" copy="Transforme a coleção em listas jogáveis e identifique o que ainda falta para construir." href="/forge" />
    </div>
  </div>;
}

function LegacyPanel({ achievements, sharedDecks }: { achievements: AchievementProgress[]; sharedDecks: SharedDeck[] }) {
  return <div className="grid gap-4 xl:grid-cols-2">
    <Panel eyebrow="LEGADO" title="Conquistas">
      <div className="space-y-2">
        {ACHIEVEMENTS.map((achievement) => {
          const progress = achievements.find((item) => item.achievementId === achievement.id);
          const current = progress?.progress ?? 0;
          const completed = progress?.completed ?? false;
          const pct = percentage(current, achievement.requirement);
          return <article key={achievement.id} className={`border p-4 ${completed ? "border-amber-200/18 bg-amber-200/[.04]" : "border-white/8 bg-white/[.02]"}`}>
            <div className="flex items-start gap-3"><span className={`text-xl ${completed ? "" : "grayscale opacity-40"}`}>{achievement.icon}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><h3 className="text-xs font-bold text-slate-200">{achievement.name}</h3><span className="text-[9px] text-slate-500">{current}/{achievement.requirement}</span></div><p className="mt-1 text-[10px] leading-4 text-slate-600">{achievement.description}</p><div className="mt-3 h-1 bg-white/5"><div className={`h-full ${completed ? "bg-amber-300/80" : "bg-slate-600"}`} style={{ width: `${pct}%` }} /></div></div></div>
          </article>;
        })}
      </div>
    </Panel>
    <Panel eyebrow="REPUTAÇÃO" title="Decks compartilhados" action={<Link href="/community" className="text-[9px] font-black uppercase tracking-[.14em] text-amber-200">COMUNIDADE →</Link>}>
      <div className="space-y-2">
        {sharedDecks.length ? sharedDecks.map((deck) => <article key={deck.id} className="border border-white/8 bg-white/[.02] p-4"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><h3 className="truncate text-xs font-bold text-slate-200">{deck.name}</h3><p className="mt-1 text-[10px] text-slate-600">{deck.region1}{deck.region2 ? ` + ${deck.region2}` : ""} · {deck.archetype}</p><p className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-500">{deck.description || "Deck público da comunidade."}</p></div><div className="shrink-0 text-right text-[10px] text-slate-500"><p>↑ {deck.upvotes}</p><p className="mt-1">↓ {deck.downloads}</p></div></div></article>) : <Empty title="Nenhum deck publicado" copy="Quando você compartilhar uma construção, votos e downloads aparecerão aqui." />}
      </div>
    </Panel>
  </div>;
}

function SecurityPanel({ loading, recoveryInput, setRecoveryInput, onRotate, onRecover }: { loading: boolean; recoveryInput: string; setRecoveryInput: (value: string) => void; onRotate: () => Promise<void>; onRecover: () => Promise<void> }) {
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
    <Panel eyebrow="ACESSO & SEGURANÇA" title="Recuperação da conta">
      <p className="max-w-3xl text-sm leading-6 text-slate-400">A chave de recuperação não fica salva automaticamente neste navegador. Ao criar, recuperar ou rotacionar uma conta, o FORGED mostra a nova chave uma vez para você copiar e guardar.</p>
      <div className="mt-5 flex flex-wrap gap-2"><button type="button" className="rf-button rf-button-secondary" disabled={loading} onClick={() => void onRotate()}>GERAR NOVA CHAVE</button><Link href="/profile/security" className="rf-button rf-button-secondary">CENTRAL DE SEGURANÇA</Link></div>
      <form className="mt-6 grid gap-2 border-t border-white/8 pt-5 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={(event) => { event.preventDefault(); void onRecover(); }}>
        <label className="sr-only" htmlFor="profile-recovery-key">Chave de recuperação</label>
        <input id="profile-recovery-key" className="input min-w-0" value={recoveryInput} onChange={(event) => setRecoveryInput(event.target.value)} placeholder="Cole uma chave para recuperar outra sessão" autoComplete="off" spellCheck={false} />
        <button type="submit" className="rf-button rf-button-primary" disabled={loading || recoveryInput.trim().length < 24}>RECUPERAR</button>
      </form>
    </Panel>
    <Panel eyebrow="BOAS PRÁTICAS" title="Proteção do Forjador">
      <div className="space-y-3 text-xs leading-5 text-slate-400"><SecurityLine title="Chave única" copy="Rotacionar invalida a chave anterior." /><SecurityLine title="Identidade conectada" copy="Use Acesso & Segurança para revisar provedores vinculados." /><SecurityLine title="Telemetria segura" copy="Eventos do client descartam campos sensíveis antes da persistência." /></div>
    </Panel>
  </div>;
}

function Panel({ eyebrow, title, children, action }: { eyebrow: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="border border-white/8 bg-[#080d14]/90"><header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/8 px-5 py-4"><div><p className="text-[8px] font-black uppercase tracking-[.22em] text-amber-200/45">{eyebrow}</p><h2 className="mt-1 font-[var(--font-display)] text-lg font-bold text-[#eadfc7]">{title}</h2></div>{action}</header><div className="p-5">{children}</div></section>;
}

function HeroMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="border border-white/10 bg-black/30 px-4 py-3"><p className="text-[8px] font-bold uppercase tracking-[.18em] text-slate-600">{label}</p><p className="mt-1 font-[var(--font-display)] text-xl font-black text-[#f0e2c1]">{value}</p><p className="mt-1 text-[9px] text-slate-500">{detail}</p></div>;
}

function SmallMetric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="border border-white/8 bg-black/20 p-4"><p className="text-[8px] font-bold uppercase tracking-[.18em] text-slate-600">{label}</p><p className="mt-2 text-2xl font-black text-slate-100">{value}</p><p className="mt-1 text-[10px] text-slate-500">{detail}</p></div>;
}

function Mini({ label, value }: { label: string; value: number }) { return <div className="border border-white/7 bg-white/[.02] p-3"><p className="text-lg font-black text-slate-200">{value}</p><p className="mt-1 text-[8px] uppercase tracking-[.12em] text-slate-600">{label}</p></div>; }
function MetaLine({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 border-b border-white/6 pb-3 last:border-0 last:pb-0"><dt className="text-slate-600">{label}</dt><dd className="max-w-[60%] truncate font-bold text-slate-300">{value}</dd></div>; }
function SecurityLine({ title, copy }: { title: string; copy: string }) { return <div className="border-l border-cyan-200/20 pl-3"><b className="block text-slate-200">{title}</b><span className="text-slate-500">{copy}</span></div>; }

function JourneyLink({ href, icon, title, copy }: { href: string; icon: string; title: string; copy: string }) {
  return <Link href={href} className="group mb-2 flex items-center gap-3 border border-white/8 bg-white/[.018] p-3 transition last:mb-0 hover:border-amber-200/18 hover:bg-amber-200/[.035]"><span className="grid h-9 w-9 place-items-center text-lg text-amber-200/65">{icon}</span><span className="min-w-0 flex-1"><b className="block text-[10px] uppercase tracking-[.1em] text-slate-300">{title}</b><small className="mt-1 block truncate text-[9px] text-slate-600">{copy}</small></span><span className="text-slate-700 transition group-hover:translate-x-1 group-hover:text-amber-200">→</span></Link>;
}

function FeatureCard({ icon, title, copy, href }: { icon: string; title: string; copy: string; href?: string }) {
  const body = <><span className="text-xl text-amber-200/65">{icon}</span><h3 className="mt-4 text-xs font-black uppercase tracking-[.12em] text-slate-200">{title}</h3><p className="mt-2 text-[11px] leading-5 text-slate-500">{copy}</p>{href && <span className="mt-4 inline-block text-[9px] font-black uppercase tracking-[.14em] text-amber-200">ABRIR →</span>}</>;
  return href ? <Link href={href} className="border border-white/8 bg-[#080d14]/90 p-5 transition hover:border-amber-200/16 hover:bg-amber-200/[.025]">{body}</Link> : <article className="border border-white/8 bg-[#080d14]/90 p-5">{body}</article>;
}

function Empty({ title, copy, action }: { title: string; copy: string; action?: React.ReactNode }) { return <div className="border border-dashed border-white/10 bg-black/15 px-6 py-12 text-center"><div className="text-3xl text-slate-700">◇</div><h3 className="mt-3 font-bold text-slate-200">{title}</h3><p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-slate-500">{copy}</p>{action && <div className="mt-5 flex justify-center">{action}</div>}</div>; }

function ProfileSkeleton() {
  return <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Carregando perfil"><div className="h-[250px] border border-white/8 bg-white/[.025]" /><div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]"><div className="h-80 border border-white/8 bg-white/[.02]" /><div className="h-96 border border-white/8 bg-white/[.02]" /></div></div>;
}
