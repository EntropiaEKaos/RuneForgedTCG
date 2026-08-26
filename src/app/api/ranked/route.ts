import { NextRequest } from "next/server";
import { db } from "@/db";
import { players, rankedMatches } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getRuntimeRankTiers } from "@/lib/control-plane";
import { loadGameConfig } from "@/game/settings";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { rankedOperational } from "@/lib/runtime-gates";
import { playerRankedDto } from "@/lib/player-public";
import { rankTierFor } from "@/lib/ranked";
import { RANKED_DECK_POOL_VERSION, RANKED_PRECONS, RANKED_RULESET_VERSION } from "@/game/ranked-decks";
import { findOpenRankedSeason } from "@/lib/ranked-season";

export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  try {
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });

    const [player] = await db.select().from(players).where(eq(players.id, identity.playerId)).limit(1);
    if (!player) return Response.json({ ok: false, error: "Player not found" }, { status: 404 });

    const tiers = await getRuntimeRankTiers();
    if (!tiers.length) return Response.json({ ok: false, error: "Rank tiers are not configured" }, { status: 503 });
    const config = await loadGameConfig();
    const tier = rankTierFor(tiers, player.mmr);
    const peakTier = rankTierFor(tiers, player.peakMmr);
    const season = await findOpenRankedSeason(db);
    const history = await db.select().from(rankedMatches).where(eq(rankedMatches.playerId, player.id)).orderBy(desc(rankedMatches.createdAt)).limit(20);
    const leaderboard = await db.select({
      id: players.id,
      name: players.name,
      mmr: players.mmr,
      rankedWins: players.rankedWins,
      rankedLosses: players.rankedLosses,
      avatar: players.avatar,
      title: players.title,
    }).from(players).orderBy(desc(players.mmr)).limit(config.advanced.ranked.leaderboardSize);

    return Response.json({
      ok: true,
      rankedEnabled: rankedOperational(config) && Boolean(season),
      rankedConfigured: config.rankedEnabled,
      rankedReleaseCertified: process.env.RANKED_RELEASE_CERTIFIED === "true",
      season,
      rankedRulesVersion: RANKED_RULESET_VERSION,
      rankedDeckPoolVersion: RANKED_DECK_POOL_VERSION,
      certifiedDecks: RANKED_PRECONS.map(({ id, name, emoji, cards, formatId }) => ({ id, name, emoji, cardCount: cards.length, formatId })),
      player: { ...playerRankedDto(player), tier, peakTier },
      history,
      leaderboard,
      tiers,
    });
  } catch (error) {
    console.error("[ranked] GET failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Ranked settlement is intentionally single-authority: settlePvpRoom() records
 * both player perspectives and applies both MMR changes atomically. Keeping a
 * second HTTP settlement path here previously created an unreachable/ambiguous
 * authority because generic match tokens cannot be issued for Ranked.
 */
export async function POST() {
  return Response.json({
    ok: false,
    error: "Ranked settlement is performed by the authoritative PvP room settlement.",
    code: "RANKED_SETTLEMENT_PVP_ONLY",
  }, { status: 410 });
}
