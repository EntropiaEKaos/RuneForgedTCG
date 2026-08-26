import { runtimeGate } from "@/lib/runtime-gates";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { players, playerPacks } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { recordEconomyTransaction } from "@/lib/economy-ledger";
import { getRuntimeLoginRewards } from "@/lib/control-plane";
import { loadGameConfig } from "@/game/settings";

function rewardFor(rewards: Awaited<ReturnType<typeof getRuntimeLoginRewards>>, streak: number) {
  const day = ((streak - 1) % Math.max(1, rewards.length)) + 1;
  return rewards.find((reward) => reward.day === day) ?? rewards[0];
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  try {
    const body = await req.json();
    const requestedName = String(body.name || "").trim().slice(0, 40);
    const identity = await requireStablePlayerIdentity(req);
    if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });

    const rewards = await getRuntimeLoginRewards();
    if (!rewards.length) return Response.json({ ok: false, error: "Login rewards are not configured" }, { status: 503 });
    const config = await loadGameConfig();
    const result = await db.transaction(async (tx) => {
      const locked = await tx.execute(sql`SELECT id FROM players WHERE id = ${identity.playerId} FOR UPDATE`);
      if (!locked.rows.length) return null;
      const [player] = await tx.select().from(players).where(eq(players.id, identity.playerId)).limit(1);
      if (!player) return null;

      const now = new Date();
      const lastLogin = player.lastLogin ? new Date(player.lastLogin) : null;
      if (lastLogin) {
        const hoursSince = (now.getTime() - lastLogin.getTime()) / 3_600_000;
        if (hoursSince < config.advanced.economy.loginClaimHours) return { already: true, nextClaimIn: Math.ceil(config.advanced.economy.loginClaimHours - hoursSince), currentStreak: player.loginStreak };
      }

      const hoursSince = lastLogin ? (now.getTime() - lastLogin.getTime()) / 3_600_000 : Infinity;
      const newStreak = hoursSince > config.advanced.economy.loginResetHours ? 1 : player.loginStreak + 1;
      const reward = rewardFor(rewards, newStreak);

      await tx.update(players).set({
        loginStreak: newStreak,
        lastLogin: now,
        gold: sql`${players.gold} + ${reward.gold}`,
        dust: sql`${players.dust} + ${reward.dust}`,
      }).where(eq(players.id, player.id));
      if (reward.gold) await recordEconomyTransaction(tx, { playerId: player.id, currency: "gold", amount: reward.gold, balanceAfter: player.gold + reward.gold, reason: "login_reward" });
      if (reward.dust) await recordEconomyTransaction(tx, { playerId: player.id, currency: "dust", amount: reward.dust, balanceAfter: player.dust + reward.dust, reason: "login_reward" });

      if (reward.pack) {
        await tx.insert(playerPacks).values({ playerId: player.id, packType: reward.pack, count: 1 })
          .onConflictDoUpdate({ target: [playerPacks.playerId, playerPacks.packType], set: { count: sql`${playerPacks.count} + 1` } });
      }

      return { already: false, streak: newStreak, reward, newGold: player.gold + reward.gold, newDust: player.dust + reward.dust };
    });

    if (!result) return Response.json({ ok: false, error: "Player not found" }, { status: 404 });
    if (result.already) return Response.json({ ok: false, error: "Already claimed today", nextClaimIn: result.nextClaimIn, currentStreak: result.currentStreak });
    return Response.json({ ok: true, ...result });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const requestedName = url.searchParams.get("name") || "";
    const identity = await requireStablePlayerIdentity(req);
    if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const rewards = await getRuntimeLoginRewards();
    if (!rewards.length) return Response.json({ ok: false, error: "Login rewards are not configured" }, { status: 503 });
    const config = await loadGameConfig();
    const [player] = await db.select().from(players).where(eq(players.id, identity.playerId)).limit(1);
    if (!player) return Response.json({ ok: false, error: "Player not found" }, { status: 404 });
    const now = new Date();
    const lastLogin = player.lastLogin ? new Date(player.lastLogin) : null;
    const canClaim = !lastLogin || (now.getTime() - lastLogin.getTime()) / 3_600_000 >= config.advanced.economy.loginClaimHours;
    return Response.json({ ok: true, canClaim, streak: player.loginStreak, nextReward: rewardFor(rewards, player.loginStreak + 1), allRewards: rewards });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
