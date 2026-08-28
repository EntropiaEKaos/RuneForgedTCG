"use client";

import { useState } from "react";
import Link from "next/link";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import SiteNav from "@/components/SiteNav";
import type { Puzzle, Boss, BrawlMode, Encounter } from "@/lib/game-modes";
import { ensurePlayerSession } from "@/lib/client-player-session";

function playHref(mode: string, id: string, name: string): string {
  return `/play?mode=${mode}&modeId=${id}&name=${encodeURIComponent(name)}`;
}

export default function ModesClient({ puzzles: PUZZLES, bosses: BOSSES, brawls: BRAWLS, encounters: ENCOUNTERS }: { puzzles: Puzzle[]; bosses: Boss[]; brawls: BrawlMode[]; encounters: Encounter[] }) {
  const [tab, setTab] = useState<"expedition" | "puzzle" | "boss" | "brawl">("expedition");
  const [playerName, setPlayerName] = useState("");
  const [featuredBrawlId, setFeaturedBrawlId] = useState<string | null>(null);

  useDeferredEffect(() => {
    void ensurePlayerSession(localStorage.getItem("runeforge_playername") || "").then((profile) => {
      if (profile.player?.name) setPlayerName(String(profile.player.name));
    });
  }, []);

  useDeferredEffect(() => {
    // O admin pode publicar um evento com type="brawl" e rules.brawlId
    // apontando pra um dos BRAWLS estáticos abaixo, com janela de tempo
    // (startsAt/endsAt) — vira o "Brawl da Semana" sem precisar de deploy.
    fetch("/api/active-promotions")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok || !Array.isArray(data.items)) return;
        const brawlEvent = data.items.find((i: { type?: string; rules?: { brawlId?: string } }) => i.type === "brawl" && i.rules?.brawlId);
        if (brawlEvent) setFeaturedBrawlId(brawlEvent.rules.brawlId);
      })
      .catch(() => {});
  }, []);

  const orderedBrawls = featuredBrawlId
    ? [...BRAWLS].sort((a, b) => (a.id === featuredBrawlId ? -1 : b.id === featuredBrawlId ? 1 : 0))
    : BRAWLS;

  return (
    <main className="rf-app-page modes-page">
      <SiteNav />
      <div className="rf-app-shell">
        <header className="rf-app-heading"><div><p className="rf-eyebrow"><span /> ARQUIVOS DO NEXUS</p><h1>Modos de jogo</h1><p>Campanhas autoritativas, desafios táticos e regras especiais para colocar cada doutrina à prova.</p></div></header>

        <div className="mode-tabs" role="tablist" aria-label="Modos disponíveis">
          {([
            ["expedition", "🧭 Expedição"],
            ["puzzle", "🧩 Puzzles"],
            ["boss", "👹 Boss Battles"],
            ["brawl", "⚔️ Brawls Semanais"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`mode-tab ${tab === id ? "active" : ""}`}
              role="tab"
              aria-selected={tab === id}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "expedition" && (
          <section>
            <h2 className="mb-3 text-xl font-black text-amber-200">🧭 Expedição do Nexus</h2>
            <p className="mb-4 text-sm text-slate-400">Três encontros autoritativos com abertura, objetivo e modificador próprios.</p>
            <div className="grid gap-4 lg:grid-cols-3">
              {ENCOUNTERS.map((encounter) => (
                <article key={encounter.id} className="expedition-card" data-region={encounter.region.toLowerCase()}>
                  <header><span>{encounter.emoji}</span><div><small>{encounter.chapter}</small><h3>{encounter.name}</h3><p>{encounter.region} · {"◆".repeat(encounter.difficulty)}</p></div></header>
                  <p>{encounter.description}</p>
                  <div className="expedition-objective"><small>OBJETIVO</small><b>{encounter.objective}</b></div>
                  <div className="expedition-mutator"><small>MODIFICADOR · {encounter.mutator.label}</small><p>{encounter.mutator.description}</p></div>
                  <footer><span>+{encounter.reward.gold}🪙 · +{encounter.reward.dust}💠 · +{encounter.reward.xp}XP</span><Link href={playHref("expedition", encounter.id, playerName)}>Iniciar capítulo</Link></footer>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === "puzzle" && (
          <section>
            <h2 className="mb-3 text-xl font-black text-amber-200">🧩 Puzzle Mode</h2>
            <p className="mb-4 text-sm text-slate-400">
              Cenários táticos - resolva-os em 1 turno usando as cartas dadas
            </p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {PUZZLES.map((p) => (
                <div key={p.id} className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-transparent p-4">
                  <div className="flex items-start justify-between">
                    <h3 className="font-black text-purple-200">{p.name}</h3>
                    <span className="text-xs">{"⭐".repeat(p.difficulty)}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{p.description}</p>
                  <div className="mt-2 rounded bg-black/40 p-2 text-xs">
                    <p className="font-bold text-amber-300">🎯 {p.goal}</p>
                    <p className="mt-1 text-slate-500">💡 {p.hint}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-emerald-300">
                      +{p.reward.gold}🪙 +{p.reward.dust}💠 +{p.reward.xp}XP
                    </p>
                    <Link
                      href={playHref("puzzle", p.id, playerName)}
                      className="rounded bg-purple-600 px-3 py-1 text-xs font-bold hover:bg-purple-500"
                    >
                      Jogar
                    </Link>
                    <span className="rounded bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-300">🎁 Recompensa ao concluir</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "boss" && (
          <section>
            <h2 className="mb-3 text-xl font-black text-amber-200">👹 Boss Battles</h2>
            <p className="mb-4 text-sm text-slate-400">
              Enfrente bosses únicos com regras especiais
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {BOSSES.map((b) => (
                <div key={b.id} className="rounded-2xl border-2 border-red-500/40 bg-gradient-to-br from-red-950 to-black p-4">
                  <div className="text-center">
                    <div className="text-6xl">{b.emoji}</div>
                    <h3 className="mt-2 text-lg font-black text-red-300">{b.name}</h3>
                    <p className="text-xs text-slate-400">{b.region}</p>
                    <span className="mt-1 inline-block rounded bg-red-500/20 px-2 py-0.5 text-xs">
                      {"💀".repeat(b.difficulty)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-300">{b.description}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="rounded bg-black/40 p-1">
                      <p className="text-slate-500">Seu Nexus</p>
                      <p className="font-bold text-emerald-300">{b.playerNexusStart}</p>
                    </div>
                    <div className="rounded bg-black/40 p-1">
                      <p className="text-slate-500">Boss</p>
                      <p className="font-bold text-red-300">{b.aiNexusStart}</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded bg-amber-500/10 p-2 text-xs">
                    <p className="font-bold text-amber-300">🏆 Recompensa</p>
                    <p className="text-slate-300">
                      +{b.reward.gold}🪙 +{b.reward.dust}💠 +{b.reward.xp}XP
                    </p>
                    {b.reward.pack && (
                      <p className="text-purple-300">📦 {b.reward.pack} pack</p>
                    )}
                  </div>
                  <Link
                    href={playHref("boss", b.id, playerName)}
                    className="mt-3 block w-full rounded-lg bg-red-600 py-2 text-center font-black hover:bg-red-500"
                  >
                    ⚔️ Desafiar
                  </Link>
                  <span className="mt-1 block w-full rounded-lg bg-emerald-500/10 py-1 text-center text-xs font-bold text-emerald-300">🎁 Recompensa ao concluir</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "brawl" && (
          <section>
            <h2 className="mb-3 text-xl font-black text-amber-200">⚔️ Brawls Semanais</h2>
            <p className="mb-4 text-sm text-slate-400">
              Modos temporários com regras únicas
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {orderedBrawls.map((b) => (
                <div
                  key={b.id}
                  className={
                    b.id === featuredBrawlId
                      ? "relative rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-500/20 to-transparent p-4 shadow-[0_0_25px_rgba(251,191,36,.25)]"
                      : "rounded-2xl border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-transparent p-4"
                  }
                >
                  {b.id === featuredBrawlId && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-950">
                      ⭐ Brawl da Semana
                    </span>
                  )}
                  <div className="text-center">
                    <div className="text-5xl">{b.emoji}</div>
                    <h3 className="mt-2 text-lg font-black text-cyan-300">{b.name}</h3>
                  </div>
                  <p className="mt-2 text-xs text-slate-300">{b.description}</p>
                  <div className="mt-3 space-y-1 rounded bg-black/40 p-2 text-xs">
                    {b.rules.startingMana && <p>⚡ Mana inicial: {b.rules.startingMana}</p>}
                    {b.rules.startingHand && <p>✋ Mão inicial: {b.rules.startingHand}</p>}
                    {b.rules.startingNexus && <p>💠 Nexus: {b.rules.startingNexus}</p>}
                    {b.rules.spellsOnly && <p>🎯 Apenas Feitiços</p>}
                    {b.rules.unitsOnly && <p>⚔️ Apenas Unidades</p>}
                    {b.rules.doubleMana && <p>🔥 Mana dobrada</p>}
                  </div>
                  <Link
                    href={playHref("brawl", b.id, playerName)}
                    className="mt-3 block w-full rounded-lg bg-cyan-600 py-2 text-center font-black hover:bg-cyan-500"
                  >
                    🎮 Jogar
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
