import { randomInt } from "node:crypto";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { commanderRooms, commanderSeats, players } from "@/db/schema";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { validateOwnedCommanderLoadout } from "@/lib/commander-service";
import { COMMANDER_ALPHA_RULES } from "@/lib/commander-rules";
import { runtimeGate } from "@/lib/runtime-gates";

export const dynamic = "force-dynamic";
const WAITING_TTL_MS = 2 * 60 * 60 * 1000;

function code() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = "";
  for (let i = 0; i < 6; i++) value += chars[randomInt(chars.length)];
  return value;
}

async function summaries(viewerId?: number) {
  const rooms = await db.select().from(commanderRooms)
    .where(eq(commanderRooms.state, "waiting"))
    .orderBy(desc(commanderRooms.createdAt))
    .limit(20);
  const ids = rooms.map((room) => room.id);
  const seats = ids.length ? await db.select().from(commanderSeats).where(inArray(commanderSeats.roomId, ids)) : [];
  return rooms.map((room) => ({
    id: room.id,
    code: room.code,
    state: room.state,
    hostPlayerId: room.hostPlayerId,
    seatCount: seats.filter((seat) => seat.roomId === room.id).length,
    viewerJoined: viewerId != null && seats.some((seat) => seat.roomId === room.id && seat.playerId === viewerId),
    rules: room.rulesSnapshot,
    createdAt: room.createdAt,
  }));
}

export async function GET(req: NextRequest) {
  const identity = await requireStablePlayerIdentity(req);
  return Response.json({ ok: true, rooms: await summaries(identity?.playerId), rules: COMMANDER_ALPHA_RULES });
}

export async function POST(req: NextRequest) {
  const blocked = await runtimeGate("general");
  if (blocked) return blocked;
  const identity = await requireStablePlayerIdentity(req);
  if (!identity?.playerId) return Response.json({ ok:false, error:"Authenticated player session required" }, { status:401 });

  const body = await req.json().catch(() => ({}));
  const deckCards = Array.isArray(body.deckCards) ? body.deckCards.map(String) : [];
  const generalDefId = String(body.generalDefId || "").trim();
  const validation = await validateOwnedCommanderLoadout(db, identity.playerId, deckCards, generalDefId);
  if (!validation.ok) return Response.json({ ok:false, error:validation.errors.join(" ") }, { status:409 });

  const result = await db.transaction(async (tx) => {
    const [player] = await tx.select({ id:players.id, name:players.name }).from(players)
      .where(eq(players.id, identity.playerId!)).limit(1).for("update");
    if (!player) return { error:"Player not found", status:404 as const };

    const activeSeats = await tx.select({ roomId:commanderSeats.roomId }).from(commanderSeats)
      .innerJoin(commanderRooms, eq(commanderRooms.id, commanderSeats.roomId))
      .where(and(eq(commanderSeats.playerId, player.id), or(eq(commanderRooms.state,"waiting"), eq(commanderRooms.state,"playing"))))
      .limit(1);
    if (activeSeats.length) return { error:"Player already has an active Commander room", status:409 as const };

    for (let attempt=0; attempt<20; attempt++) {
      const roomCode=code();
      const [exists]=await tx.select({id:commanderRooms.id}).from(commanderRooms).where(eq(commanderRooms.code,roomCode)).limit(1);
      if (exists) continue;
      const [room]=await tx.insert(commanderRooms).values({
        code:roomCode,
        hostPlayerId:player.id,
        state:"waiting",
        activeSeat:0,
        round:1,
        version:0,
        rulesSnapshot:COMMANDER_ALPHA_RULES,
        expiresAt:new Date(Date.now()+WAITING_TTL_MS),
      }).returning();
      await tx.insert(commanderSeats).values({
        roomId:room.id,
        seat:0,
        playerId:player.id,
        playerName:player.name,
        deckCards,
        generalDefId,
        ready:false,
      });
      return { room };
    }
    return { error:"Could not allocate a Commander room code", status:503 as const };
  });

  if ("error" in result) return Response.json({ ok:false, error:result.error }, { status:result.status });
  return Response.json({ ok:true, code:result.room.code, rules:COMMANDER_ALPHA_RULES });
}
