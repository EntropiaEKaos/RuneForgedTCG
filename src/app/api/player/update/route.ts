import { runtimeGate } from "@/lib/runtime-gates";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { matches, players, playerAchievements, playerDailies } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ACHIEVEMENTS, DAILY_QUESTS, levelFromXp } from "@/lib/achievements";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { recordEconomyTransaction } from "@/lib/economy-ledger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  try {
    const body = await req.json();
    const identity = await requireStablePlayerIdentity(req);
    if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const matchId = body.matchId !== undefined ? Number(body.matchId) : null;

    const result = await db.transaction(async (tx) => {
      const [player] = await tx.select().from(players).where(eq(players.id, identity.playerId)).limit(1);
      if (!player) return null;
      await tx.execute(sql`SELECT id FROM players WHERE id = ${player.id} FOR UPDATE`);
      // The pre-lock row is identity discovery only. Always re-read after the
      // lock so concurrent XP/economy mutations cannot be overwritten by a
      // stale absolute XP/level write and ledger balanceAfter stays truthful.
      const [fresh] = await tx.select().from(players).where(eq(players.id, player.id)).limit(1);
      if (!fresh) return null;

      let match;
      if (matchId && Number.isFinite(matchId)) {
        [match] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1);
      } else {
        [match] = await tx.select().from(matches).where(and(eq(matches.playerId, fresh.id), eq(matches.rewardsClaimed, false))).orderBy(sql`${matches.createdAt} DESC`).limit(1);
      }
      if (!match || match.playerId !== fresh.id || match.rewardsClaimed) return { alreadyClaimed: true };
      await tx.execute(sql`SELECT id FROM matches WHERE id = ${match.id} FOR UPDATE`);
      const [lockedMatch] = await tx.select().from(matches).where(eq(matches.id, match.id)).limit(1);
      if (!lockedMatch || lockedMatch.rewardsClaimed) return { alreadyClaimed: true };

      const won = lockedMatch.won;
      let xpGain = won ? 30 : 10;
      let goldGain = won ? 20 : 5;
      let dustGain = 0;
      const newXp = fresh.xp + xpGain;
      const newLevel = levelFromXp(newXp);
      const leveledUp = newLevel > fresh.level;
      if (leveledUp) { goldGain += 50; dustGain += 25; }

      const achievementIds = ACHIEVEMENTS.map((a) => a.id);
      const dailyIds = DAILY_QUESTS.map((q) => q.id);
      const [achRows, dailyRows] = await Promise.all([
        tx.select().from(playerAchievements).where(and(eq(playerAchievements.playerId, fresh.id), inArray(playerAchievements.achievementId, achievementIds))),
        tx.select().from(playerDailies).where(and(eq(playerDailies.playerId, fresh.id), inArray(playerDailies.questId, dailyIds))),
      ]);
      const achMap = new Map(achRows.map((r) => [r.achievementId, r]));
      const dailyMap = new Map(dailyRows.map((r) => [r.questId, r]));
      const achievements: Array<{ achievementId: string; progress: number; completed: boolean }> = [];

      const bumpAchievement = async (id: string, req: number) => {
        const ex = achMap.get(id);
        if (ex) {
          if (ex.completed) return;
          const progress = Math.min(req, ex.progress + 1);
          const completed = progress >= req;
          await tx.update(playerAchievements).set({ progress, completed }).where(eq(playerAchievements.id, ex.id));
          achievements.push({ achievementId: id, progress, completed });
        } else {
          const completed = req <= 1;
          await tx.insert(playerAchievements).values({ playerId: fresh.id, achievementId: id, progress: 1, completed });
          achievements.push({ achievementId: id, progress: 1, completed });
        }
      };
      if (won) for (const a of ACHIEVEMENTS.filter((a) => a.type === "wins")) await bumpAchievement(a.id, a.requirement);
      for (const a of ACHIEVEMENTS.filter((a) => a.type === "games")) await bumpAchievement(a.id, a.requirement);

      const now = new Date();
      const dailies: Array<{ questId: string; progress: number; completed: boolean }> = [];
      const bumpDaily = async (id: string, req: number, amount = 1) => {
        const ex = dailyMap.get(id);
        if (!ex || ex.completed || new Date(ex.expiresAt) <= now || amount <= 0) return;
        const progress = Math.min(req, ex.progress + amount);
        const completed = progress >= req;
        await tx.update(playerDailies).set({ progress, completed }).where(eq(playerDailies.id, ex.id));
        dailies.push({ questId: id, progress, completed });
      };
      if (won) await bumpDaily("daily_win1", 1);
      await bumpDaily("daily_play3", 3);
      const eventLog = Array.isArray(lockedMatch.eventLog) ? lockedMatch.eventLog as Array<{ type?: string; player?: string; amount?: number }> : [];
      const nexusDamage = eventLog.reduce((sum, event) => sum + (event.type === "NEXUS_DAMAGED" && event.player === "ai" ? Math.max(0, Number(event.amount) || 0) : 0), 0);
      await bumpDaily("daily_damage", 50, nexusDamage);

      await tx.update(players).set({ xp: newXp, level: newLevel, gold: sql`${players.gold} + ${goldGain}`, dust: sql`${players.dust} + ${dustGain}` }).where(eq(players.id, fresh.id));
      await recordEconomyTransaction(tx, { playerId: fresh.id, currency: "xp", amount: xpGain, balanceAfter: newXp, reason: "match_reward", referenceType: "match", referenceId: String(lockedMatch.id) });
      await recordEconomyTransaction(tx, { playerId: fresh.id, currency: "gold", amount: goldGain, balanceAfter: fresh.gold + goldGain, reason: "match_reward", referenceType: "match", referenceId: String(lockedMatch.id) });
      if (dustGain) await recordEconomyTransaction(tx, { playerId: fresh.id, currency: "dust", amount: dustGain, balanceAfter: fresh.dust + dustGain, reason: "match_reward", referenceType: "match", referenceId: String(lockedMatch.id) });
      const claimed = await tx.update(matches).set({ rewardsClaimed: true }).where(eq(matches.id, lockedMatch.id)).returning({ id: matches.id });
      if (!claimed.length) return { alreadyClaimed: true };

      return { matchId: lockedMatch.id, won, xpGain, goldGain, dustGain, leveledUp, newLevel, achievements, dailies };
    });

    if (!result) return Response.json({ ok: false, error: "Player not found" }, { status: 404 });
    if ("alreadyClaimed" in result) return Response.json({ ok: false, error: "Nenhuma partida recompensável encontrada." }, { status: 409 });
    return Response.json({ ok: true, ...result });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
