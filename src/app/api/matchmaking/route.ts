import { NextRequest } from "next/server";
import { randomInt } from "node:crypto";
import { db } from "@/db";
import { matchmakingQueue, matches, players, pvpRooms, pvpSpectatorSnapshots } from "@/db/schema";
import { cleanupExpiredRuntimeSessions, PVP_PLAYING_TTL_MS } from "@/lib/session-cleanup";
import { and, desc, eq, gt, isNotNull, lt, notInArray, or, sql } from "drizzle-orm";
import { resolveDeck, snapshotDeck } from "@/game/deck-service";
import { snapshotReplayBundle } from "@/game/replay-content-snapshot";
import { withRegisteredCardSnapshot } from "@/game/custom-registry";
import { createRankedRoomCertification, RANKED_PRECONS, resolveRankedPrecon } from "@/game/ranked-decks";
import { findOpenRankedSeason } from "@/lib/ranked-season";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import type { DeckInput } from "@/game/types";
import { createGame } from "@/game/engine";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRuntimeDecks, getRuntimeDefinition, getRuntimeFormats } from "@/lib/control-plane";
import { loadGameConfig } from "@/game/settings";
import { runtimeGate } from "@/lib/runtime-gates";
import { validateFormatDeckWithFormats } from "@/game/format-rules";

export const dynamic = "force-dynamic";

/**
 * Real ranked matchmaking queue:
 * - Only players currently in `matchmaking_queue` can be matched as humans.
 * - If no opponent is found, the player is queued.
 * - Client may pass allowAiFallback=true (or waitSeconds >= 8) to fall back to AI.
 */
export async function POST(req: NextRequest) {
  const maintenanceBlocked = await runtimeGate("general");
  if (maintenanceBlocked) return maintenanceBlocked;
  await cleanupExpiredRuntimeSessions().catch(() => ({ pvpExpired: 0, pvpDeleted: 0, drafts: 0 }));
  try {
    const body = await req.json();
    const identity = await requireStablePlayerIdentity(req);
    if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const rate = await consumeRateLimit(`matchmaking:${identity.playerId}`, 45, 60_000);
    if (!rate.allowed) return Response.json({ ok: false, error: "Matchmaking rate limit exceeded" }, { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } });
    const playerName = identity.playerName;
    const playerDeckId = String(body.deckId || "");
    const mode = body.mode === "casual" ? "casual" : "ranked";
    if (mode === "ranked") {
      const rankedBlocked = await runtimeGate("ranked");
      if (rankedBlocked) return rankedBlocked;
    }
    const allowAiFallback = Boolean(body.allowAiFallback);
    const waitSeconds = Math.max(0, Math.min(120, Number(body.waitSeconds) || 0));
    const config = await loadGameConfig();
    const definition = await getRuntimeDefinition("matchmaking-policies", mode === "casual" ? "casual-default" : "ranked-default");
    const policy = { ...config.advanced.matchmaking, ...(definition || {}) };
    const DECKS = await getRuntimeDecks();
    if (mode === "casual" && !DECKS.length) return Response.json({ ok: false, error: "No official decks configured" }, { status: 503 });

    const [player] = await db.select().from(players).where(eq(players.id, identity.playerId!)).limit(1);
    if (!player) {
      return Response.json({ ok: false, error: "Player not found. Create a profile first." }, { status: 404 });
    }

    let playerDeck: DeckInput;
    try {
      playerDeck = mode === "ranked"
        ? resolveRankedPrecon(playerDeckId || RANKED_PRECONS[0].id)
        : await resolveDeck(db, player.id, playerDeckId || DECKS[0].id);
    } catch {
      return Response.json({ ok: false, error: mode === "ranked" ? "Deck is not in the certified Ranked pool" : "Invalid or unauthorized deck" }, { status: 400 });
    }
    const formats = await getRuntimeFormats();
    const playerFormat = validateFormatDeckWithFormats(playerDeck.cards, playerDeck.formatId || "vanilla", formats);
    if (!playerFormat.ok) return Response.json({ ok: false, error: playerFormat.errors.join(" ") }, { status: 409 });
    if (mode === "ranked" && !playerFormat.format.rankedEligible) return Response.json({ ok: false, error: `Deck format ${playerDeck.formatId || "vanilla"} is not certified for Ranked` }, { status: 409 });

    const range = Math.min(policy.maxRange, policy.baseRange + Math.floor(waitSeconds / policy.rangeStepSeconds) * policy.rangeStep);

    // Filtra por entradas recentes para evitar parear contra jogadores órfãos
    // que fecharam a aba sem dar DELETE. O client faz polling a cada ~1.8s e
    // atualiza createdAt a cada tentativa, então um buscador ativo nunca fica
    // "velho" por mais que alguns segundos — 20s dá folga de sobra para
    // latência de rede sem deixar entradas abandonadas pareáveis por minutos.
    const staleThreshold = new Date(Date.now() - policy.staleSeconds * 1000);
    // Limpeza oportunista: como não há cron, aproveitamos cada request para
    // varrer entradas realmente antigas (>10min) da tabela.
    await db.delete(matchmakingQueue).where(lt(matchmakingQueue.createdAt, new Date(Date.now() - policy.queueTtlSeconds * 1000)));

    const matchResult = await db.transaction(async (tx) => {
      // Lock the caller's player row before inspecting the queue. This serializes
      // concurrent polling requests for the same player and prevents one queue
      // entry from being matched twice by two simultaneous transactions.
      const [lockedPlayer] = await tx.select().from(players).where(eq(players.id, player.id)).limit(1).for("update");
      if (!lockedPlayer) return { error: "Player not found", status: 404 as const };
      const rankedSeason = mode === "ranked" ? await findOpenRankedSeason(tx) : null;
      if (mode === "ranked" && !rankedSeason) return { error: "No active Ranked season is open", status: 409 as const };
      const [activeRoom] = await tx.select({
        id: pvpRooms.id,
        code: pvpRooms.code,
        hostPlayerId: pvpRooms.hostPlayerId,
        guestPlayerId: pvpRooms.guestPlayerId,
        hostName: pvpRooms.hostName,
        guestName: pvpRooms.guestName,
      }).from(pvpRooms).where(and(or(eq(pvpRooms.hostPlayerId, lockedPlayer.id), eq(pvpRooms.guestPlayerId, lockedPlayer.id)), eq(pvpRooms.state, "playing"))).limit(1);
      if (activeRoom) {
        await tx.delete(matchmakingQueue).where(and(eq(matchmakingQueue.playerId, lockedPlayer.id), eq(matchmakingQueue.mode, mode)));
        return { activeRoom };
      }

      const opponentFilters = [
        eq(matchmakingQueue.mode, mode),
        gt(matchmakingQueue.mmr, lockedPlayer.mmr - range),
        lt(matchmakingQueue.mmr, lockedPlayer.mmr + range),
        gt(matchmakingQueue.createdAt, staleThreshold),
        sql`${matchmakingQueue.playerId} <> ${lockedPlayer.id}`,
      ];
      if (mode === "ranked" && Number(policy.rematchCooldownSeconds || 0) > 0) {
        const cutoff = new Date(Date.now() - Number(policy.rematchCooldownSeconds) * 1000);
        const recent = await tx.select({ opponentPlayerId: matches.opponentPlayerId }).from(matches).where(and(
          eq(matches.playerId, lockedPlayer.id),
          eq(matches.matchMode, "ranked"),
          gt(matches.createdAt, cutoff),
          isNotNull(matches.opponentPlayerId),
        )).limit(20);
        const recentOpponentIds = [...new Set(recent.map((row: { opponentPlayerId: number | null }) => row.opponentPlayerId).filter((id: number | null): id is number => id != null))];
        if (recentOpponentIds.length) opponentFilters.push(notInArray(matchmakingQueue.playerId, recentOpponentIds));
      }
      const [opponent] = await tx.select().from(matchmakingQueue).where(and(...opponentFilters)).orderBy(desc(matchmakingQueue.createdAt)).limit(1).for("update", { skipLocked: true });
      if (opponent) {
        const opponentIds = [lockedPlayer.id, opponent.playerId].sort((a, b) => a - b);
        for (const id of opponentIds) await tx.select({ id: players.id }).from(players).where(eq(players.id, id)).limit(1).for("update");
        const [opponentActiveRoom] = await tx.select({ id: pvpRooms.id }).from(pvpRooms).where(and(or(eq(pvpRooms.hostPlayerId, opponent.playerId), eq(pvpRooms.guestPlayerId, opponent.playerId)), eq(pvpRooms.state, "playing"))).limit(1);
        if (opponentActiveRoom) {
          await tx.delete(matchmakingQueue).where(eq(matchmakingQueue.id, opponent.id));
          return { status: "retry" as const };
        }
        let opponentDeck: DeckInput;
        try {
          opponentDeck = mode === "ranked" ? resolveRankedPrecon(opponent.deckId) : await resolveDeck(tx, opponent.playerId, opponent.deckId);
        } catch {
          await tx.delete(matchmakingQueue).where(eq(matchmakingQueue.id, opponent.id));
          return { status: "retry" as const };
        }
        const opponentFormat = validateFormatDeckWithFormats(opponentDeck.cards, opponentDeck.formatId || "vanilla", formats);
        if (!opponentFormat.ok || (mode === "ranked" && !opponentFormat.format.rankedEligible)) {
          await tx.delete(matchmakingQueue).where(eq(matchmakingQueue.id, opponent.id));
          return { status: "retry" as const };
        }
        const hostSnapshot = snapshotDeck(playerDeck);
        const guestSnapshot = snapshotDeck(opponentDeck);
        const contentSnapshot = snapshotReplayBundle(hostSnapshot, guestSnapshot);
        await tx.delete(matchmakingQueue).where(eq(matchmakingQueue.id, opponent.id));
        await tx.delete(matchmakingQueue).where(and(eq(matchmakingQueue.playerId, player.id), eq(matchmakingQueue.mode, mode)));
        const code = generateCode();
        const seed = randomInt(1, 0x7fffffff);
        const playerFirst = randomInt(0, 2) === 0;
        const gameState = withRegisteredCardSnapshot(contentSnapshot.cardDefs, () =>
          createGame(lockedPlayer.name, hostSnapshot, guestSnapshot, playerFirst, seed),
        );
        const rankedConfigSnapshot = mode === "ranked"
          ? { ...config.advanced.ranked, ...createRankedRoomCertification(playerDeck, opponentDeck) }
          : config.advanced.ranked;
        const [createdRoom] = await tx.insert(pvpRooms).values({ code, hostName: playerName, hostPlayerId: player.id, hostDeck: playerDeck.id, hostDeckSnapshot: hostSnapshot, guestName: opponent.playerName, guestPlayerId: opponent.playerId, guestDeck: opponent.deckId, guestDeckSnapshot: guestSnapshot, contentSnapshot, contentHash: contentSnapshot.contentHash, state: "playing", mode, seed, playerFirst, gameState, rankedConfigSnapshot, rankedSeasonId: rankedSeason?.id ?? null, actionLog: [], eventLog: [], expiresAt: new Date(Date.now() + PVP_PLAYING_TTL_MS), updatedAt: new Date() }).returning();
        await tx.insert(pvpSpectatorSnapshots).values({ roomId: createdRoom.id, roomVersion: createdRoom.version, gameState });
        return { opponent, code };
      }
      const existing = await tx.select().from(matchmakingQueue).where(and(eq(matchmakingQueue.playerId, lockedPlayer.id), eq(matchmakingQueue.mode, mode))).limit(1);
      if (existing.length) await tx.update(matchmakingQueue).set({ deckId: playerDeck.id, mmr: lockedPlayer.mmr, playerName: lockedPlayer.name, createdAt: new Date() }).where(eq(matchmakingQueue.id, existing[0].id));
      else await tx.insert(matchmakingQueue).values({ playerId: lockedPlayer.id, playerName: lockedPlayer.name, deckId: playerDeck.id, mmr: lockedPlayer.mmr, mode });
      return null;
    });

    if (matchResult && "error" in matchResult) return Response.json({ ok: false, error: matchResult.error }, { status: matchResult.status as number });
    if (matchResult && "activeRoom" in matchResult && matchResult.activeRoom) {
      const room = matchResult.activeRoom;
      const opponentName = room.hostPlayerId === player.id ? room.guestName : room.hostName;
      return Response.json({ ok: true, status: "matched", opponent: { name: opponentName || "Opponent", isHuman: true, roomCode: room.code }, playerDeck, mode, resumed: true });
    }
    if (matchResult && "status" in matchResult && matchResult.status === "retry") return Response.json({ ok: true, status: "queued", range, message: `Queued for ${mode}. Searching ±${range} MMR.` });
    if (matchResult) {
      return Response.json({ ok: true, status: "matched", opponent: { name: matchResult.opponent.playerName, mmr: matchResult.opponent.mmr, isHuman: true, roomCode: matchResult.code, deckId: matchResult.opponent.deckId }, playerDeck, mode });
    }

    if (mode === "casual" && config.aiEnabled && (allowAiFallback || waitSeconds >= policy.aiFallbackSeconds)) {
      await db.delete(matchmakingQueue).where(and(eq(matchmakingQueue.playerId, player.id), eq(matchmakingQueue.mode, mode)));
      const aiDeckIndex = Math.floor(player.mmr / 350) % DECKS.length;
      const aiPreset = DECKS[aiDeckIndex];
      const aiDeck: DeckInput = { id: aiPreset.id, name: aiPreset.name, cards: aiPreset.cards };
      const aiName = `AI ${aiPreset.name.replace(/[^A-Za-z0-9 ]/g, "").trim().slice(0, 18) || "Adversary"}`;
      return Response.json({
        ok: true,
        status: "ai_fallback",
        opponent: {
          name: aiName,
          mmr: Math.max(800, player.mmr - 50),
          isHuman: false,
          deck: aiDeck,
        },
        playerDeck,
        aiDeck,
        playerFirst: randomInt(0, 2) === 0,
        mode,
      });
    }

    return Response.json({
      ok: true,
      status: "queued",
      range,
      message: `Queued for ${mode}. Searching ±${range} MMR.`,
    });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const maintenanceBlocked = await runtimeGate("general");
  if (maintenanceBlocked) return maintenanceBlocked;
  try {
    const url = new URL(req.url);
    const identity = await requireStablePlayerIdentity(req);
    if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const [player] = await db.select().from(players).where(eq(players.id, identity.playerId!)).limit(1);
    if (!player) return Response.json({ ok: true });
    await db.delete(matchmakingQueue).where(eq(matchmakingQueue.playerId, player.id));
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[randomInt(chars.length)];
  return code;
}
