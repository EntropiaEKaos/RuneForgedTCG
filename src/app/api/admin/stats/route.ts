import { NextRequest } from "next/server";
import { db } from "@/db";
import { matches, customDecks, customCards, replays, players } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, adminRoleAllowed } from "@/lib/admin-auth";
import { baseCardsOnly } from "@/game/cards";
import { DECKS } from "@/game/decks";
import { loadGameConfig } from "@/game/settings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, "qa")) return Response.json({ ok: false, error: `Role ${actor.role} cannot access admin statistics` }, { status: 403 });
  try {
    const config = await loadGameConfig();

    const [matchTotals] = await db
      .select({
        total: sql<number>`count(*)::int`,
        wins: sql<number>`coalesce(sum(case when ${matches.won} then 1 else 0 end),0)::int`,
      })
      .from(matches);

    const recentMatches = await db.select().from(matches).orderBy(desc(matches.createdAt)).limit(15);
    const recentReplays = await db.select().from(replays).orderBy(desc(replays.createdAt)).limit(10);
    const deckCount = await db.select({ n: sql<number>`count(*)::int` }).from(customDecks);
    const cardCount = await db.select({ n: sql<number>`count(*)::int` }).from(customCards);
    const enabledCards = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(customCards)
      .where(sql`${customCards.enabled} = true`);

    const topPlayers = await db
      .select({
        playerId: matches.playerId,
        playerName: players.name,
        games: sql<number>`count(*)::int`,
        wins: sql<number>`coalesce(sum(case when ${matches.won} then 1 else 0 end),0)::int`,
      })
      .from(matches)
      .leftJoin(players, eq(matches.playerId, players.id))
      .where(sql`${matches.playerId} IS NOT NULL`)
      .groupBy(matches.playerId, players.name)
      .orderBy(sql`sum(case when ${matches.won} then 1 else 0 end) desc`)
      .limit(10);

    const deckStats = await db
      .select({
        deckName: matches.deckName,
        games: sql<number>`count(*)::int`,
        wins: sql<number>`coalesce(sum(case when ${matches.won} then 1 else 0 end),0)::int`,
      })
      .from(matches)
      .groupBy(matches.deckName)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    return Response.json({
      ok: true,
      config,
      totals: {
        matches: matchTotals?.total ?? 0,
        wins: matchTotals?.wins ?? 0,
        customDecks: deckCount[0]?.n ?? 0,
        customCards: cardCount[0]?.n ?? 0,
        enabledCustomCards: enabledCards[0]?.n ?? 0,
        baseCards: baseCardsOnly().length,
        presetDecks: DECKS.length,
        replays: recentReplays.length,
      },
      topPlayers,
      deckStats,
      recentMatches,
      recentReplays: recentReplays.map((r) => ({
        id: r.id,
        playerName: r.playerName,
        deckName: r.deckName,
        aiDeckName: r.aiDeckName,
        won: r.won,
        rounds: r.rounds,
        createdAt: r.createdAt,
      })),
    });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
