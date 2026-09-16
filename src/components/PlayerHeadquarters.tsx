"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { trackClientEvent } from "@/lib/client-telemetry";

type Player = {
  name: string;
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  mmr: number;
  peakMmr: number;
  rankedWins: number;
  rankedLosses: number;
  avatar: string | null;
  title: string | null;
  loginStreak: number;
};

type Snapshot = {
  player: Player | null;
  collectionOwned: number;
  collectionTotal: number;
  claimableDailies: number;
};

function percent(value: number, total: number) {
  return total > 0 ? Math.min(100, Math.max(0, Math.round(value / total * 100))) : 0;
}

export default function PlayerHeadquarters() {
  const [snapshot, setSnapshot] = useState<Snapshot>({ player: null, collectionOwned: 0, collectionTotal: 0, claimableDailies: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const profileResponse = await fetch("/api/player", { cache: "no-store", credentials: "include" });
      if (!profileResponse.ok) return;
      const profile = await profileResponse.json();
      if (!profile?.ok || !profile.player) return;

      const collectionResponse = await fetch("/api/collection", { cache: "no-store", credentials: "include" }).catch(() => null);
      const collection = collectionResponse?.ok ? await collectionResponse.json().catch(() => null) : null;
      const dailies = Array.isArray(profile.dailies) ? profile.dailies : [];
      const claimableDailies = dailies.filter((daily: { completed?: boolean; claimedAt?: string | null }) => daily.completed && !daily.claimedAt).length;
      setSnapshot({
        player: profile.player as Player,
        collectionOwned: Number(collection?.ownedCards ?? 0),
        collectionTotal: Number(collection?.totalCards ?? collection?.totalDefinitions ?? 0),
        claimableDailies,
      });
      trackClientEvent("home.player_hq_viewed", { authenticated: true });
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <section className="border border-white/8 bg-[#080d14]/90 p-4" aria-busy="true"><div className="h-24 animate-pulse bg-white/[.025]" /></section>;
  }

  if (!snapshot.player) {
    return (
      <section className="border border-amber-200/12 bg-[#080d14]/90 p-4">
        <div className="text-[8px] font-bold uppercase tracking-[.2em] text-amber-200/45">SEU QUARTEL-GENERAL</div>
        <h2 className="mt-2 font-[var(--font-display)] text-lg font-bold text-[#eadfc6]">Entre na Forja</h2>
        <p className="mt-2 text-xs leading-5 text-slate-500">Conecte sua identidade para ver nível, Ranked, coleção, missões e seu próximo objetivo aqui na Home.</p>
        <Link href="/play" onClick={() => trackClientEvent("journey.auth_intent", { source: "home_hq" })} className="mt-4 flex items-center justify-between border border-amber-100/30 bg-amber-200/[.07] px-4 py-3 text-[9px] font-black uppercase tracking-[.16em] text-amber-100">ENTRAR NA FORJA <span>→</span></Link>
      </section>
    );
  }

  const player = snapshot.player;
  const xp = percent(player.currentLevelXp, player.nextLevelXp);
  const collection = percent(snapshot.collectionOwned, snapshot.collectionTotal);
  const rankedGames = player.rankedWins + player.rankedLosses;
  const rankedWinRate = percent(player.rankedWins, rankedGames);

  return (
    <section className="border border-amber-200/14 bg-[radial-gradient(circle_at_10%_0%,rgba(217,164,65,.11),transparent_18rem),#080d14]/95 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-amber-100/30 bg-black/35 text-2xl">{player.avatar || "◆"}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3"><span className="text-[8px] font-bold uppercase tracking-[.2em] text-amber-200/45">QUARTEL-GENERAL</span><span className="text-[8px] uppercase tracking-[.14em] text-emerald-300/65">● ONLINE</span></div>
          <h2 className="mt-1 truncate font-[var(--font-display)] text-lg font-black text-[#eadfc6]">{player.name}</h2>
          <p className="mt-0.5 truncate text-[9px] uppercase tracking-[.12em] text-slate-600">Nível {player.level} · {player.title || "Forjador"} · streak {player.loginStreak || 0}d</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-[8px] font-bold uppercase tracking-[.14em] text-slate-600"><span>Próximo nível</span><span>{xp}%</span></div>
        <div className="mt-1.5 h-1.5 bg-white/5"><div className="h-full bg-gradient-to-r from-amber-700 via-amber-300 to-yellow-100" style={{ width: `${xp}%` }} /></div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric label="MMR" value={player.mmr} detail={rankedGames ? `${rankedWinRate}% WR` : `pico ${player.peakMmr}`} />
        <Metric label="Coleção" value={`${collection}%`} detail={`${snapshot.collectionOwned}/${snapshot.collectionTotal || "—"}`} />
        <Metric label="Missões" value={snapshot.claimableDailies} detail="prontas" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href="/profile" onClick={() => trackClientEvent("journey.profile_intent", { source: "home_hq" })} className="border border-white/10 bg-white/[.025] px-3 py-2.5 text-center text-[8px] font-black uppercase tracking-[.14em] text-slate-300 hover:border-amber-200/18 hover:text-amber-100">VER PERFIL</Link>
        <Link href="/play" onClick={() => trackClientEvent("journey.play_intent", { source: "home_hq" })} className="border border-amber-100/30 bg-amber-200/[.075] px-3 py-2.5 text-center text-[8px] font-black uppercase tracking-[.14em] text-amber-100 hover:bg-amber-200/[.12]">JOGAR AGORA</Link>
      </div>
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="border border-white/8 bg-black/25 px-3 py-2"><div className="text-[7px] font-bold uppercase tracking-[.14em] text-slate-600">{label}</div><div className="mt-1 text-sm font-black text-slate-200">{value}</div><div className="mt-0.5 truncate text-[8px] text-slate-600">{detail}</div></div>;
}
