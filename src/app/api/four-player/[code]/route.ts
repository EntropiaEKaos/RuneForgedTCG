import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { fourPlayerRooms, fourPlayerSeats, players } from "@/db/schema";
import { fourPlayerFeatureGate } from "@/lib/four-player-feature";
import { projectFourPlayerRoom } from "@/lib/four-player-lobby";
import { loadOwnedFourPlayerDeck, snapshotFourPlayerDeck } from "@/lib/four-player-service";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { runtimeGate } from "@/lib/runtime-gates";

export const dynamic = "force-dynamic";

async function roomAndSeats(code: string) {
  const [room] = await db.select().from(fourPlayerRooms).where(eq(fourPlayerRooms.code, code)).limit(1);
  if (!room) return null;
  const seats = await db.select().from(fourPlayerSeats).where(eq(fourPlayerSeats.roomId, room.id));
  return { room, seats };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const featureBlocked = fourPlayerFeatureGate();
  if (featureBlocked) return featureBlocked;
  try {
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const code = String((await ctx.params).code || "").toUpperCase();
    const snapshot = await roomAndSeats(code);
    if (!snapshot) return Response.json({ ok: false, error: "Room not found" }, { status: 404 });
    return Response.json({ ok: true, room: projectFourPlayerRoom(snapshot.room, snapshot.seats, identity.playerId) });
  } catch (error) {
    console.error("[four-player/:code] GET failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  const featureBlocked = fourPlayerFeatureGate();
  if (featureBlocked) return featureBlocked;

  try {
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const code = String((await ctx.params).code || "").toUpperCase();
    const body = await req.json() as Record<string, unknown>;
    const action = String(body.action || "");

    if (action === "join") {
      const deckId = Number(body.deckId);
      if (!Number.isInteger(deckId) || deckId < 1) return Response.json({ ok: false, error: "Valid 4P deckId required" }, { status: 400 });
      const deck = await loadOwnedFourPlayerDeck(db, identity.playerId, deckId);

      const result = await db.transaction(async (tx) => {
        const [lockedPlayer] = await tx.select({ id: players.id }).from(players).where(eq(players.id, identity.playerId!)).limit(1).for("update");
        if (!lockedPlayer) return { error: "Player not found", status: 404 as const };
        const [room] = await tx.select().from(fourPlayerRooms).where(eq(fourPlayerRooms.code, code)).limit(1).for("update");
        if (!room) return { error: "Room not found", status: 404 as const };
        if (!["waiting", "ready"].includes(room.state)) return { error: "Room is not joinable", status: 409 as const };
        const currentSeats = await tx.select().from(fourPlayerSeats).where(eq(fourPlayerSeats.roomId, room.id)).orderBy(fourPlayerSeats.seat);
        if (currentSeats.some((seat: typeof fourPlayerSeats.$inferSelect) => seat.playerId === identity.playerId)) {
          return { room, seats: currentSeats, duplicate: true as const };
        }
        const activeElsewhere = await tx.select({ roomId: fourPlayerSeats.roomId }).from(fourPlayerSeats)
          .innerJoin(fourPlayerRooms, eq(fourPlayerRooms.id, fourPlayerSeats.roomId))
          .where(and(
            eq(fourPlayerSeats.playerId, identity.playerId!),
            inArray(fourPlayerRooms.state, ["waiting", "ready", "playing"]),
          )).limit(1);
        if (activeElsewhere.length) return { error: "Player already has an active 4P room", status: 409 as const };
        const used = new Set(currentSeats.map((seat: typeof fourPlayerSeats.$inferSelect) => seat.seat));
        const seatNumber = [0, 1, 2, 3].find((seat) => !used.has(seat));
        if (seatNumber == null) return { error: "Room is full", status: 409 as const };
        const rules = room.rulesSnapshot as { nexusStart?: number };
        const [seat] = await tx.insert(fourPlayerSeats).values({
          roomId: room.id,
          seat: seatNumber,
          playerId: identity.playerId!,
          playerName: identity.playerName,
          deckId: deck.id,
          deckSnapshot: snapshotFourPlayerDeck(deck),
          generalDefId: deck.generalDefId,
          nexusHealth: Math.max(1, Math.trunc(Number(rules?.nexusStart) || 1)),
        }).returning();
        const seats = [...currentSeats, seat];
        if (room.state !== "waiting") await tx.update(fourPlayerRooms).set({ state: "waiting", version: room.version + 1, updatedAt: new Date() }).where(eq(fourPlayerRooms.id, room.id));
        return { room: { ...room, state: "waiting", version: room.state === "waiting" ? room.version : room.version + 1 }, seats, duplicate: false as const };
      });

      if ("error" in result) return Response.json({ ok: false, error: result.error }, { status: result.status });
      return Response.json({ ok: true, duplicate: result.duplicate, room: projectFourPlayerRoom(result.room, result.seats, identity.playerId) });
    }

    if (action === "ready") {
      const ready = body.ready !== false;
      const result = await db.transaction(async (tx) => {
        const [room] = await tx.select().from(fourPlayerRooms).where(eq(fourPlayerRooms.code, code)).limit(1).for("update");
        if (!room) return { error: "Room not found", status: 404 as const };
        if (!["waiting", "ready"].includes(room.state)) return { error: "Room is not in lobby state", status: 409 as const };
        const [seat] = await tx.select().from(fourPlayerSeats).where(and(
          eq(fourPlayerSeats.roomId, room.id),
          eq(fourPlayerSeats.playerId, identity.playerId!),
        )).limit(1).for("update");
        if (!seat) return { error: "Join the room before marking ready", status: 403 as const };
        await tx.update(fourPlayerSeats).set({ ready: ready ? 1 : 0 }).where(eq(fourPlayerSeats.id, seat.id));
        const seats = await tx.select().from(fourPlayerSeats).where(eq(fourPlayerSeats.roomId, room.id)).orderBy(fourPlayerSeats.seat);
        const normalized = seats.map((row: typeof fourPlayerSeats.$inferSelect) => row.id === seat.id ? { ...row, ready: ready ? 1 : 0 } : row);
        const nextState = normalized.length === 4 && normalized.every((row) => row.ready === 1) ? "ready" : "waiting";
        const [updated] = await tx.update(fourPlayerRooms).set({ state: nextState, version: room.version + 1, updatedAt: new Date() }).where(eq(fourPlayerRooms.id, room.id)).returning();
        return { room: updated, seats: normalized };
      });
      if ("error" in result) return Response.json({ ok: false, error: result.error }, { status: result.status });
      return Response.json({ ok: true, room: projectFourPlayerRoom(result.room, result.seats, identity.playerId) });
    }

    if (action === "leave") {
      const result = await db.transaction(async (tx) => {
        const [room] = await tx.select().from(fourPlayerRooms).where(eq(fourPlayerRooms.code, code)).limit(1).for("update");
        if (!room) return { error: "Room not found", status: 404 as const };
        if (room.state === "playing") return { error: "Playing 4P rooms require authoritative elimination/forfeit", status: 409 as const };
        const [seat] = await tx.select().from(fourPlayerSeats).where(and(
          eq(fourPlayerSeats.roomId, room.id),
          eq(fourPlayerSeats.playerId, identity.playerId!),
        )).limit(1);
        if (!seat) return { error: "Not a participant", status: 403 as const };
        if (room.hostPlayerId === identity.playerId) {
          const [updated] = await tx.update(fourPlayerRooms).set({ state: "cancelled", version: room.version + 1, updatedAt: new Date() }).where(eq(fourPlayerRooms.id, room.id)).returning();
          return { cancelled: true as const, room: updated, seats: await tx.select().from(fourPlayerSeats).where(eq(fourPlayerSeats.roomId, room.id)) };
        }
        await tx.delete(fourPlayerSeats).where(eq(fourPlayerSeats.id, seat.id));
        const [updated] = await tx.update(fourPlayerRooms).set({ state: "waiting", version: room.version + 1, updatedAt: new Date() }).where(eq(fourPlayerRooms.id, room.id)).returning();
        const seats = await tx.select().from(fourPlayerSeats).where(eq(fourPlayerSeats.roomId, room.id));
        return { cancelled: false as const, room: updated, seats };
      });
      if ("error" in result) return Response.json({ ok: false, error: result.error }, { status: result.status });
      return Response.json({ ok: true, cancelled: result.cancelled, room: projectFourPlayerRoom(result.room, result.seats, identity.playerId) });
    }

    return Response.json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[four-player/:code] POST failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
