import { and, asc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { commanderRooms, commanderSeats, players } from "@/db/schema";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { commanderInitialState, COMMANDER_ALPHA_RULES, nextCommanderSeat, type CommanderSeatIndex } from "@/lib/commander-rules";
import { validateOwnedCommanderLoadout } from "@/lib/commander-service";
import { runtimeGate } from "@/lib/runtime-gates";

export const dynamic = "force-dynamic";
const PLAYING_TTL_MS = 6 * 60 * 60 * 1000;

async function loadRoom(code:string) {
  const [room]=await db.select().from(commanderRooms).where(eq(commanderRooms.code,code)).limit(1);
  if (!room) return null;
  const seats=await db.select().from(commanderSeats).where(eq(commanderSeats.roomId,room.id)).orderBy(asc(commanderSeats.seat));
  return { room, seats };
}

function publicRoom(data:NonNullable<Awaited<ReturnType<typeof loadRoom>>>, viewerId:number) {
  const ownSeat=data.seats.find((seat)=>seat.playerId===viewerId) ?? null;
  return {
    id:data.room.id,
    code:data.room.code,
    state:data.room.state,
    activeSeat:data.room.activeSeat,
    round:data.room.round,
    version:data.room.version,
    rules:data.room.rulesSnapshot,
    gameState:data.room.gameState,
    viewerSeat:ownSeat?.seat ?? null,
    hostPlayerId:data.room.hostPlayerId,
    seats:data.seats.map((seat)=>({
      seat:seat.seat,
      playerId:seat.playerId,
      playerName:seat.playerName,
      generalDefId:seat.generalDefId,
      ready:seat.ready,
      isHost:seat.playerId===data.room.hostPlayerId,
      cardCount:Array.isArray(seat.deckCards)?seat.deckCards.length:0,
    })),
  };
}

export async function GET(req:NextRequest, ctx:{params:Promise<{code:string}>}) {
  const identity=await requireStablePlayerIdentity(req);
  if (!identity?.playerId) return Response.json({ok:false,error:"Authenticated player session required"},{status:401});
  const {code}=await ctx.params;
  const data=await loadRoom(code.toUpperCase());
  if (!data) return Response.json({ok:false,error:"Commander room not found"},{status:404});
  if (!data.seats.some((seat)=>seat.playerId===identity.playerId)) return Response.json({ok:false,error:"Join the room before reading participant state"},{status:403});
  return Response.json({ok:true,room:publicRoom(data,identity.playerId)});
}

export async function POST(req:NextRequest, ctx:{params:Promise<{code:string}>}) {
  const blocked=await runtimeGate("general");
  if (blocked) return blocked;
  const identity=await requireStablePlayerIdentity(req);
  if (!identity?.playerId) return Response.json({ok:false,error:"Authenticated player session required"},{status:401});
  const {code}=await ctx.params;
  const roomCode=code.toUpperCase();
  const body=await req.json().catch(()=>({}));
  const action=String(body.action||"");

  if (action==="join") {
    const deckCards=Array.isArray(body.deckCards)?body.deckCards.map(String):[];
    const generalDefId=String(body.generalDefId||"").trim();
    const validation=await validateOwnedCommanderLoadout(db,identity.playerId,deckCards,generalDefId);
    if (!validation.ok) return Response.json({ok:false,error:validation.errors.join(" ")},{status:409});

    const result=await db.transaction(async(tx)=>{
      const [player]=await tx.select({id:players.id,name:players.name}).from(players).where(eq(players.id,identity.playerId!)).limit(1).for("update");
      const [room]=await tx.select().from(commanderRooms).where(eq(commanderRooms.code,roomCode)).limit(1).for("update");
      if (!player||!room) return {error:"Commander room not found",status:404 as const};
      if (room.state!=="waiting") return {error:"Commander room already started",status:409 as const};
      const seats=await tx.select().from(commanderSeats).where(eq(commanderSeats.roomId,room.id)).orderBy(asc(commanderSeats.seat));
      if (seats.some((seat)=>seat.playerId===player.id)) return {room};
      if (seats.length>=COMMANDER_ALPHA_RULES.playerCount) return {error:"Commander room is full",status:409 as const};
      const occupied=new Set(seats.map((seat)=>seat.seat));
      const seat=([0,1,2,3] as CommanderSeatIndex[]).find((value)=>!occupied.has(value));
      if (seat==null) return {error:"No Commander seat available",status:409 as const};
      await tx.insert(commanderSeats).values({roomId:room.id,seat,playerId:player.id,playerName:player.name,deckCards,generalDefId,ready:false});
      await tx.update(commanderRooms).set({version:room.version+1,updatedAt:new Date()}).where(eq(commanderRooms.id,room.id));
      return {room};
    });
    if ("error" in result) return Response.json({ok:false,error:result.error},{status:result.status});
  } else if (action==="ready") {
    const ready=body.ready!==false;
    const result=await db.transaction(async(tx)=>{
      const [room]=await tx.select().from(commanderRooms).where(eq(commanderRooms.code,roomCode)).limit(1).for("update");
      if (!room) return {error:"Commander room not found",status:404 as const};
      if (room.state!=="waiting") return {error:"Commander room already started",status:409 as const};
      const changed=await tx.update(commanderSeats).set({ready}).where(and(eq(commanderSeats.roomId,room.id),eq(commanderSeats.playerId,identity.playerId!))).returning();
      if (!changed.length) return {error:"Player is not seated",status:403 as const};
      await tx.update(commanderRooms).set({version:room.version+1,updatedAt:new Date()}).where(eq(commanderRooms.id,room.id));
      return {room};
    });
    if ("error" in result) return Response.json({ok:false,error:result.error},{status:result.status});
  } else if (action==="start") {
    const result=await db.transaction(async(tx)=>{
      const [room]=await tx.select().from(commanderRooms).where(eq(commanderRooms.code,roomCode)).limit(1).for("update");
      if (!room) return {error:"Commander room not found",status:404 as const};
      if (room.hostPlayerId!==identity.playerId) return {error:"Only the host can start",status:403 as const};
      if (room.state!=="waiting") return {error:"Commander room already started",status:409 as const};
      const seats=await tx.select().from(commanderSeats).where(eq(commanderSeats.roomId,room.id)).orderBy(asc(commanderSeats.seat));
      if (seats.length!==COMMANDER_ALPHA_RULES.playerCount) return {error:"Four real players are required",status:409 as const};
      if (!seats.every((seat)=>seat.ready)) return {error:"All four players must be ready",status:409 as const};
      const state=commanderInitialState(seats.map((seat)=>({seat:seat.seat as CommanderSeatIndex,playerId:seat.playerId,playerName:seat.playerName,generalDefId:seat.generalDefId})));
      await tx.update(commanderRooms).set({state:"playing",gameState:state,activeSeat:0,round:1,version:room.version+1,expiresAt:new Date(Date.now()+PLAYING_TTL_MS),updatedAt:new Date()}).where(eq(commanderRooms.id,room.id));
      return {room};
    });
    if ("error" in result) return Response.json({ok:false,error:result.error},{status:result.status});
  } else if (action==="pass-turn") {
    const result=await db.transaction(async(tx)=>{
      const [room]=await tx.select().from(commanderRooms).where(eq(commanderRooms.code,roomCode)).limit(1).for("update");
      if (!room) return {error:"Commander room not found",status:404 as const};
      if (room.state!=="playing") return {error:"Commander room is not playing",status:409 as const};
      const [seat]=await tx.select().from(commanderSeats).where(and(eq(commanderSeats.roomId,room.id),eq(commanderSeats.playerId,identity.playerId!))).limit(1);
      if (!seat||seat.seat!==room.activeSeat) return {error:"It is not your Commander turn",status:409 as const};
      const next=nextCommanderSeat(room.activeSeat as CommanderSeatIndex);
      const nextRound=next===0?room.round+1:room.round;
      const current=(room.gameState&&typeof room.gameState==="object"?room.gameState:{}) as Record<string,unknown>;
      const gameState={...current,activeSeat:next,prioritySeat:next,round:nextRound};
      await tx.update(commanderRooms).set({activeSeat:next,round:nextRound,gameState,version:room.version+1,expiresAt:new Date(Date.now()+PLAYING_TTL_MS),updatedAt:new Date()}).where(eq(commanderRooms.id,room.id));
      return {room};
    });
    if ("error" in result) return Response.json({ok:false,error:result.error},{status:result.status});
  } else if (action==="leave") {
    const result=await db.transaction(async(tx)=>{
      const [room]=await tx.select().from(commanderRooms).where(eq(commanderRooms.code,roomCode)).limit(1).for("update");
      if (!room) return {error:"Commander room not found",status:404 as const};
      if (room.state!=="waiting") return {error:"Started Commander rooms cannot be left through the lobby action",status:409 as const};
      if (room.hostPlayerId===identity.playerId) {
        await tx.delete(commanderRooms).where(eq(commanderRooms.id,room.id));
        return {deleted:true};
      }
      const removed=await tx.delete(commanderSeats).where(and(eq(commanderSeats.roomId,room.id),eq(commanderSeats.playerId,identity.playerId!))).returning();
      if (!removed.length) return {error:"Player is not seated",status:403 as const};
      await tx.update(commanderRooms).set({version:room.version+1,updatedAt:new Date()}).where(eq(commanderRooms.id,room.id));
      return {deleted:false};
    });
    if ("error" in result) return Response.json({ok:false,error:result.error},{status:result.status});
    if ("deleted" in result&&result.deleted) return Response.json({ok:true,deleted:true});
  } else {
    return Response.json({ok:false,error:"Unsupported Commander action"},{status:400});
  }

  const data=await loadRoom(roomCode);
  if (!data) return Response.json({ok:true,deleted:true});
  return Response.json({ok:true,room:publicRoom(data,identity.playerId)});
}
