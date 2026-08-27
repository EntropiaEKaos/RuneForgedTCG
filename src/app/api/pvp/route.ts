import { runtimeGate } from "@/lib/runtime-gates";
import { NextRequest } from "next/server";
import { randomInt } from "node:crypto";
import { db } from "@/db";
import { pvpRooms, players } from "@/db/schema";
import { cleanupExpiredRuntimeSessions, PVP_WAITING_TTL_MS } from "@/lib/session-cleanup";
import { and, eq, or, desc } from "drizzle-orm";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { resolveDeck, snapshotDeck } from "@/game/deck-service";
import { createGame } from "@/game/engine";
import { ensureConfigLoaded } from "@/game/settings";
import { validateFormatDeck } from "@/game/format-rules-server";

export const dynamic = "force-dynamic";

function publicRoomSummary(room: typeof pvpRooms.$inferSelect, viewerId?: number) {
  const viewerSide = viewerId == null ? null : room.hostPlayerId === viewerId ? "host" : room.guestPlayerId === viewerId ? "guest" : null;
  const participant = viewerSide !== null;
  return {
    id: room.id,
    code: room.code,
    hostName: room.hostName,
    hostDeck: participant ? room.hostDeck : null,
    guestName: room.guestName,
    guestDeck: participant ? room.guestDeck : null,
    state: room.state,
    mode: room.mode,
    viewerSide,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[randomInt(chars.length)];
  return code;
}

export async function GET(req: NextRequest) {
  await cleanupExpiredRuntimeSessions().catch(() => ({ pvpExpired: 0, pvpDeleted: 0, drafts: 0 }));
  try {
    const session = await requireStablePlayerIdentity(req);
    const playerName = session?.playerName;
    const publicRooms = await db.select().from(pvpRooms).where(eq(pvpRooms.state, "waiting")).orderBy(desc(pvpRooms.createdAt)).limit(20);
    let myRoom = null;
    if (session?.playerId != null) {
      const [room] = await db.select().from(pvpRooms).where(and(
        or(eq(pvpRooms.hostPlayerId, session.playerId), eq(pvpRooms.guestPlayerId, session.playerId)),
        or(eq(pvpRooms.state, "playing"), eq(pvpRooms.state, "waiting")),
      )).orderBy(desc(pvpRooms.updatedAt)).limit(1);
      if (room) myRoom = room;
    }
    return Response.json({ ok: true, playerName: session?.playerName ?? null, rooms: publicRooms.map((room) => publicRoomSummary(room)), myRoom: myRoom ? publicRoomSummary(myRoom, session?.playerId) : null });
  } catch (error) {
    console.error("[pvp] GET failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  await ensureConfigLoaded();
  await cleanupExpiredRuntimeSessions().catch(() => ({ pvpExpired: 0, pvpDeleted: 0, drafts: 0 }));
  try {
    const body = await req.json();
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Authenticated player session required" }, { status: 401 });
    const hostName = identity.playerName;
    const hostDeck = String(body.hostDeck || "");
    if (!hostName || !hostDeck) return Response.json({ ok: false, error: "Missing hostName or hostDeck" }, { status: 400 });
    let hostSnapshot;
    try {
      const hostResolved = await resolveDeck(db, identity.playerId, hostDeck);
      const formatCheck = await validateFormatDeck(hostResolved.cards, hostResolved.formatId || "vanilla");
      if (!formatCheck.ok) return Response.json({ ok: false, error: formatCheck.errors.join(" ") }, { status: 409 });
      hostSnapshot = snapshotDeck(hostResolved);
    } catch { return Response.json({ ok: false, error: "Invalid or unauthorized deck" }, { status: 400 }); }

    const result = await db.transaction(async (tx) => {
      // Every room lifecycle entry point locks the player row first. This makes
      // concurrent create/join requests for one player serialize across replicas.
      const [lockedPlayer] = await tx.select({ id: players.id, name: players.name }).from(players).where(eq(players.id, identity.playerId!)).limit(1).for("update");
      if (!lockedPlayer) return { error: "Player not found", status: 404 as const };
      const [activeMatch] = await tx.select({ id: pvpRooms.id }).from(pvpRooms).where(and(
        or(eq(pvpRooms.hostPlayerId, lockedPlayer.id), eq(pvpRooms.guestPlayerId, lockedPlayer.id)),
        eq(pvpRooms.state, "playing"),
      )).limit(1);
      if (activeMatch) return { error: "Player already has an active PvP match", status: 409 as const };
      // Re-creating a lobby replaces only the player's own waiting room. A
      // playing match is never deleted or masked by a new lobby.
      await tx.delete(pvpRooms).where(and(eq(pvpRooms.hostPlayerId, lockedPlayer.id), eq(pvpRooms.state, "waiting")));
      for (let attempt = 0; attempt < 20; attempt++) {
        const code = generateRoomCode();
        const [existing] = await tx.select({ id: pvpRooms.id }).from(pvpRooms).where(eq(pvpRooms.code, code)).limit(1);
        if (existing) continue;
        const seed = randomInt(1, 0x7fffffff);
        const [room] = await tx.insert(pvpRooms).values({ code, hostName: lockedPlayer.name, hostPlayerId: lockedPlayer.id, hostDeck, hostDeckSnapshot: hostSnapshot, state: "waiting", mode: "casual", seed, playerFirst: true, expiresAt: new Date(Date.now() + PVP_WAITING_TTL_MS) }).returning();
        return { room };
      }
      return { error: "Could not allocate a unique room code", status: 503 as const };
    });
    if ("error" in result) return Response.json({ ok: false, error: result.error }, { status: result.status });
    return Response.json({ ok: true, room: publicRoomSummary(result.room, identity.playerId) });
  } catch (error) {
    console.error("[pvp] POST failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
