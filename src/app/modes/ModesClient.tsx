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
type ModeProgressItem = {
  modeType: TabId;
  modeId: string;
  claimedAt: string;
};

type PromotionsPayload = {
  ok?: boolean;
  items?: unknown[];
};

type ModeProgressPayload = {
  ok?: boolean;
  completed?: unknown[];
};

function playHref(mode: string, id: string): string {
  const params = new URLSearchParams({ mode, modeId: id });
  return `/play?${params.toString()}`;
}

function isActivePromotionItem(value: unknown): value is ActivePromotionItem {
  return Boolean(value && typeof value === "object");
}

function isModeProgressItem(value: unknown): value is ModeProgressItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ModeProgressItem>;
  return ["expedition", "puzzle", "boss", "brawl"].includes(String(item.modeType))
    && typeof item.modeId === "string"
    && typeof item.claimedAt === "string";
}

export default function ModesClient({ puzzles: PUZZLES, bosses: BOSSES, brawls: BRAWLS, encounters: ENCOUNTERS }: { puzzles: Puzzle[]; bosses: Boss[]; brawls: BrawlMode[]; encounters: Encounter[] }) {
  const [tab, setTab] = useState<TabId>("expedition");
  const [featuredBrawlId, setFeaturedBrawlId] = useState<string | null>(null);
  const [featuredEventName, setFeaturedEventName] = useState<string | null>(null);
  const [completedModes, setCompletedModes] = useState<ModeProgressItem[]>([]);
  const [progressStatus, setProgressStatus] = useState<"loading" | "ready" | "unavailable">("loading");

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

  useDeferredEffect(() => {
    fetch("/api/modes/progress", { credentials: "include", cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Mode progress unavailable");
        return response.json() as Promise<ModeProgressPayload>;
      })
      .then((payload) => {
        if (!payload.ok || !Array.isArray(payload.completed)) throw new Error("Mode progress unavailable");
        setCompletedModes(payload.completed.filter(isModeProgressItem));
        setProgressStatus("ready");
      })
      .catch(() => setProgressStatus("unavailable"));
  }, []);

  const orderedBrawls = useMemo(() => {
    if (!featuredBrawlId) return BRAWLS;
    return [...BRAWLS].sort((a, b) => (a.id === featuredBrawlId ? -1 : b.id === featuredBrawlId ? 1 : 0));
  }, [BRAWLS, featuredBrawlId]);

  const completionSet = useMemo(() => new Set(completedModes.map((item) => `${item.modeType}:${item.modeId}`)), [completedModes]);
  const isCompleted = (modeType: TabId, modeId: string) => completionSet.has(`${modeType}:${modeId}`);
  const categoryCompletion = useMemo(() => ({
    expedition: ENCOUNTERS.filter((item) => completionSet.has(`expedition:${item.id}`)).length,
    puzzle: PUZZLES.filter((item) => completionSet.has(`puzzle:${item.id}`)).length,
    boss: BOSSES.filter((item) => completionSet.has(`boss:${item.id}`)).length,
    brawl: BRAWLS.filter((item) => completionSet.has(`brawl:${item.id}`)).length,
  }), [BOSSES, BRAWLS, ENCOUNTERS, PUZZLES, completionSet]);
  const totalModes = ENCOUNTERS.length + PUZZLES.length + BOSSES.length + BRAWLS.length;
  const completedCount = categoryCompletion.expedition + categoryCompletion.puzzle + categoryCompletion.boss + categoryCompletion.brawl;
  const completionPercent = totalModes > 0 ? Math.round((completedCount / totalModes) * 100) : 0;
  const latestCompletion = useMemo(() => completedModes
    .filter((item) => completionSet.has(`${item.modeType}:${item.modeId}`))
    .sort((a, b) => new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime())[0] ?? null, [completedModes, completionSet]);

  const tabs: Array<{ id: TabId; label: string; icon: string; count: number; complete: number }> = [
    { id: "expedition", label: "Expedição", icon: "🧭", count: ENCOUNTERS.length, complete: categoryCompletion.expedition },
    { id: "puzzle", label: "Puzzles", icon: "🧩", count: PUZZLES.length, complete: categoryCompletion.puzzle },
    { id: "boss", label: "Boss Battles", icon: "👹", count: BOSSES.length, complete: categoryCompletion.boss },
    { id: "brawl", label: "Brawls", icon: "⚔️", count: BRAWLS.length, complete: categoryCompletion.brawl },
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
          <SummaryCard icon="🧭" label="Expedição" value={ENCOUNTERS.length} detail={`${categoryCompletion.expedition} conquistado(s)`} />
          <SummaryCard icon="🧩" label="Puzzles" value={PUZZLES.length} detail={`${categoryCompletion.puzzle} resolvido(s)`} />
          <SummaryCard icon="👹" label="Boss Battles" value={BOSSES.length} detail={`${categoryCompletion.boss} derrotado(s)`} />
          <SummaryCard icon="⚔️" label="Brawls" value={BRAWLS.length} detail={featuredBrawlId ? `${categoryCompletion.brawl} vencido(s) · evento ativo` : `${categoryCompletion.brawl} vencido(s)`} />
        </section>

        <ProgressOverview
          completed={completedCount}
          total={totalModes}
          percent={completionPercent}
          status={progressStatus}
          latest={latestCompletion}
          categories={tabs}
          onSelect={setTab}
        />

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
              <span className="ml-2 rounded-full border border-white/10 px-1.5 py-0.5 text-[9px]">{item.complete}/{item.count}</span>
            </button>
          ))}
        </div>

        {tab === "expedition" && (
          <section id="mode-panel-expedition" role="tabpanel" aria-labelledby="mode-tab-expedition">
            <ModeSectionHeader eyebrow="CAMPANHA" title="Expedição do Nexus" text="Avance por encontros com objetivo, mutador e recompensa próprios. O servidor emite a configuração da tentativa antes da partida." />
            <div className="grid gap-4 lg:grid-cols-3">
              {ENCOUNTERS.map((encounter) => {
                const completed = isCompleted("expedition", encounter.id);
                return (
                  <article key={encounter.id} className={`expedition-card ${completed ? "ring-1 ring-emerald-300/40" : ""}`} data-region={encounter.region.toLowerCase()}>
                    <header>
                      <span>{encounter.emoji}</span>
                      <div><small>{encounter.chapter}</small><h3>{encounter.name}</h3><p>{encounter.region} · <Difficulty value={encounter.difficulty} symbol="◆" /></p></div>
                      <CompletionBadge completed={completed} />
                    </header>
                    <p>{encounter.description}</p>
                    <div className="expedition-objective"><small>OBJETIVO</small><b>{encounter.objective}</b></div>
                    <div className="expedition-mutator"><small>MODIFICADOR · {encounter.mutator.label}</small><p>{encounter.mutator.description}</p></div>
                    <RewardStrip reward={encounter.reward} completed={completed} />
                    <footer><span>{completed ? "Conquista registrada" : "Tentativa autoritativa"}</span><Link href={playHref("expedition", encounter.id)}>{completed ? "Jogar novamente" : "Iniciar capítulo"}</Link></footer>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {tab === "puzzle" && (
          <section id="mode-panel-puzzle" role="tabpanel" aria-labelledby="mode-tab-puzzle">
            <ModeSectionHeader eyebrow="LABORATÓRIO TÁTICO" title="Puzzles do Nexus" text="Resolva cenários fechados com recursos definidos. A tentativa é criada no servidor e o resultado é verificado antes da recompensa." />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {PUZZLES.map((puzzle) => {
                const completed = isCompleted("puzzle", puzzle.id);
                return (
                  <article key={puzzle.id} className={`rounded-2xl border bg-slate-950/50 p-4 ${completed ? "border-emerald-300/35 ring-1 ring-emerald-300/20" : "border-purple-400/20"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-purple-300">Puzzle tático</p><h3 className="mt-1 text-lg font-black text-white">{puzzle.name}</h3></div>
                      <div className="flex flex-col items-end gap-2"><span className="rounded-full border border-purple-300/20 bg-purple-300/10 px-2 py-1 text-xs"><Difficulty value={puzzle.difficulty} symbol="★" /></span><CompletionBadge completed={completed} /></div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{puzzle.description}</p>
                    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Objetivo</p>
                      <p className="mt-1 text-sm font-bold text-amber-200">🎯 {puzzle.goal}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">💡 {puzzle.hint}</p>
                    </div>
                    <RewardStrip reward={puzzle.reward} completed={completed} />
                    <Link href={playHref("puzzle", puzzle.id)} className="rf-button rf-button-primary mt-4 w-full text-center">{completed ? "REJOGAR PUZZLE" : "ABRIR PUZZLE"}</Link>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {tab === "boss" && (
          <section id="mode-panel-boss" role="tabpanel" aria-labelledby="mode-tab-boss">
            <ModeSectionHeader eyebrow="AMEAÇAS MAIORES" title="Boss Battles" text="Encontros especiais com Nexus assimétrico e regras próprias. A vitória só é creditada após replay autoritativo." />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {BOSSES.map((boss) => {
                const completed = isCompleted("boss", boss.id);
                return (
                  <article key={boss.id} className={`overflow-hidden rounded-2xl border bg-slate-950/55 ${completed ? "border-emerald-300/35 ring-1 ring-emerald-300/20" : "border-red-400/25"}`}>
                    <div className="relative border-b border-red-400/10 bg-red-400/[.05] p-5 text-center">
                      <div className="absolute right-3 top-3"><CompletionBadge completed={completed} /></div>
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
                      <RewardStrip reward={boss.reward} completed={completed} />
                      <Link href={playHref("boss", boss.id)} className="rf-button rf-button-primary mt-4 w-full text-center">{completed ? "DESAFIAR NOVAMENTE" : "DESAFIAR BOSS"}</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {tab === "brawl" && (
          <section id="mode-panel-brawl" role="tabpanel" aria-labelledby="mode-tab-brawl">
            <ModeSectionHeader eyebrow="REGRAS ALTERNATIVAS" title="Brawls" text="Partidas com modificadores especiais. Eventos publicados pelo Studio podem destacar um Brawl sem exigir novo deploy." />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {orderedBrawls.map((brawl) => {
                const featured = brawl.id === featuredBrawlId;
                const completed = isCompleted("brawl", brawl.id);
                return (
                  <article key={brawl.id} className={`relative rounded-2xl border p-4 ${completed ? "border-emerald-300/35 ring-1 ring-emerald-300/20" : featured ? "border-amber-300/40 bg-amber-300/[.07] shadow-[0_0_25px_rgba(251,191,36,.12)]" : "border-cyan-300/20 bg-slate-950/50"} ${featured && completed ? "bg-amber-300/[.07] shadow-[0_0_25px_rgba(251,191,36,.12)]" : ""}`}>
                    {featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-amber-200/20 bg-amber-300 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-slate-950">⭐ Brawl da Semana</span>}
                    <div className="absolute right-3 top-3"><CompletionBadge completed={completed} /></div>
                    <div className="text-center"><div className="text-5xl">{brawl.emoji}</div><p className={`mt-3 text-[10px] font-black uppercase tracking-[.16em] ${featured ? "text-amber-300" : "text-cyan-300"}`}>Brawl especial</p><h3 className="mt-1 text-lg font-black text-white">{brawl.name}</h3></div>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{brawl.description}</p>
                    <BrawlRules rules={brawl.rules} />
                    {completed && <div className="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-300/[.07] p-3 text-[10px] font-black uppercase tracking-[.16em] text-emerald-300">✓ Vitória e recompensa registradas</div>}
                    <Link href={playHref("brawl", brawl.id)} className="rf-button rf-button-primary mt-4 w-full text-center">{completed ? "JOGAR NOVAMENTE" : "JOGAR BRAWL"}</Link>
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

function ProgressOverview({ completed, total, percent, status, latest, categories, onSelect }: {
  completed: number;
  total: number;
  percent: number;
  status: "loading" | "ready" | "unavailable";
  latest: ModeProgressItem | null;
  categories: Array<{ id: TabId; label: string; icon: string; count: number; complete: number }>;
  onSelect: (id: TabId) => void;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-emerald-300/[.06] via-slate-950/70 to-cyan-300/[.04]" aria-label="Mapa de conquistas">
      <div className="grid gap-5 p-5 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-300">MAPA DE CONQUISTAS</p>
          <div className="mt-2 flex items-end gap-3"><strong className="text-4xl font-black text-white">{status === "ready" ? `${percent}%` : "—"}</strong><span className="pb-1 text-sm font-bold text-slate-400">do arquivo dominado</span></div>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
            {status === "loading" ? "Sincronizando suas vitórias verificadas pelo servidor…" : status === "unavailable" ? "O catálogo está disponível, mas o progresso pessoal exige uma sessão de jogador ativa." : `${completed} de ${total} desafios já tiveram a vitória validada e a recompensa liquidada.`}
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[.06]" aria-label={`${completed} de ${total} desafios concluídos`}><div className="h-full rounded-full bg-emerald-300 transition-all" style={{ width: `${status === "ready" ? percent : 0}%` }} /></div>
          {latest && <p className="mt-3 text-xs text-emerald-100/70">Último selo: <b className="text-emerald-200">{latest.modeType} · {latest.modeId}</b> · {new Date(latest.claimedAt).toLocaleDateString("pt-BR")}</p>}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {categories.map((item) => (
            <button key={item.id} type="button" onClick={() => onSelect(item.id)} className="group rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-emerald-300/30 hover:bg-emerald-300/[.04]">
              <div className="flex items-center justify-between gap-3"><span className="text-lg">{item.icon}</span><b className="text-xs text-emerald-200">{item.complete}/{item.count}</b></div>
              <p className="mt-2 text-xs font-black uppercase tracking-[.12em] text-white">{item.label}</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[.06]"><i className="block h-full rounded-full bg-emerald-300/70" style={{ width: `${item.count ? Math.round((item.complete / item.count) * 100) : 0}%` }} /></div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompletionBadge({ completed }: { completed: boolean }) {
  if (!completed) return null;
  return <span className="shrink-0 rounded-full border border-emerald-200/20 bg-emerald-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-200">✓ Conquistado</span>;
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

function RewardStrip({ reward, completed = false }: { reward: Reward; completed?: boolean }) {
  return (
    <div className={`mt-4 rounded-xl border p-3 ${completed ? "border-emerald-300/25 bg-emerald-300/[.07]" : "border-emerald-300/15 bg-emerald-300/[.045]"}`}>
      <p className="text-[9px] font-black uppercase tracking-[.16em] text-emerald-300">{completed ? "✓ Recompensa já resgatada" : "Recompensa após verificação"}</p>
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
