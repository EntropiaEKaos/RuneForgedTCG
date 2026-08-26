import Link from "next/link";
import { db } from "@/db";
import { matches, replays } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leaderboard — Runeforge: Legends of the Nexus",
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
    // table may not exist yet
  }

  const winRate = totals.total > 0 ? Math.round((totals.wins / totals.total) * 100) : 0;

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#1e293b,#0f172a_55%,#020617)] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-400 hover:text-white">
            ← Home
          </Link>
          <div className="flex gap-3">
            <Link href="/simulate" className="btn-ghost">
              🧪 Simulate
            </Link>
            <Link href="/forge" className="btn-ghost">
              🔨 Forge
            </Link>
            <Link href="/play" className="btn-primary">
              ⚔️ Play
            </Link>
          </div>
        </div>

        <h1 className="text-center text-4xl font-black text-amber-300 drop-shadow">🏆 Leaderboard</h1>

        <div className="mx-auto mt-6 grid max-w-lg grid-cols-3 gap-3 text-center">
          <Stat label="Matches" value={totals.total} />
          <Stat label="Player Wins" value={totals.wins} />
          <Stat label="Win Rate" value={`${winRate}%`} />
        </div>

        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-slate-200">Top Champions</h2>
          {leaderboard.length === 0 ? (
            <Empty />
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Player</th>
                    <th className="px-4 py-2 text-right">Wins</th>
                    <th className="px-4 py-2 text-right">Games</th>
                    <th className="px-4 py-2 text-right">Win %</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row, i) => (
                    <tr key={row.playerName} className="border-t border-white/5 hover:bg-white/5">
                      <td className="px-4 py-2 font-bold text-amber-300">
                        {["🥇", "🥈", "🥉"][i] ?? i + 1}
                      </td>
                      <td className="px-4 py-2 font-semibold">{row.playerName}</td>
                      <td className="px-4 py-2 text-right text-emerald-300">{row.wins}</td>
                      <td className="px-4 py-2 text-right">{row.games}</td>
                      <td className="px-4 py-2 text-right">
                        {row.games > 0 ? Math.round((row.wins / row.games) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-slate-200">Recent Battles</h2>
          {recent.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2">
              {recent.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{m.won ? "🏆" : "💀"}</span>
                    <span className="font-semibold">{m.playerName}</span>
                    <span className="text-xs text-slate-400">· {m.deckName}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {m.won ? (
                      <span className="text-emerald-300">Victory</span>
                    ) : (
                      <span className="text-red-300">Defeat</span>
                    )}{" "}
                    · {m.rounds} rounds · Nexus {m.nexusRemaining}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-slate-200">🎬 Authoritative Replays</h2>
          {recentReplays.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2">
              {recentReplays.map((r) => {
                let raw: unknown[] = [];
                try {
                  raw = JSON.parse(r.log);
                } catch {
                  raw = [];
                }
                const last = (raw[raw.length - 1] as string) ?? "";
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{r.won ? "🏆" : "💀"}</span>
                      <span className="font-semibold">{r.playerName}</span>
                      <span className="text-xs text-slate-400">
                        · {r.deckName} vs {r.aiDeckName}
                      </span>
                    </div>
                    <div className="max-w-[35%] truncate text-xs text-slate-500" title={last}>
                      {last}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{r.rounds} rounds</span>
                      <Link
                        href={`/replay/${r.id}`}
                        className="rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
                      >
                        ▶️ Rever
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-2xl font-black text-amber-300">{value}</div>
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-slate-400">
      No battles recorded yet. Be the first to enter the Nexus!
    </div>
  );
}
