import { randomInt } from "node:crypto";
import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { fourPlayerActionReceipts, fourPlayerRooms, fourPlayerSeats, players } from "@/db/schema";
import {
  createFourPlayerMode,
  drawForActiveSeat,
  eliminateFourPlayerSeat,
  endFourPlayerTurn,
  passFourPlayerPriority,
  type FourPlayerRuntimeState,
} from "@/game/four-player-mode";
import type { FourPlayerSeat } from "@/game/four-player-rules";
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

function actionIdFromBody(body: Record<string, unknown>): string | null {
  const actionId = String(body.actionId || "").trim();
  return actionId.length >= 8 && actionId.length <= 80 ? actionId : null;
}

function runtimeFromRoom(room: typeof fourPlayerRooms.$inferSelect): FourPlayerRuntimeState {
  if (!room.runtimeState || typeof room.runtimeState !== "object") throw new Error("FOUR_PLAYER_RUNTIME_MISSING");
  return room.runtimeState as FourPlayerRuntimeState;
}

async function existingReceipt(tx: any, roomId: number, playerId: number, actionId: string) {
  const [receipt] = await tx.select().from(fourPlayerActionReceipts).where(and(
    eq(fourPlayerActionReceipts.roomId, roomId),
    eq(fourPlayerActionReceipts.playerId, playerId),
    eq(fourPlayerActionReceipts.actionId, actionId),
  )).limit(1);
  return receipt ?? null;
}

async function saveGameplayMutation(tx: any, input: {
  room: typeof fourPlayerRooms.$inferSelect;
  playerId: number;
  actionId: string;
  runtime: FourPlayerRuntimeState;
}) {
  const nextVersion = input.room.version + 1;
  const [updated] = await tx.update(fourPlayerRooms).set({
    state: input.runtime.phase === "gameover" ? "finished" : "playing",
    activeSeat: input.runtime.activeSeat,
    prioritySeat: input.runtime.prioritySeat,
    turnNumber: input.runtime.turnNumber,
    runtimeState: input.runtime,
    publicState: {
      phase: input.runtime.phase,
      stackDepth: input.runtime.stack.length,
      combatAssignments: input.runtime.combat.length,
      winnerSeat: input.runtime.winnerSeat,
    },
    winnerPlayerId: input.runtime.winnerSeat == null ? null : input.runtime.seats[input.runtime.winnerSeat].playerId,
    version: nextVersion,
    updatedAt: new Date(),
  }).where(eq(fourPlayerRooms.id, input.room.id)).returning();
  await tx.insert(fourPlayerActionReceipts).values({
    roomId: input.room.id,
    playerId: input.playerId,
    actionId: input.actionId,
    resultingVersion: nextVersion,
  });
  return updated;
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
        const [updated] = room.state === "waiting"
          ? [room]
          : await tx.update(fourPlayerRooms).set({ state: "waiting", version: room.version + 1, updatedAt: new Date() }).where(eq(fourPlayerRooms.id, room.id)).returning();
        return { room: updated, seats, duplicate: false as const };
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
        const [seat] = await tx.select().from(fourPlayerSeats).where(and(eq(fourPlayerSeats.roomId, room.id), eq(fourPlayerSeats.playerId, identity.playerId!))).limit(1).for("update");
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

    if (action === "start") {
      const result = await db.transaction(async (tx) => {
        const [room] = await tx.select().from(fourPlayerRooms).where(eq(fourPlayerRooms.code, code)).limit(1).for("update");
        if (!room) return { error: "Room not found", status: 404 as const };
        if (room.hostPlayerId !== identity.playerId) return { error: "Only the host may start the room", status: 403 as const };
        if (room.state !== "ready") return { error: "All four players must be ready", status: 409 as const };
        const seats = await tx.select().from(fourPlayerSeats).where(eq(fourPlayerSeats.roomId, room.id)).orderBy(fourPlayerSeats.seat);
        if (seats.length !== 4 || !seats.every((seat: typeof fourPlayerSeats.$inferSelect) => seat.ready === 1)) return { error: "All four players must be ready", status: 409 as const };
        const rules = room.rulesSnapshot as { nexusStart?: number; startHand?: number };
        const participants = seats.map((seat: typeof fourPlayerSeats.$inferSelect) => {
          const snapshot = seat.deckSnapshot as { cards?: unknown };
          const cards = Array.isArray(snapshot.cards) ? snapshot.cards.map(String) : [];
          return { seat: seat.seat as FourPlayerSeat, playerId: seat.playerId, playerName: seat.playerName, deck: cards, generalDefId: seat.generalDefId };
        });
        const runtime = createFourPlayerMode({
          participants,
          startingLife: Math.max(1, Math.trunc(Number(rules.nexusStart) || seatLife(seats))),
          startHand: Math.max(0, Math.trunc(Number(rules.startHand) || 5)),
          seed: randomInt(1, 0x7fffffff),
        });
        const [updated] = await tx.update(fourPlayerRooms).set({
          state: "playing",
          activeSeat: runtime.activeSeat,
          prioritySeat: runtime.prioritySeat,
          turnNumber: runtime.turnNumber,
          runtimeState: runtime,
          publicState: { phase: runtime.phase, stackDepth: 0, combatAssignments: 0 },
          version: room.version + 1,
          updatedAt: new Date(),
        }).where(eq(fourPlayerRooms.id, room.id)).returning();
        return { room: updated, seats };
      });
      if ("error" in result) return Response.json({ ok: false, error: result.error }, { status: result.status });
      return Response.json({ ok: true, room: projectFourPlayerRoom(result.room, result.seats, identity.playerId) });
    }

    if (["pass", "end-turn", "forfeit"].includes(action)) {
      const actionId = actionIdFromBody(body);
      if (!actionId) return Response.json({ ok: false, error: "Gameplay actions require an actionId of 8-80 characters" }, { status: 400 });
      const result = await db.transaction(async (tx) => {
        const [room] = await tx.select().from(fourPlayerRooms).where(eq(fourPlayerRooms.code, code)).limit(1).for("update");
        if (!room) return { error: "Room not found", status: 404 as const };
        if (room.state !== "playing") return { error: "Room is not playing", status: 409 as const };
        const seats = await tx.select().from(fourPlayerSeats).where(eq(fourPlayerSeats.roomId, room.id)).orderBy(fourPlayerSeats.seat);
        const actor = seats.find((seat: typeof fourPlayerSeats.$inferSelect) => seat.playerId === identity.playerId);
        if (!actor) return { error: "Not a participant", status: 403 as const };
        const receipt = await existingReceipt(tx, room.id, identity.playerId!, actionId);
        if (receipt) return { room, seats, duplicate: true as const, advancePhaseAllowed: false };

        let runtime = runtimeFromRoom(room);
        let advancePhaseAllowed = false;
        if (action === "pass") {
          const passed = passFourPlayerPriority(runtime, actor.seat as FourPlayerSeat);
          runtime = passed.state;
          advancePhaseAllowed = passed.advancePhaseAllowed;
        } else if (action === "end-turn") {
          if (runtime.activeSeat !== actor.seat) return { error: "Only the active seat may end the turn", status: 403 as const };
          if (runtime.stack.length) return { error: "Cannot end turn while the stack is not empty", status: 409 as const };
          runtime = drawForActiveSeat(endFourPlayerTurn(runtime));
        } else {
          runtime = eliminateFourPlayerSeat(runtime, actor.seat as FourPlayerSeat);
          await tx.update(fourPlayerSeats).set({ eliminated: 1, nexusHealth: 0 }).where(eq(fourPlayerSeats.id, actor.id));
        }
        const updated = await saveGameplayMutation(tx, { room, playerId: identity.playerId!, actionId, runtime });
        const normalizedSeats = action === "forfeit"
          ? seats.map((seat: typeof fourPlayerSeats.$inferSelect) => seat.id === actor.id ? { ...seat, eliminated: 1, nexusHealth: 0 } : seat)
          : seats;
        return { room: updated, seats: normalizedSeats, duplicate: false as const, advancePhaseAllowed };
      });
      if ("error" in result) return Response.json({ ok: false, error: result.error }, { status: result.status });
      return Response.json({
        ok: true,
        duplicate: result.duplicate,
        advancePhaseAllowed: result.advancePhaseAllowed,
        room: projectFourPlayerRoom(result.room, result.seats, identity.playerId),
      });
    }

    if (action === "leave") {
      const result = await db.transaction(async (tx) => {
        const [room] = await tx.select().from(fourPlayerRooms).where(eq(fourPlayerRooms.code, code)).limit(1).for("update");
        if (!room) return { error: "Room not found", status: 404 as const };
        if (room.state === "playing") return { error: "Use forfeit during a live 4P game", status: 409 as const };
        const [seat] = await tx.select().from(fourPlayerSeats).where(and(eq(fourPlayerSeats.roomId, room.id), eq(fourPlayerSeats.playerId, identity.playerId!))).limit(1);
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
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("FOUR_PLAYER_")) return Response.json({ ok: false, error: message }, { status: 409 });
    console.error("[four-player/:code] POST failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

function seatLife(seats: Array<typeof fourPlayerSeats.$inferSelect>): number {
  return Math.max(1, ...seats.map((seat) => seat.nexusHealth));
}
