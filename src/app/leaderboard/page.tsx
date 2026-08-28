import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import { db } from "@/db";
import { matches, replays } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leaderboard — RuneForge",
  description: "Classificação, atividade recente e replays registrados do Nexus.",
};

export default async function LeaderboardPage() {
  let recent: (typeof matches.$inferSelect)[] = [];
  let leaderboard: { playerName: string; games: number; wins: number }[] = [];
  let totals = { total: 0, wins: 0 };
  let recentReplays: (typeof replays.$inferSelect)[] = [];

  try {
    recent = await db.select().from(matches).orderBy(desc(matches.createdAt)).limit(15);
    const [t] = await db
      .select({
        total: sql<number>`count(*)::int`,
        wins: sql<number>`coalesce(sum(case when ${matches.won} then 1 else 0 end),0)::int`,
      })
      .from(matches);
    totals = t ?? totals;
    leaderboard = await db
      .select({
        playerName: matches.playerName,
        games: sql<number>`count(*)::int`,
        wins: sql<number>`coalesce(sum(case when ${matches.won} then 1 else 0 end),0)::int`,
      })
      .from(matches)
      .groupBy(matches.playerName)
      .orderBy(sql`sum(case when ${matches.won} then 1 else 0 end) desc`)
      .limit(10);
    recentReplays = await db.select().from(replays).orderBy(desc(replays.createdAt)).limit(8);
  } catch {
    // Database tables may not exist yet in a fresh local environment.
  }

  const winRate = totals.total > 0 ? Math.round((totals.wins / totals.total) * 100) : 0;

  return (
    <main className="rf-app-page">
      <SiteNav />
      <div className="rf-app-shell max-w-6xl">
        <header className="rf-app-heading">
          <div>
            <p className="rf-eyebrow"><span /> REGISTRO COMPETITIVO</p>
            <h1>Hall do Nexus</h1>
            <p>Vitórias, atividade recente e registros de batalha preservados para inspeção pelos forjadores.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/simulate" className="rf-button rf-button-secondary">◇ SIMULAR</Link>
            <Link href="/play" className="rf-button rf-button-primary">⚔ ENTRAR NO NEXUS</Link>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo das batalhas registradas">
          <Stat label="Partidas registradas" value={totals.total} detail="Histórico local" />
          <Stat label="Vitórias de jogadores" value={totals.wins} detail="Resultados confirmados" />
          <Stat label="Taxa de vitória" value={`${winRate}%`} detail="Sobre partidas registradas" />
        </section>

        <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,.65fr)]">
          <section aria-labelledby="ranking-heading">
            <SectionHeading id="ranking-heading" eyebrow="CLASSIFICAÇÃO" title="Top forjadores" count={leaderboard.length} />
            {leaderboard.length === 0 ? (
              <Empty title="O Hall ainda aguarda seu primeiro nome" copy="Conclua uma batalha para começar a formar a classificação desta instalação." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20 shadow-[0_24px_70px_rgba(0,0,0,.24)]">
                <table className="w-full min-w-[560px] text-sm">
                  <caption className="sr-only">Classificação dos dez jogadores com mais vitórias registradas</caption>
                  <thead className="border-b border-white/10 bg-white/[0.035] text-left text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Pos.</th>
                      <th scope="col" className="px-4 py-3">Jogador</th>
                      <th scope="col" className="px-4 py-3 text-right">Vitórias</th>
                      <th scope="col" className="px-4 py-3 text-right">Partidas</th>
                      <th scope="col" className="px-4 py-3 text-right">Aproveitamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((row, i) => {
                      const rate = row.games > 0 ? Math.round((row.wins / row.games) * 100) : 0;
                      return (
                        <tr key={row.playerName} className="border-t border-white/[0.06] transition first:border-t-0 hover:bg-white/[0.035]">
                          <td className="px-4 py-3">
                            <span className={`grid h-8 w-8 place-items-center rounded-lg border text-xs font-black ${i < 3 ? "border-amber-300/25 bg-amber-300/[0.07] text-amber-200" : "border-white/10 bg-white/[0.025] text-slate-500"}`}>
                              {i + 1}
                            </span>
                          </td>
                          <th scope="row" className="px-4 py-3 font-bold text-slate-100">{row.playerName}</th>
                          <td className="px-4 py-3 text-right font-black text-emerald-300">{row.wins}</td>
                          <td className="px-4 py-3 text-right text-slate-400">{row.games}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex min-w-14 justify-center rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-bold text-slate-300">{rate}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="recent-heading">
            <SectionHeading id="recent-heading" eyebrow="TELEMETRIA" title="Batalhas recentes" count={recent.length} />
            {recent.length === 0 ? (
              <Empty title="Nenhuma batalha registrada" copy="Os resultados recentes aparecerão aqui após as primeiras partidas." />
            ) : (
              <ol className="space-y-2">
                {recent.map((m) => (
                  <li key={m.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/15 hover:bg-white/[0.045]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${m.won ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.55)]" : "bg-red-400"}`} aria-hidden="true" />
                          <p className="truncate font-bold text-slate-100">{m.playerName}</p>
                        </div>
                        <p className="mt-1 truncate pl-4 text-xs text-slate-500">{m.deckName}</p>
                      </div>
                      <span className={`rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${m.won ? "border-emerald-300/15 bg-emerald-500/10 text-emerald-300" : "border-red-300/15 bg-red-500/10 text-red-300"}`}>
                        {m.won ? "Vitória" : "Derrota"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2 text-[10px] uppercase tracking-[0.08em] text-slate-600">
                      <span>{m.rounds} rodadas</span>
                      <span>Nexus {m.nexusRemaining}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <section className="mt-10" aria-labelledby="replays-heading">
          <div className="mb-4 flex flex-col gap-2 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300/65">ARQUIVO DE BATALHA</p>
              <h2 id="replays-heading" className="mt-1 text-2xl font-black text-slate-100">Replays registrados</h2>
            </div>
            <p className="max-w-lg text-xs leading-5 text-slate-500">Cada registro preserva o desfecho da batalha para inspeção. Abra o replay para solicitar a verificação de integridade quando houver snapshot autoritativo disponível.</p>
          </div>
          {recentReplays.length === 0 ? (
            <Empty title="Nenhum replay disponível" copy="Quando uma partida gerar um replay persistido, a revisão aparecerá nesta seção." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {recentReplays.map((r) => {
                let raw: unknown[] = [];
                try {
                  raw = JSON.parse(r.log);
                } catch {
                  raw = [];
                }
                const last = (raw[raw.length - 1] as string) ?? "";
                return (
                  <article key={r.id} className="rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.04),rgba(255,255,255,.015))] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">REPLAY #{r.id}</p>
                        <h3 className="mt-1 truncate font-black text-slate-100">{r.playerName}</h3>
                        <p className="mt-1 truncate text-xs text-slate-500">{r.deckName} <span className="text-slate-700">vs</span> {r.aiDeckName}</p>
                      </div>
                      <span className={`rounded-md border px-2 py-1 text-[9px] font-black uppercase ${r.won ? "border-emerald-300/15 bg-emerald-500/10 text-emerald-300" : "border-red-300/15 bg-red-500/10 text-red-300"}`}>
                        {r.won ? "Vitória" : "Derrota"}
                      </span>
                    </div>
                    <p className="mt-4 truncate rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-xs text-slate-500" title={last}>
                      {last || "Registro final indisponível"}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600">{r.rounds} rodadas</span>
                      <Link href={`/replay/${r.id}`} className="rf-button rf-button-secondary min-h-9 !px-3" aria-label={`Rever partida de ${r.playerName}`}>
                        ▶ REVER
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SectionHeading({ id, eyebrow, title, count }: { id: string; eyebrow: string; title: string; count: number }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3 border-b border-white/10 pb-3">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">{eyebrow}</p>
        <h2 id={id} className="mt-1 text-xl font-black text-slate-100">{title}</h2>
      </div>
      <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-bold text-slate-400">{count}</span>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.015))] p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" aria-hidden="true" />
      <div className="text-3xl font-black tracking-tight text-amber-200">{value}</div>
      <div className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">{label}</div>
      <div className="mt-1 text-xs text-slate-600">{detail}</div>
    </div>
  );
}

function Empty({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
      <div className="text-3xl text-amber-200/60" aria-hidden="true">◇</div>
      <p className="mt-3 font-bold text-slate-300">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">{copy}</p>
    </div>
  );
}
