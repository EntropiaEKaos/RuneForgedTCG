"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import SiteNav from "@/components/SiteNav";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import type { Boss, BrawlMode, Encounter, Puzzle } from "@/lib/game-modes";

type TabId = "expedition" | "puzzle" | "boss" | "brawl";
type Reward = { gold: number; dust: number; xp: number; pack?: string };
type ActivePromotionItem = {
  type?: string;
  name?: string;
  rules?: { brawlId?: string };
};

type PromotionsPayload = {
  ok?: boolean;
  items?: unknown[];
};

function playHref(mode: string, id: string): string {
  const params = new URLSearchParams({ mode, modeId: id });
  return `/play?${params.toString()}`;
}

function isActivePromotionItem(value: unknown): value is ActivePromotionItem {
  return Boolean(value && typeof value === "object");
}

export default function ModesClient({ puzzles: PUZZLES, bosses: BOSSES, brawls: BRAWLS, encounters: ENCOUNTERS }: { puzzles: Puzzle[]; bosses: Boss[]; brawls: BrawlMode[]; encounters: Encounter[] }) {
  const [tab, setTab] = useState<TabId>("expedition");
  const [featuredBrawlId, setFeaturedBrawlId] = useState<string | null>(null);
  const [featuredEventName, setFeaturedEventName] = useState<string | null>(null);

  useDeferredEffect(() => {
    fetch("/api/active-promotions", { cache: "no-store" })
      .then((response) => response.json() as Promise<PromotionsPayload>)
      .then((payload) => {
        if (!payload.ok || !Array.isArray(payload.items)) return;
        const brawlEvent = payload.items
          .filter(isActivePromotionItem)
          .find((item) => item.type === "brawl" && typeof item.rules?.brawlId === "string");
        if (!brawlEvent?.rules?.brawlId) return;
        setFeaturedBrawlId(brawlEvent.rules.brawlId);
        setFeaturedEventName(brawlEvent.name?.trim() || "Brawl da Semana");
      })
      .catch(() => {});
  }, []);

  const orderedBrawls = useMemo(() => {
    if (!featuredBrawlId) return BRAWLS;
    return [...BRAWLS].sort((a, b) => (a.id === featuredBrawlId ? -1 : b.id === featuredBrawlId ? 1 : 0));
  }, [BRAWLS, featuredBrawlId]);

  const tabs: Array<{ id: TabId; label: string; icon: string; count: number }> = [
    { id: "expedition", label: "Expedição", icon: "🧭", count: ENCOUNTERS.length },
    { id: "puzzle", label: "Puzzles", icon: "🧩", count: PUZZLES.length },
    { id: "boss", label: "Boss Battles", icon: "👹", count: BOSSES.length },
    { id: "brawl", label: "Brawls", icon: "⚔️", count: BRAWLS.length },
  ];

  return (
    <main className="rf-app-page modes-page">
      <SiteNav />
      <div className="rf-app-shell">
        <header className="rf-app-heading">
          <div>
            <p className="rf-eyebrow"><span /> ARQUIVOS DO NEXUS</p>
            <h1>Modos de jogo</h1>
            <p>Campanhas, desafios táticos e regras especiais. Cada tentativa é preparada e liquidada pelo fluxo autoritativo do servidor.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/forge" className="rf-button rf-button-secondary">FORJA</Link>
            <Link href="/play" className="rf-button rf-button-primary">PARTIDA LIVRE</Link>
          </div>
        </header>

        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo dos modos">
          <SummaryCard icon="🧭" label="Expedição" value={ENCOUNTERS.length} detail="capítulos autoritativos" />
          <SummaryCard icon="🧩" label="Puzzles" value={PUZZLES.length} detail="desafios táticos" />
          <SummaryCard icon="👹" label="Boss Battles" value={BOSSES.length} detail="encontros de alto risco" />
          <SummaryCard icon="⚔️" label="Brawls" value={BRAWLS.length} detail={featuredBrawlId ? "evento em destaque ativo" : "regras especiais"} />
        </section>

        {featuredBrawlId && (
          <div className="mb-5 rounded-2xl border border-amber-300/25 bg-amber-300/[.07] px-4 py-3" role="status">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-300">Evento publicado pelo Studio</p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-amber-50">⭐ {featuredEventName || "Brawl da Semana"}</p>
              <button type="button" onClick={() => setTab("brawl")} className="text-xs font-black uppercase tracking-wider text-amber-200 hover:text-white">Ver Brawl em destaque</button>
            </div>
          </div>
        )}

        <div className="mode-tabs" role="tablist" aria-label="Modos disponíveis">
          {tabs.map((item) => (
            <button
              type="button"
              id={`mode-tab-${item.id}`}
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`mode-tab ${tab === item.id ? "active" : ""}`}
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`mode-panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
            >
              <span>{item.icon} {item.label}</span>
              <span className="ml-2 rounded-full border border-white/10 px-1.5 py-0.5 text-[9px]">{item.count}</span>
            </button>
          ))}
        </div>

        {tab === "expedition" && (
          <section id="mode-panel-expedition" role="tabpanel" aria-labelledby="mode-tab-expedition">
            <ModeSectionHeader eyebrow="CAMPANHA" title="Expedição do Nexus" text="Avance por encontros com objetivo, mutador e recompensa próprios. O servidor emite a configuração da tentativa antes da partida." />
            <div className="grid gap-4 lg:grid-cols-3">
              {ENCOUNTERS.map((encounter) => (
                <article key={encounter.id} className="expedition-card" data-region={encounter.region.toLowerCase()}>
                  <header>
                    <span>{encounter.emoji}</span>
                    <div><small>{encounter.chapter}</small><h3>{encounter.name}</h3><p>{encounter.region} · <Difficulty value={encounter.difficulty} symbol="◆" /></p></div>
                  </header>
                  <p>{encounter.description}</p>
                  <div className="expedition-objective"><small>OBJETIVO</small><b>{encounter.objective}</b></div>
                  <div className="expedition-mutator"><small>MODIFICADOR · {encounter.mutator.label}</small><p>{encounter.mutator.description}</p></div>
                  <RewardStrip reward={encounter.reward} />
                  <footer><span>Tentativa autoritativa</span><Link href={playHref("expedition", encounter.id)}>Iniciar capítulo</Link></footer>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === "puzzle" && (
          <section id="mode-panel-puzzle" role="tabpanel" aria-labelledby="mode-tab-puzzle">
            <ModeSectionHeader eyebrow="LABORATÓRIO TÁTICO" title="Puzzles do Nexus" text="Resolva cenários fechados com recursos definidos. A tentativa é criada no servidor e o resultado é verificado antes da recompensa." />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {PUZZLES.map((puzzle) => (
                <article key={puzzle.id} className="rounded-2xl border border-purple-400/20 bg-slate-950/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-purple-300">Puzzle tático</p><h3 className="mt-1 text-lg font-black text-white">{puzzle.name}</h3></div>
                    <span className="rounded-full border border-purple-300/20 bg-purple-300/10 px-2 py-1 text-xs"><Difficulty value={puzzle.difficulty} symbol="★" /></span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{puzzle.description}</p>
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Objetivo</p>
                    <p className="mt-1 text-sm font-bold text-amber-200">🎯 {puzzle.goal}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">💡 {puzzle.hint}</p>
                  </div>
                  <RewardStrip reward={puzzle.reward} />
                  <Link href={playHref("puzzle", puzzle.id)} className="rf-button rf-button-primary mt-4 w-full text-center">ABRIR PUZZLE</Link>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === "boss" && (
          <section id="mode-panel-boss" role="tabpanel" aria-labelledby="mode-tab-boss">
            <ModeSectionHeader eyebrow="AMEAÇAS MAIORES" title="Boss Battles" text="Encontros especiais com Nexus assimétrico e regras próprias. A vitória só é creditada após replay autoritativo." />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {BOSSES.map((boss) => (
                <article key={boss.id} className="overflow-hidden rounded-2xl border border-red-400/25 bg-slate-950/55">
                  <div className="border-b border-red-400/10 bg-red-400/[.05] p-5 text-center">
                    <div className="text-6xl">{boss.emoji}</div>
                    <p className="mt-3 text-[10px] font-black uppercase tracking-[.16em] text-red-300">{boss.region}</p>
                    <h3 className="mt-1 text-xl font-black text-white">{boss.name}</h3>
                    <p className="mt-2 text-xs text-red-200"><Difficulty value={boss.difficulty} symbol="◆" /> ameaça</p>
                  </div>
                  <div className="p-4">
                    <p className="text-sm leading-6 text-slate-400">{boss.description}</p>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                      <Metric label="Seu Nexus" value={boss.playerNexusStart} />
                      <Metric label="Nexus do Boss" value={boss.aiNexusStart} />
                    </div>
                    <RewardStrip reward={boss.reward} />
                    <Link href={playHref("boss", boss.id)} className="rf-button rf-button-primary mt-4 w-full text-center">DESAFIAR BOSS</Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === "brawl" && (
          <section id="mode-panel-brawl" role="tabpanel" aria-labelledby="mode-tab-brawl">
            <ModeSectionHeader eyebrow="REGRAS ALTERNATIVAS" title="Brawls" text="Partidas com modificadores especiais. Eventos publicados pelo Studio podem destacar um Brawl sem exigir novo deploy." />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {orderedBrawls.map((brawl) => {
                const featured = brawl.id === featuredBrawlId;
                return (
                  <article key={brawl.id} className={`relative rounded-2xl border p-4 ${featured ? "border-amber-300/40 bg-amber-300/[.07] shadow-[0_0_25px_rgba(251,191,36,.12)]" : "border-cyan-300/20 bg-slate-950/50"}`}>
                    {featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-amber-200/20 bg-amber-300 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-slate-950">⭐ Brawl da Semana</span>}
                    <div className="text-center"><div className="text-5xl">{brawl.emoji}</div><p className={`mt-3 text-[10px] font-black uppercase tracking-[.16em] ${featured ? "text-amber-300" : "text-cyan-300"}`}>Brawl especial</p><h3 className="mt-1 text-lg font-black text-white">{brawl.name}</h3></div>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{brawl.description}</p>
                    <BrawlRules rules={brawl.rules} />
                    <Link href={playHref("brawl", brawl.id)} className="rf-button rf-button-primary mt-4 w-full text-center">JOGAR BRAWL</Link>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function SummaryCard({ icon, label, value, detail }: { icon: string; label: string; value: number; detail: string }) {
  return <div className="rounded-xl border border-white/10 bg-slate-950/45 p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">{label}</p><span>{icon}</span></div><p className="mt-1 text-2xl font-black text-white">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div>;
}

function ModeSectionHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <header className="mb-5"><p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">{eyebrow}</p><h2 className="mt-1 text-2xl font-black text-white">{title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{text}</p></header>;
}

function Difficulty({ value, symbol }: { value: number; symbol: string }) {
  return <>{symbol.repeat(Math.max(1, Math.trunc(value)))}</>;
}

function RewardStrip({ reward }: { reward: Reward }) {
  return (
    <div className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-300/[.045] p-3">
      <p className="text-[9px] font-black uppercase tracking-[.16em] text-emerald-300">Recompensa após verificação</p>
      <p className="mt-1 text-xs font-bold text-slate-300">+{reward.gold} 🪙 · +{reward.dust} 💠 · +{reward.xp} XP{reward.pack ? ` · 📦 ${reward.pack}` : ""}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p></div>;
}

function BrawlRules({ rules }: { rules: BrawlMode["rules"] }) {
  const items = [
    rules.startingMana ? `⚡ Mana inicial ${rules.startingMana}` : null,
    rules.startingHand ? `✋ Mão inicial ${rules.startingHand}` : null,
    rules.startingNexus ? `💠 Nexus ${rules.startingNexus}` : null,
    rules.spellsOnly ? "🎯 Apenas Feitiços" : null,
    rules.unitsOnly ? "⚔️ Apenas Unidades" : null,
    rules.doubleMana ? "🔥 Mana dobrada" : null,
  ].filter((item): item is string => Boolean(item));

  return <div className="mt-4 flex flex-wrap gap-2">{items.length ? items.map((item) => <span key={item} className="rounded-full border border-white/10 bg-white/[.035] px-2.5 py-1 text-[10px] font-bold text-slate-300">{item}</span>) : <span className="text-xs text-slate-500">Sem modificadores adicionais.</span>}</div>;
}
