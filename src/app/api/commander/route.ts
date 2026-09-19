import { randomInt } from "node:crypto";
import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { commanderRoomEvents, commanderRoomPlayers, commanderRooms, players } from "@/db/schema";
import { allCards } from "@/game/cards";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import { COMMANDER_ALPHA_RULES, commanderRoundAfterPass, nextCommanderSeat, validateCommanderLoadout } from "@/lib/commander-alpha";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { consumeRequestRateLimit } from "@/lib/rate-limit";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/request-security";
import { runtimeGate } from "@/lib/runtime-gates";

export const dynamic = "force-dynamic";
const MAX_BODY = 512 * 1024;
const WAITING_TTL = 2 * 60 * 60 * 1000;
const PLAYING_TTL = 6 * 60 * 60 * 1000;

function code() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = "";
  for (let i=0;i<6;i++) value += chars[randomInt(chars.length)];
  return value;
}
function cardName(defId:string) { return allCards().find((card) => card.defId === defId)?.name ?? defId; }
async function roomPayload(room: typeof commanderRooms.$inferSelect, viewerPlayerId:number) {
  const seats = await db.select().from(commanderRoomPlayers).where(eq(commanderRoomPlayers.roomId, room.id)).orderBy(commanderRoomPlayers.seat);
  const events = await db.select().from(commanderRoomEvents).where(eq(commanderRoomEvents.roomId, room.id)).orderBy(commanderRoomEvents.createdAt);
  const viewer = seats.find((seat) => seat.playerId === viewerPlayerId);
  return {
    id:room.id, code:room.code, state:room.state, currentSeat:room.currentSeat, round:room.round, version:room.version,
    winnerPlayerId:room.winnerPlayerId, rules:room.rulesSnapshot, expiresAt:room.expiresAt,
    viewerSeat:viewer?.seat ?? null, viewerIsHost:room.hostPlayerId === viewerPlayerId,
    players:seats.map((seat) => ({
      playerId:seat.playerId, playerName:seat.playerName, seat:seat.seat, generalDefId:seat.generalDefId,
      generalName:cardName(seat.generalDefId), nexus:seat.nexus, eliminated:seat.eliminated, deckSize:Array.isArray(seat.deckSnapshot) ? seat.deckSnapshot.length : 0,
      isCurrent:room.state === "playing" && !seat.eliminated && seat.seat === room.currentSeat,
    })),
    events:events.slice(-40).map((event) => ({ id:event.id, eventType:event.eventType, actorPlayerId:event.actorPlayerId, roomVersion:event.roomVersion, payload:event.payload, createdAt:event.createdAt })),
  };
}
async function loadOwnedRoom(tx:any, roomCode:string, playerId:number) {
  const [room] = await tx.select().from(commanderRooms).where(eq(commanderRooms.code, roomCode)).limit(1).for("update");
  if (!room) return { error:"Commander room not found", status:404 as const };
  const [seat] = await tx.select().from(commanderRoomPlayers).where(and(eq(commanderRoomPlayers.roomId, room.id), eq(commanderRoomPlayers.playerId, playerId))).limit(1).for("update");
  if (!seat) return { error:"You are not seated in this Commander room", status:403 as const };
  return { room, seat };
}

export async function GET(req:NextRequest) {
  await ensureCustomCardsLoaded();
  const identity = await requireStablePlayerIdentity(req);
  if (!identity) return Response.json({ok:false,error:"Player session required"},{status:401});
  const roomCode = String(req.nextUrl.searchParams.get("code") || "").trim().toUpperCase();
  if (!roomCode) {
    const memberships = await db.select().from(commanderRoomPlayers).where(eq(commanderRoomPlayers.playerId, identity.playerId)).orderBy(commanderRoomPlayers.joinedAt);
    const roomIds = memberships.map((entry) => entry.roomId);
    const rooms = roomIds.length ? await db.select().from(commanderRooms).where(inArray(commanderRooms.id, roomIds)) : [];
    const active = rooms.filter((room) => room.state === "waiting" || room.state === "playing").sort((a,b) => new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime())[0];
    return Response.json({ok:true,room:active ? await roomPayload(active, identity.playerId) : null});
  }
  const [room] = await db.select().from(commanderRooms).where(eq(commanderRooms.code, roomCode)).limit(1);
  if (!room) return Response.json({ok:false,error:"Commander room not found"},{status:404});
  const [seat] = await db.select({id:commanderRoomPlayers.id}).from(commanderRoomPlayers).where(and(eq(commanderRoomPlayers.roomId,room.id),eq(commanderRoomPlayers.playerId,identity.playerId))).limit(1);
  if (!seat) return Response.json({ok:false,error:"You are not seated in this Commander room"},{status:403});
  return Response.json({ok:true,room:await roomPayload(room, identity.playerId)});
}

export async function POST(req:NextRequest) {
  const blocked = await runtimeGate("general");
  if (blocked) return blocked;
  const rate = await consumeRequestRateLimit(req,"commander-write",30,60_000);
  if (!rate.allowed) return Response.json({ok:false,error:"Too many Commander actions"},{status:429});
  try {
    await ensureCustomCardsLoaded();
    const identity = await requireStablePlayerIdentity(req);
    if (!identity) return Response.json({ok:false,error:"Player session required"},{status:401});
    const body = await readBoundedJson<Record<string,unknown>>(req,MAX_BODY);
    const action = String(body.action || "");
    if (!["create","join","start","pass","forfeit","cancel"].includes(action)) return Response.json({ok:false,error:"Invalid Commander action"},{status:400});
    const roomCode = String(body.code || "").trim().toUpperCase();

    if (action === "create" || action === "join") {
      const loadout = validateCommanderLoadout(body.deckCards, body.generalDefId, allCards());
      if (!loadout.ok) return Response.json({ok:false,error:loadout.error},{status:400});
      const result = await db.transaction(async (tx) => {
        const [lockedPlayer] = await tx.select({id:players.id,name:players.name}).from(players).where(eq(players.id,identity.playerId)).limit(1).for("update");
        if (!lockedPlayer) return {error:"Player not found",status:404 as const};
        if (action === "create") {
          for (let attempt=0;attempt<20;attempt++) {
            const roomCodeCandidate=code();
            const [exists]=await tx.select({id:commanderRooms.id}).from(commanderRooms).where(eq(commanderRooms.code,roomCodeCandidate)).limit(1);
            if (exists) continue;
            const [room]=await tx.insert(commanderRooms).values({
              code:roomCodeCandidate,hostPlayerId:lockedPlayer.id,state:"waiting",rulesSnapshot:COMMANDER_ALPHA_RULES,
              currentSeat:1,round:1,version:0,expiresAt:new Date(Date.now()+WAITING_TTL),
            }).returning();
            await tx.insert(commanderRoomPlayers).values({roomId:room.id,playerId:lockedPlayer.id,playerName:lockedPlayer.name,seat:1,deckSnapshot:loadout.deck,generalDefId:loadout.general.defId,nexus:COMMANDER_ALPHA_RULES.startingNexus});
            await tx.insert(commanderRoomEvents).values({roomId:room.id,actorPlayerId:lockedPlayer.id,eventType:"created",roomVersion:0,payload:{seat:1,generalDefId:loadout.general.defId,regions:loadout.regions}});
            return {room};
          }
          return {error:"Could not allocate Commander room code",status:503 as const};
        }
        if (!roomCode) return {error:"Commander room code required",status:400 as const};
        const [room]=await tx.select().from(commanderRooms).where(eq(commanderRooms.code,roomCode)).limit(1).for("update");
        if (!room) return {error:"Commander room not found",status:404 as const};
        if (room.state !== "waiting" || room.expiresAt <= new Date()) return {error:"Commander room is no longer joinable",status:409 as const};
        const seats=await tx.select().from(commanderRoomPlayers).where(eq(commanderRoomPlayers.roomId,room.id)).orderBy(commanderRoomPlayers.seat).for("update");
        if (seats.some((seat:any)=>seat.playerId===lockedPlayer.id)) return {room};
        if (seats.length >= COMMANDER_ALPHA_RULES.players) return {error:"Commander room is full",status:409 as const};
        const used=new Set(seats.map((seat:any)=>seat.seat)); let seat=1; while(used.has(seat)&&seat<=4) seat++;
        const nextVersion=room.version+1;
        await tx.insert(commanderRoomPlayers).values({roomId:room.id,playerId:lockedPlayer.id,playerName:lockedPlayer.name,seat,deckSnapshot:loadout.deck,generalDefId:loadout.general.defId,nexus:COMMANDER_ALPHA_RULES.startingNexus});
        const [updated]=await tx.update(commanderRooms).set({version:nextVersion,updatedAt:new Date(),expiresAt:new Date(Date.now()+WAITING_TTL)}).where(eq(commanderRooms.id,room.id)).returning();
        await tx.insert(commanderRoomEvents).values({roomId:room.id,actorPlayerId:lockedPlayer.id,eventType:"joined",roomVersion:nextVersion,payload:{seat,generalDefId:loadout.general.defId,regions:loadout.regions}});
        return {room:updated};
      });
      if ("error" in result) return Response.json({ok:false,error:result.error},{status:result.status});
      return Response.json({ok:true,room:await roomPayload(result.room,identity.playerId)});
    }

    if (!roomCode) return Response.json({ok:false,error:"Commander room code required"},{status:400});
    const result = await db.transaction(async (tx) => {
      const owned=await loadOwnedRoom(tx,roomCode,identity.playerId);
      if ("error" in owned) return owned;
      const {room,seat}=owned;
      const seats=await tx.select().from(commanderRoomPlayers).where(eq(commanderRoomPlayers.roomId,room.id)).orderBy(commanderRoomPlayers.seat).for("update");

      if (action === "start") {
        if (room.hostPlayerId !== identity.playerId) return {error:"Only the host can start Commander",status:403 as const};
        if (room.state !== "waiting") return {error:"Commander room is not waiting",status:409 as const};
        if (seats.length !== COMMANDER_ALPHA_RULES.players) return {error:"Commander requires exactly four human players",status:409 as const};
        const version=room.version+1;
        const [updated]=await tx.update(commanderRooms).set({state:"playing",currentSeat:1,round:1,version,updatedAt:new Date(),expiresAt:new Date(Date.now()+PLAYING_TTL)}).where(eq(commanderRooms.id,room.id)).returning();
        await tx.insert(commanderRoomEvents).values({roomId:room.id,actorPlayerId:identity.playerId,eventType:"started",roomVersion:version,payload:{seatOrder:seats.map((entry:any)=>entry.seat)}});
        return {room:updated};
      }

      if (action === "cancel") {
        if (room.hostPlayerId !== identity.playerId) return {error:"Only the host can cancel a waiting Commander room",status:403 as const};
        if (room.state !== "waiting") return {error:"Only waiting Commander rooms can be cancelled",status:409 as const};
        const version=room.version+1;
        const [updated]=await tx.update(commanderRooms).set({state:"cancelled",version,updatedAt:new Date()}).where(eq(commanderRooms.id,room.id)).returning();
        await tx.insert(commanderRoomEvents).values({roomId:room.id,actorPlayerId:identity.playerId,eventType:"cancelled",roomVersion:version});
        return {room:updated};
      }

      if (room.state !== "playing") return {error:"Commander match is not playing",status:409 as const};
      if (action === "pass") {
        if (seat.eliminated) return {error:"Eliminated players cannot act",status:409 as const};
        if (room.currentSeat !== seat.seat) return {error:"It is not your Commander turn",status:409 as const};
        const activeSeats=seats.filter((entry:any)=>!entry.eliminated).map((entry:any)=>entry.seat);
        const next=nextCommanderSeat(room.currentSeat,activeSeats);
        if (next == null) return {error:"No active Commander seat remains",status:409 as const};
        const version=room.version+1;
        const round=room.round+commanderRoundAfterPass(room.currentSeat,next);
        const [updated]=await tx.update(commanderRooms).set({currentSeat:next,round,version,updatedAt:new Date(),expiresAt:new Date(Date.now()+PLAYING_TTL)}).where(eq(commanderRooms.id,room.id)).returning();
        await tx.insert(commanderRoomEvents).values({roomId:room.id,actorPlayerId:identity.playerId,eventType:"turn_passed",roomVersion:version,payload:{fromSeat:seat.seat,toSeat:next,round}});
        return {room:updated};
      }

      if (seat.eliminated) return {error:"Player is already eliminated",status:409 as const};
      await tx.update(commanderRoomPlayers).set({eliminated:true,nexus:0}).where(eq(commanderRoomPlayers.id,seat.id));
      const remaining=seats.filter((entry:any)=>entry.playerId!==identity.playerId && !entry.eliminated);
      const version=room.version+1;
      if (remaining.length === 1) {
        const winner=remaining[0];
        const [updated]=await tx.update(commanderRooms).set({state:"finished",winnerPlayerId:winner.playerId,version,updatedAt:new Date()}).where(eq(commanderRooms.id,room.id)).returning();
        await tx.insert(commanderRoomEvents).values([
          {roomId:room.id,actorPlayerId:identity.playerId,eventType:"forfeited",roomVersion:version,payload:{seat:seat.seat}},
          {roomId:room.id,actorPlayerId:winner.playerId,eventType:"finished",roomVersion:version,payload:{winnerSeat:winner.seat}},
        ]);
        return {room:updated};
      }
      const activeSeats=remaining.map((entry:any)=>entry.seat);
      const next = room.currentSeat === seat.seat ? nextCommanderSeat(room.currentSeat,activeSeats) ?? room.currentSeat : room.currentSeat;
      const [updated]=await tx.update(commanderRooms).set({currentSeat:next,version,updatedAt:new Date(),expiresAt:new Date(Date.now()+PLAYING_TTL)}).where(eq(commanderRooms.id,room.id)).returning();
      await tx.insert(commanderRoomEvents).values({roomId:room.id,actorPlayerId:identity.playerId,eventType:"forfeited",roomVersion:version,payload:{seat:seat.seat,nextSeat:next}});
      return {room:updated};
    });
    if ("error" in result) return Response.json({ok:false,error:result.error},{status:result.status});
    return Response.json({ok:true,room:await roomPayload(result.room,identity.playerId)});
  } catch(error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ok:false,error:"Payload too large"},{status:413});
    console.error("[commander] POST failed",error);
    return Response.json({ok:false,error:"Internal Commander error"},{status:500});
  }
}
