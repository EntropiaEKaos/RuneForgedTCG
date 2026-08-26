import { runtimeGate } from "@/lib/runtime-gates";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { players, friendships } from "@/db/schema";
import { eq, or, and, inArray } from "drizzle-orm";
import { requireStablePlayerIdentity } from "@/lib/player-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const identity = await requireStablePlayerIdentity(req);
    if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const [player] = await db.select().from(players).where(eq(players.id, identity.playerId!)).limit(1);
    if (!player) return Response.json({ ok: false, error: "Player not found" }, { status: 404 });

    // Get all friendships involving this player
    const rows = await db.select().from(friendships).where(
      or(eq(friendships.playerId, player.id), eq(friendships.friendId, player.id))
    );

    // Get all friend player details
    const friendIds = new Set<number>();
    for (const r of rows) {
      friendIds.add(r.playerId === player.id ? r.friendId : r.playerId);
    }
    const friendPlayers = friendIds.size > 0
      ? await db.select().from(players).where(inArray(players.id, [...friendIds]))
      : [];
    const friendMap = new Map(friendPlayers.filter((p) => friendIds.has(p.id)).map((p) => [p.id, p]));

    const accepted = rows.filter((r) => r.status === "accepted").map((r) => {
      const otherId = r.playerId === player.id ? r.friendId : r.playerId;
      const f = friendMap.get(otherId);
      const isOnline = f?.lastLogin && (new Date().getTime() - new Date(f.lastLogin).getTime()) < 5 * 60 * 1000;
      return f ? {
        id: f.id,
        name: f.name,
        avatar: f.avatar,
        level: f.level,
        mmr: f.mmr,
        online: Boolean(isOnline),
      } : null;
    }).filter(Boolean);

    const pending = rows.filter((r) => r.status === "pending" && r.friendId === player.id).map((r) => {
      const f = friendMap.get(r.playerId);
      return f ? {
        id: f.id,
        name: f.name,
        avatar: f.avatar,
        level: f.level,
        friendshipId: r.id,
      } : null;
    }).filter(Boolean);

    const sent = rows.filter((r) => r.status === "pending" && r.playerId === player.id).map((r) => {
      const f = friendMap.get(r.friendId);
      return f ? { id: f.id, name: f.name, avatar: f.avatar } : null;
    }).filter(Boolean);

    return Response.json({ ok: true, friends: accepted, pending, sent });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  try {
    const body = await req.json();
    const identity = await requireStablePlayerIdentity(req);
    if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const targetName = String(body.targetName || "").trim().slice(0, 40);
    const action = body.action as "add" | "accept" | "reject" | "remove";
    const friendshipId = body.friendshipId;

    const [player] = await db.select().from(players).where(eq(players.id, identity.playerId!)).limit(1);
    if (!player) return Response.json({ ok: false, error: "Player not found" }, { status: 404 });

    if (action === "add") {
      const [target] = await db.select().from(players).where(eq(players.name, targetName)).limit(1);
      if (!target) return Response.json({ ok: false, error: "Player not found" }, { status: 404 });
      if (target.id === player.id) return Response.json({ ok: false, error: "Can't add yourself" }, { status: 400 });
      const result = await db.transaction(async (tx) => {
        const ids = [player.id, target.id].sort((a, b) => a - b);
        await tx.select({ id: players.id }).from(players).where(inArray(players.id, ids)).for("update");
        const existing = await tx.select().from(friendships).where(
          or(
            and(eq(friendships.playerId, player.id), eq(friendships.friendId, target.id)),
            and(eq(friendships.playerId, target.id), eq(friendships.friendId, player.id)),
          )
        );
        if (existing.length > 0) return { error: "Already friends or pending" };
        try {
          await tx.insert(friendships).values({ playerId: player.id, friendId: target.id, status: "pending" });
        } catch {
          return { error: "Already friends or pending" };
        }
        return { ok: true };
      });
      if ("error" in result) return Response.json({ ok: false, error: result.error }, { status: 400 });
      return Response.json({ ok: true });
    }

    if (action === "accept") {
      const updated = await db.update(friendships).set({ status: "accepted" }).where(and(eq(friendships.id, friendshipId), eq(friendships.friendId, player.id), eq(friendships.status, "pending"))).returning({ id: friendships.id });
      if (!updated.length) return Response.json({ ok: false, error: "Friend request not found" }, { status: 404 });
      return Response.json({ ok: true });
    }

    if (action === "reject" || action === "remove") {
      const deleted = await db.delete(friendships).where(and(eq(friendships.id, friendshipId), or(eq(friendships.playerId, player.id), eq(friendships.friendId, player.id)))).returning({ id: friendships.id });
      if (!deleted.length) return Response.json({ ok: false, error: "Friendship not found" }, { status: 404 });
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
