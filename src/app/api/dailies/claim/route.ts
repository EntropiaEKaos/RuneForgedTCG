import { runtimeGate } from "@/lib/runtime-gates";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { players, playerDailies } from "@/db/schema";
import { and, eq, lt, sql } from "drizzle-orm";
import { DAILY_QUESTS, levelFromXp } from "@/lib/achievements";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { recordEconomyTransaction } from "@/lib/economy-ledger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  try {
    const identity = await requireStablePlayerIdentity(req);
    if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });

    const result = await db.transaction(async (tx) => {
      // Serialize all wallet mutations for this player before reading balances.
      // Reading first and locking afterwards can overwrite XP gained by a
      // concurrent transaction and produce stale balanceAfter ledger entries.
      const locked = await tx.execute(sql`SELECT id FROM players WHERE id = ${identity.playerId} FOR UPDATE`);
      if (!locked.rows.length) return null;
      const [player] = await tx.select().from(players).where(eq(players.id, identity.playerId)).limit(1);
      if (!player) return null;

      const now = new Date();
      await tx.delete(playerDailies).where(and(eq(playerDailies.playerId, player.id), lt(playerDailies.expiresAt, now)));
      const dailies = await tx.select().from(playerDailies).where(eq(playerDailies.playerId, player.id));
      let totalGold = 0, totalDust = 0, totalXp = 0;
      const claimed: string[] = [];

      for (const daily of dailies) {
        if (!daily.completed || daily.claimedAt || new Date(daily.expiresAt) <= now) continue;
        const quest = DAILY_QUESTS.find((q) => q.id === daily.questId);
        if (!quest) continue;
        const marked = await tx.update(playerDailies).set({ claimedAt: now }).where(and(eq(playerDailies.id, daily.id), sql`${playerDailies.claimedAt} IS NULL`)).returning({ id: playerDailies.id });
        if (!marked.length) continue;
        totalGold += quest.rewardGold; totalDust += quest.rewardDust; totalXp += quest.rewardXp; claimed.push(daily.questId);
      }

      if (totalGold || totalDust || totalXp) {
        const newXp = player.xp + totalXp;
        await tx.update(players).set({ gold: sql`${players.gold} + ${totalGold}`, dust: sql`${players.dust} + ${totalDust}`, xp: newXp, level: levelFromXp(newXp) }).where(eq(players.id, player.id));
        if (totalGold) await recordEconomyTransaction(tx, { playerId: player.id, currency: "gold", amount: totalGold, balanceAfter: player.gold + totalGold, reason: "daily_reward" });
        if (totalDust) await recordEconomyTransaction(tx, { playerId: player.id, currency: "dust", amount: totalDust, balanceAfter: player.dust + totalDust, reason: "daily_reward" });
        if (totalXp) await recordEconomyTransaction(tx, { playerId: player.id, currency: "xp", amount: totalXp, balanceAfter: player.xp + totalXp, reason: "daily_reward" });
      }

      const active = await tx.select().from(playerDailies).where(eq(playerDailies.playerId, player.id));
      const activeCount = active.filter((d) => new Date(d.expiresAt) > now && !d.claimedAt).length;
      if (activeCount < 3) {
        const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
        const existing = new Set(active.map((d) => d.questId));
        for (const quest of DAILY_QUESTS.filter((q) => !existing.has(q.id)).slice(0, 3 - activeCount)) {
          await tx.insert(playerDailies).values({ playerId: player.id, questId: quest.id, progress: 0, completed: false, expiresAt: tomorrow });
        }
      }
      return { claimed, rewards: { gold: totalGold, dust: totalDust, xp: totalXp } };
    });

    if (!result) return Response.json({ ok: false, error: "Player not found" }, { status: 404 });
    return Response.json({ ok: true, ...result });
  } catch { return Response.json({ ok: false, error: "Internal server error" }, { status: 500 }); }
}
