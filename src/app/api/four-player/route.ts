import { randomInt } from "node:crypto";
import { NextRequest } from "next/server";
import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { fourPlayerRooms, fourPlayerSeats, players } from "@/db/schema";
import { loadGameConfig } from "@/game/settings";
import { fourPlayerFeatureGate } from "@/lib/four-player-feature";
import { FOUR_PLAYER_ROOM_TTL_MS, fourPlayerRulesSnapshot, projectFourPlayerRoom } from "@/lib/four-player-lobby";
import { loadOwnedFourPlayerDeck, snapshotFourPlayerDeck } from "@/lib/four-player-service";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { runtimeGate } from "@/lib/runtime-gates";

export const dynamic = "force-dynamic";

function roomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[randomInt(alphabet.length)];
  return code;
}

async function cancelExpiredRooms() {
  await db.update(fourPlayerRooms).set({ state: "cancelled", updatedAt: new Date() }).where(and(
    inArray(fourPlayerRooms.state, ["waiting", "ready"]),
    lt(fourPlayerRooms.expiresAt, new Date()),
  ));
}

export async function GET(req: NextRequest) {
  const featureBlocked = fourPlayerFeatureGate();
  if (featureBlocked) return featureBlocked;
  try {
    await cancelExpiredRooms();
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });

    const rooms = await db.select().from(fourPlayerRooms).where(or(
      eq(fourPlayerRooms.state, "waiting"),
      eq(fourPlayerRooms.state, "ready"),
    )).orderBy(desc(fourPlayerRooms.createdAt)).limit(20);
    const roomIds = rooms.map((room) => room.id);
    const seats = roomIds.length ? await db.select().from(fourPlayerSeats).where(inArray(fourPlayerSeats.roomId, roomIds)) : [];
    const byRoom = new Map<number, typeof seats>();
    for (const seat of seats) {
      const list = byRoom.get(seat.roomId) ?? [];
      list.push(seat);
      byRoom.set(seat.roomId, list);
    }

    const [mySeat] = await db.select().from(fourPlayerSeats).where(eq(fourPlayerSeats.playerId, identity.playerId)).orderBy(desc(fourPlayerSeats.joinedAt)).limit(1);
    let myRoom = null;
    if (mySeat) {
      const [room] = await db.select().from(fourPlayerRooms).where(and(
        eq(fourPlayerRooms.id, mySeat.roomId),
        inArray(fourPlayerRooms.state, ["waiting", "ready", "playing"]),
      )).limit(1);
      if (room) {
        const allSeats = await db.select().from(fourPlayerSeats).where(eq(fourPlayerSeats.roomId, room.id));
        myRoom = projectFourPlayerRoom(room, allSeats, identity.playerId);
      }
    }

    return Response.json({
      ok: true,
      rooms: rooms.map((room) => projectFourPlayerRoom(room, byRoom.get(room.id) ?? [], identity.playerId)),
      myRoom,
    });
  } catch (error) {
    console.error("[four-player] GET failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  const featureBlocked = fourPlayerFeatureGate();
  if (featureBlocked) return featureBlocked;
  try {
    await cancelExpiredRooms();
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const body = await req.json() as Record<string, unknown>;
    const deckId = Number(body.deckId);
    if (!Number.isInteger(deckId) || deckId < 1) return Response.json({ ok: false, error: "Valid 4P deckId required" }, { status: 400 });
    const deck = await loadOwnedFourPlayerDeck(db, identity.playerId, deckId);
    const config = await loadGameConfig();
    const rules = fourPlayerRulesSnapshot(config.nexusStart);

    const created = await db.transaction(async (tx) => {
      const [lockedPlayer] = await tx.select({ id: players.id }).from(players).where(eq(players.id, identity.playerId!)).limit(1).for("update");
      if (!lockedPlayer) return null;
      const activeSeats = await tx.select({ roomId: fourPlayerSeats.roomId }).from(fourPlayerSeats)
        .innerJoin(fourPlayerRooms, eq(fourPlayerRooms.id, fourPlayerSeats.roomId))
        .where(and(
          eq(fourPlayerSeats.playerId, identity.playerId!),
          inArray(fourPlayerRooms.state, ["waiting", "ready", "playing"]),
        )).limit(1);
      if (activeSeats.length) throw new Error("FOUR_PLAYER_ALREADY_ACTIVE");

      for (let attempt = 0; attempt < 20; attempt++) {
        const code = roomCode();
        const [collision] = await tx.select({ id: fourPlayerRooms.id }).from(fourPlayerRooms).where(eq(fourPlayerRooms.code, code)).limit(1);
        if (collision) continue;
        const [room] = await tx.insert(fourPlayerRooms).values({
          code,
          hostPlayerId: identity.playerId!,
          state: "waiting",
          activeSeat: 0,
          prioritySeat: 0,
          turnNumber: 1,
          rulesSnapshot: rules,
          publicState: { phase: "lobby", stackDepth: 0, combat: null },
          expiresAt: new Date(Date.now() + FOUR_PLAYER_ROOM_TTL_MS),
        }).returning();
        const [seat] = await tx.insert(fourPlayerSeats).values({
          roomId: room.id,
          seat: 0,
          playerId: identity.playerId!,
          playerName: identity.playerName,
          deckId: deck.id,
          deckSnapshot: snapshotFourPlayerDeck(deck),
          generalDefId: deck.generalDefId,
          nexusHealth: rules.nexusStart,
        }).returning();
        return { room, seats: [seat] };
      }
      throw new Error("FOUR_PLAYER_CODE_EXHAUSTED");
    });

    if (!created) return Response.json({ ok: false, error: "Player not found" }, { status: 404 });
    return Response.json({ ok: true, room: projectFourPlayerRoom(created.room, created.seats, identity.playerId) }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "FOUR_PLAYER_ALREADY_ACTIVE") return Response.json({ ok: false, error: "Player already has an active 4P room" }, { status: 409 });
    console.error("[four-player] POST failed", error);
    return Response.json({ ok: false, error: "Could not create 4P room" }, { status: 500 });
  }
}
