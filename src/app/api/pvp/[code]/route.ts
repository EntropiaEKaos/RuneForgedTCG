import { runtimeGate } from "@/lib/runtime-gates";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { pvpActionReceipts, pvpRooms, pvpSpectatorSnapshots, chatMessages, players } from "@/db/schema";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { resolveDeck, snapshotDeck } from "@/game/deck-service";
import { snapshotReplayBundle, type ReplayDeckSnapshot } from "@/game/replay-content-snapshot";
import { withRegisteredCardSnapshot } from "@/game/custom-registry";
import { applyAuthoritativePvpSnapshotAction } from "@/lib/pvp-authoritative-transition";
import { toPvpParticipantGameState } from "@/lib/pvp-public-state";
import { deriveGameEvents } from "@/game/events";
import { actionLogHash, replayIntegrity } from "@/lib/match-integrity";
import { createGame } from "@/game/engine";
import { type GameAction } from "@/game/reducer";
import { sanitizeChat } from "@/lib/chat-sanitize";
import { cleanupExpiredRuntimeSessions, PVP_FINISHED_TTL_MS, PVP_PLAYING_TTL_MS } from "@/lib/session-cleanup";
import type { GameState, PlayerId, DeckInput } from "@/game/types";
import { settlePvpRoom } from "@/lib/pvp-settlement";
import { isValidPvpActionId } from "@/lib/pvp-action-id";
import { consumeRateLimit } from "@/lib/rate-limit";
import { ensureConfigLoaded, getGameConfigSync } from "@/game/settings";
import { validateFormatDeckWithFormats } from "@/game/format-rules";
import { getRuntimeFormats } from "@/lib/control-plane";

export const dynamic = "force-dynamic";

function actorSide(room: { hostPlayerId: number | null; guestPlayerId: number | null }, playerId: number): PlayerId | null {
  if (room.hostPlayerId === playerId) return "player";
  if (room.guestPlayerId === playerId) return "ai";
  return null;
}

function publicRoom(room: typeof pvpRooms.$inferSelect, viewerId: number) {
  const viewerIsGuest = room.guestPlayerId === viewerId;
  const publicState = room.gameState
    ? toPvpParticipantGameState(room.gameState as GameState, viewerIsGuest)
    : null;
  return {
    id: room.id,
    code: room.code,
    hostName: room.hostName,
    guestName: room.guestName,
    state: room.state,
    mode: room.mode,
    winner: room.winner,
    version: room.version,
    viewerSide: viewerIsGuest ? "guest" as const : "host" as const,
    gameState: publicState,
    contentHash: room.contentHash,
    rankedSeasonId: room.rankedSeasonId,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    expiresAt: room.expiresAt,
  };
}

async function settleForfeit(room: typeof pvpRooms.$inferSelect, actor: PlayerId) {
  const winnerPlayerId = actor === "player" ? room.guestPlayerId : room.hostPlayerId;
  const winnerName = actor === "player" ? room.guestName : room.hostName;
  if (winnerPlayerId == null || !winnerName) throw new Error("Cannot forfeit a room without two players");
  return db.transaction(async (tx) => {
    const [locked] = await tx.select().from(pvpRooms).where(eq(pvpRooms.id, room.id)).limit(1).for("update");
    if (!locked) throw new Error("Room not found");
    if (locked.state !== "playing") return { alreadyFinished: true, matchIds: [] as number[] };
    const forfeitedState = locked.gameState ? { ...(locked.gameState as GameState), phase: "gameover" as const, winner: actor === "player" ? "ai" as const : "player" as const } : null;
    const [updated] = await tx.update(pvpRooms).set({ state: "finished", winner: winnerName, gameState: forfeitedState, version: locked.version + 1, expiresAt: new Date(Date.now() + PVP_FINISHED_TTL_MS), updatedAt: new Date() }).where(and(eq(pvpRooms.id, locked.id), eq(pvpRooms.version, locked.version))).returning();
    if (!updated) throw new Error("Room changed during forfeit");
    if (forfeitedState) await tx.insert(pvpSpectatorSnapshots).values({ roomId: updated.id, roomVersion: updated.version, gameState: forfeitedState }).onConflictDoNothing();
    const settlement = await settlePvpRoom({ tx, roomId: locked.id, finalState: forfeitedState, actionLog: Array.isArray(locked.actionLog) ? locked.actionLog as GameAction[] : [], winnerPlayerId, winnerName, isForfeit: true });
    return { alreadyFinished: false, matchIds: settlement.matchIds };
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  try {
    await cleanupExpiredRuntimeSessions().catch(() => ({ pvpExpired: 0, pvpDeleted: 0, drafts: 0 }));
    const { code } = await ctx.params;
    const roomCode = code.toUpperCase();
    const identity = await requireStablePlayerIdentity(req);
    const [room] = await db.select().from(pvpRooms).where(eq(pvpRooms.code, roomCode)).limit(1);
    if (!room) return Response.json({ ok: false, error: "Room not found" }, { status: 404 });
    if (!identity || identity.playerId == null || (room.hostPlayerId !== identity.playerId && room.guestPlayerId !== identity.playerId)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
    const chat = await db.select().from(chatMessages).where(eq(chatMessages.roomCode, roomCode)).orderBy(desc(chatMessages.createdAt)).limit(30);
    return Response.json({ ok: true, room: publicRoom(room, identity.playerId), chat: chat.reverse() });
  } catch (error) {
    console.error("[pvp/:code] GET failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  await ensureConfigLoaded();
  try {
    await cleanupExpiredRuntimeSessions().catch(() => ({ pvpExpired: 0, pvpDeleted: 0, drafts: 0 }));
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 1_500_000) return Response.json({ ok: false, error: "Payload too large" }, { status: 413 });
    const { code } = await ctx.params;
    const roomCode = code.toUpperCase();
    const body = await req.json();
    const action = body.action;
    const [room] = await db.select().from(pvpRooms).where(eq(pvpRooms.code, roomCode)).limit(1);
    if (!room) return Response.json({ ok: false, error: "Room not found" }, { status: 404 });

    if (action === "join") {
      const identity = await requireStablePlayerIdentity(req);
      if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Authenticated player session required" }, { status: 401 });
      const guestName = identity.playerName;
      const guestDeckId = String(body.guestDeck || "");
      if (!guestName || !guestDeckId) return Response.json({ ok: false, error: "Missing guest data" }, { status: 400 });
      if (room.hostPlayerId === identity.playerId) return Response.json({ ok: false, error: "Can't join own room" }, { status: 400 });
      if (room.guestPlayerId != null) return Response.json({ ok: false, error: "Room already full" }, { status: 400 });
      try {
        if (room.hostPlayerId == null) throw new Error("Legacy room");
        const guest = await resolveDeck(db, identity.playerId, guestDeckId);
        const formats = await getRuntimeFormats();
        const guestFormat = validateFormatDeckWithFormats(guest.cards, guest.formatId || "vanilla", formats);
        if (!guestFormat.ok) return Response.json({ ok: false, error: guestFormat.errors.join(" ") }, { status: 409 });
        const hostPreview: DeckInput = room.hostDeckSnapshot ? snapshotDeck(room.hostDeckSnapshot as DeckInput) : await resolveDeck(db, room.hostPlayerId, room.hostDeck);
        const hostFormat = validateFormatDeckWithFormats(hostPreview.cards, hostPreview.formatId || "vanilla", formats);
        if (!hostFormat.ok) return Response.json({ ok: false, error: "Host deck is no longer legal in its selected format" }, { status: 409 });
        const [updated] = await db.transaction(async (tx) => {
          const [guestPlayer] = await tx.select({ id: players.id }).from(players).where(eq(players.id, identity.playerId!)).limit(1).for("update");
          if (!guestPlayer) return [];
          const [locked] = await tx.select().from(pvpRooms).where(eq(pvpRooms.id, room.id)).limit(1).for("update");
          if (!locked || locked.version !== room.version || locked.guestPlayerId != null || locked.state !== "waiting") return [];
          // The player row lock above serializes join/create for this identity.
          // A player must explicitly cancel an existing waiting lobby before
          // joining another room, and can never join while already playing.
          const [activeElsewhere] = await tx.select({ id: pvpRooms.id }).from(pvpRooms).where(and(
            or(eq(pvpRooms.hostPlayerId, identity.playerId!), eq(pvpRooms.guestPlayerId, identity.playerId!)),
            or(eq(pvpRooms.state, "waiting"), eq(pvpRooms.state, "playing")),
          )).limit(1);
          if (activeElsewhere) return [];
          if (locked.hostPlayerId == null) return [];
          const host: DeckInput = locked.hostDeckSnapshot ? snapshotDeck(locked.hostDeckSnapshot as DeckInput) : hostPreview;
          const guestSnapshot = snapshotDeck(guest);
          const contentSnapshot = snapshotReplayBundle(host, guestSnapshot);
          const initialGameState = withRegisteredCardSnapshot(contentSnapshot.cardDefs, () =>
            createGame(locked.hostName, host, guestSnapshot, Boolean(locked.playerFirst), locked.seed ?? undefined),
          );
          // createGame() defaults the internal "ai" seat to mulligan-complete for PvE.
          // In Casual PvP that seat is occupied by the second human, so both human
          // participants must start with their mulligan pending.
          const gameState: GameState = {
            ...initialGameState,
            mulliganDone: { player: false, ai: false },
          };
          const rows = await tx.update(pvpRooms).set({ guestName, guestPlayerId: identity.playerId, guestDeck: guestDeckId, guestDeckSnapshot: guestSnapshot, contentSnapshot, contentHash: contentSnapshot.contentHash, state: "playing", settledAt: null, gameState, version: locked.version + 1, actionLog: [], eventLog: [], winner: null, expiresAt: new Date(Date.now() + PVP_PLAYING_TTL_MS), updatedAt: new Date() }).where(eq(pvpRooms.id, locked.id)).returning();
          if (rows[0]) await tx.insert(pvpSpectatorSnapshots).values({ roomId: rows[0].id, roomVersion: rows[0].version, gameState }).onConflictDoNothing();
          return rows;
        });
        if (!updated) return Response.json({ ok: false, error: "Room changed; retry join" }, { status: 409 });
        return Response.json({ ok: true, room: publicRoom(updated, identity.playerId) });
      } catch {
        return Response.json({ ok: false, error: "Invalid or unauthorized deck" }, { status: 400 });
      }
    }

    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const actor = actorSide(room, identity.playerId);
    if (!actor) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

    if (action === "chat") {
      const moderation = getGameConfigSync().advanced.moderation;
      const rate = await consumeRateLimit(`pvp-chat:${identity.playerId}`, moderation.floodMaxMessages, moderation.floodWindowSeconds * 1000);
      if (!rate.allowed) return Response.json({ ok: false, error: "Chat rate limit exceeded" }, { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } });
      const message = sanitizeChat(body.message, moderation.chatMaxLength);
      if (!message) return Response.json({ ok: false, error: "Missing message" }, { status: 400 });
      await db.insert(chatMessages).values({ roomCode, playerName: identity.playerName, playerId: identity.playerId, message });
      return Response.json({ ok: true });
    }

    if (action === "updateState" || action === "gameAction") {
      // Authoritative actions acquire a DB transaction + row lock. Limit abusive
      // retry/invalid-action floods without constraining normal interactive play.
      const actionRate = await consumeRateLimit(`pvp-action:${identity.playerId}`, 240, 60_000);
      if (!actionRate.allowed) {
        return Response.json(
          { ok: false, error: "PvP action rate limit exceeded" },
          { status: 429, headers: { "retry-after": String(actionRate.retryAfterSeconds) } },
        );
      }
      const expectedVersion = Number(body.version);
      if (!Number.isInteger(expectedVersion)) return Response.json({ ok: false, error: "Invalid version" }, { status: 400 });
      const actionId = String(body.actionId || "").trim();
      if (!isValidPvpActionId(actionId)) {
        return Response.json({ ok: false, error: "A valid actionId is required" }, { status: 400 });
      }
      const gameAction = body.gameAction as GameAction;
      const result = await db.transaction(async (tx) => {
        const [locked] = await tx.select().from(pvpRooms).where(eq(pvpRooms.id, room.id)).limit(1).for("update");
        if (!locked || locked.state !== "playing" || !locked.gameState) return { error: "Match is not active", status: 409 as const };
        const [receipt] = await tx.select().from(pvpActionReceipts).where(and(eq(pvpActionReceipts.roomId, locked.id), eq(pvpActionReceipts.playerId, identity.playerId!), eq(pvpActionReceipts.actionId, actionId))).limit(1);
        if (receipt) return { duplicate: true as const, updated: locked, status: 200 as const };
        if (locked.version !== expectedVersion) return { conflict: true, room: publicRoom(locked, identity.playerId), status: 409 as const };
        const state = locked.gameState as GameState;
        const transition = applyAuthoritativePvpSnapshotAction({
          state,
          gameAction,
          actor,
          contentSnapshot: locked.contentSnapshot as ReplayDeckSnapshot | null,
          contentHash: locked.contentHash,
        });
        if (!transition.ok) return { error: transition.error, code: transition.code, status: transition.status };
        const { authorized, next } = transition;
        const actionLog = [...(Array.isArray(locked.actionLog) ? locked.actionLog as GameAction[] : []), authorized];
        const eventLog = [...(Array.isArray(locked.eventLog) ? locked.eventLog : []), ...deriveGameEvents(state, next)];
        const winnerPlayerId = next.winner ? (next.winner === "player" ? locked.hostPlayerId : locked.guestPlayerId) : null;
        const winner = next.winner ? (next.winner === "player" ? locked.hostName : locked.guestName) : null;
        const [updated] = await tx.update(pvpRooms).set({ gameState: next, winner, state: winner ? "finished" : "playing", version: locked.version + 1, actionLog, eventLog, actionHash: actionLogHash(actionLog), integrityHash: replayIntegrity(actionLog, next), expiresAt: new Date(Date.now() + (winner ? PVP_FINISHED_TTL_MS : PVP_PLAYING_TTL_MS)), updatedAt: new Date() }).where(and(eq(pvpRooms.id, locked.id), eq(pvpRooms.version, locked.version))).returning();
        if (!updated) return { conflict: true, status: 409 as const };
        await tx.insert(pvpSpectatorSnapshots).values({ roomId: updated.id, roomVersion: updated.version, gameState: next }).onConflictDoNothing();
        await tx.insert(pvpActionReceipts).values({ roomId: locked.id, playerId: identity.playerId!, actionId, resultingVersion: updated.version });
        let settlement = null;
        if (winnerPlayerId != null) {
          settlement = await settlePvpRoom({ tx, roomId: locked.id, finalState: next, actionLog, winnerPlayerId, winnerName: winner! });
        }
        return { updated: updated!, settlement, duplicate: false as const, status: 200 as const };
      });
      if ("error" in result) return Response.json({ ok: false, error: result.error }, { status: result.status });
      if ("conflict" in result && result.conflict) return Response.json({ ok: false, conflict: true, ...(result.room ? { room: result.room } : {}) }, { status: 409 });
      const roomResult = publicRoom(result.updated as NonNullable<typeof result.updated>, identity.playerId);
      return Response.json({ ok: true, authoritative: true, duplicate: result.duplicate, room: roomResult, gameState: roomResult.gameState, settlement: "settlement" in result ? result.settlement : null });
    }

    if (action === "leave") {
      if (room.state === "waiting") {
        if (room.hostPlayerId !== identity.playerId) return Response.json({ ok: false, error: "Only the host can cancel a waiting room" }, { status: 403 });
        await db.delete(pvpRooms).where(and(eq(pvpRooms.id, room.id), eq(pvpRooms.hostPlayerId, identity.playerId), isNull(pvpRooms.guestPlayerId)));
        return Response.json({ ok: true, cancelled: true });
      }
      if (room.state === "playing") {
        const settlement = await settleForfeit(room, actor);
        return Response.json({ ok: true, forfeited: true, settlement });
      }
      return Response.json({ ok: true, alreadyFinished: true });
    }
    return Response.json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[pvp/:code] POST failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}