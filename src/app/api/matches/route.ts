import { runtimeGate } from "@/lib/runtime-gates";
import { createHash } from "node:crypto";
import { consumeRateLimit, consumeRequestRateLimit } from "@/lib/rate-limit";
/**
 * POST /api/matches — authoritative match settlement.
 *
 * The client submits only a signed match token + GameAction[].
 * Winner, rounds and nexus health are calculated by the same engine/reducer
 * used by the game client. Client-supplied outcome fields are ignored.
 */
import { db } from "@/db";
import { matches, matchTokens, replays } from "@/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { snapshotDeck, snapshotReplayBundle } from "@/game/deck-service";
import { replayAuthoritativeMatch } from "@/game/authoritative";
import type { GameAction } from "@/game/reducer";
import type { DeckInput } from "@/game/types";
import { actionLogHash, replayIntegrity, stateHash } from "@/lib/match-integrity";
import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";
import { CONTENT_VERSION } from "@/game/content-version";
import type { AiDifficulty } from "@/game/types";
import { ensureConfigLoaded } from "@/game/settings";

export const dynamic = "force-dynamic";
const MAX_ACTIONS = 2000;

function parseActions(value: unknown): GameAction[] | null {
  if (!Array.isArray(value) || value.length > MAX_ACTIONS) return null;
  const allowed = new Set(["play", "cast", "attack", "block", "pass", "react", "resolve", "sentinela", "mulligan", "skipMulligan"]);
  for (const item of value) {
    if (!item || typeof item !== "object" || !allowed.has(String((item as { type?: unknown }).type))) return null;
  }
  return value as GameAction[];
}


export async function POST(req: Request) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  const requestRate = await consumeRequestRateLimit(req, "match-settlement", 12, 60_000);
  if (!requestRate.allowed) return Response.json({ ok: false, error: "Too many match settlement attempts" }, { status: 429, headers: { "retry-after": String(requestRate.retryAfterSeconds) } });
  try {
    await ensureConfigLoaded();
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 2_000_000) return Response.json({ ok: false, error: "Payload too large" }, { status: 413 });
    const body = await req.json();
    const identity = await requireStablePlayerIdentity(req);
    if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });

    const token = String(body.matchToken ?? "").trim();
    const actions = parseActions(body.actions);
    if (!token || !actions) return Response.json({ ok: false, error: "A valid authoritative action log is required" }, { status: 400 });
    const [playerRate, tokenRate] = await Promise.all([
      consumeRateLimit(`match-settlement-player:${identity.playerId}`, 8, 60_000),
      consumeRateLimit(`match-settlement-token:${createHash("sha256").update(token).digest("hex")}`, 3, 10 * 60_000),
    ]);
    if (!playerRate.allowed || !tokenRate.allowed) return Response.json({ ok: false, error: "Match settlement retry limit exceeded" }, { status: 429, headers: { "retry-after": String(Math.max(playerRate.retryAfterSeconds, tokenRate.retryAfterSeconds)) } });

    const result = await db.transaction(async (tx) => {
      const [row] = await tx.select().from(matchTokens)
        .where(and(eq(matchTokens.token, token), isNull(matchTokens.usedAt))).limit(1).for("update");
      if (!row) return { error: "Token de partida inválido ou já utilizado.", status: 403 as const };
      if (identity.playerId == null || row.playerId !== identity.playerId) return { error: "Token não pertence ao jogador atual.", status: 403 as const };
      if (!row.seed || row.playerFirst === null || !row.aiDeckId || !row.engineRules || !row.aiRules) return { error: "Token não suporta partidas autoritativas.", status: 409 as const };
      if (new Date(row.expiresAt) < new Date()) return { error: "Token de partida expirado.", status: 403 as const };

      let playerDeck: DeckInput | null = null;
      let aiDeck: DeckInput | null = null;
      try {
        playerDeck = snapshotDeck(row.deckSnapshot as DeckInput);
        aiDeck = snapshotDeck(row.opponentSnapshot as DeckInput);
        if (!playerDeck?.id || !aiDeck?.id) throw new Error("Missing match deck snapshots");
      } catch {
        return { error: "Match token does not contain valid deck snapshots.", status: 409 as const };
      }
      const replay = replayAuthoritativeMatch({
        playerName: row.playerName,
        playerDeck,
        aiDeck,
        playerGoesFirst: Boolean(row.playerFirst),
        seed: row.seed,
        actions,
        customOptions: { aiDifficulty: row.aiDifficulty as AiDifficulty, rules: row.engineRules as import("@/game/types").EngineRulesSnapshot, aiRules: row.aiRules as import("@/game/types").AiRulesSnapshot },
      });
      if (replay.state.phase !== "gameover" || !replay.state.winner) {
        return { error: "Replay incompleto: a partida não chegou a um estado final.", status: 422 as const };
      }

      const consumed = await tx.update(matchTokens).set({ usedAt: new Date() })
        .where(and(eq(matchTokens.id, row.id), isNull(matchTokens.usedAt))).returning({ id: matchTokens.id });
      if (!consumed.length) return { error: "Token de partida já utilizado.", status: 409 as const };

      const won = replay.state.winner === "player";
      const actionHash = actionLogHash(actions);
      const finalStateHash = stateHash(replay.state);
      const integrityHash = replayIntegrity(actions, replay.state);
      const nexusRemaining = replay.state.players.player.nexusHealth;
      const [match] = await tx.insert(matches).values({
        playerName: row.playerName,
        playerId: row.playerId,
        deckId: row.deckId,
        deckName: row.deckName,
        won,
        rounds: replay.state.round,
        nexusRemaining,
        matchToken: token,
        matchMode: row.mode,
        seed: row.seed,
        playerFirst: row.playerFirst,
        aiDeckId: row.aiDeckId,
        aiDeckName: row.aiDeckName,
        aiDifficulty: row.aiDifficulty,
        actionLog: actions,
        eventLog: replay.events,
        actionHash,
        stateHash: finalStateHash,
        integrityHash,
        deckSnapshot: snapshotReplayBundle(playerDeck, aiDeck),
        contentHash: snapshotReplayBundle(playerDeck, aiDeck).contentHash,
        engineRules: replay.state.rules,
        aiRules: replay.state.aiRules,
      }).returning();
      await tx.insert(replays).values({
        playerName: row.playerName,
        playerId: row.playerId,
        deckName: row.deckName,
        deckId: row.deckId,
        aiDeckName: row.aiDeckName ?? aiDeck.name,
        aiDeckId: row.aiDeckId,
        aiDifficulty: row.aiDifficulty,
        won,
        rounds: replay.state.round,
        playerFirst: Boolean(row.playerFirst),
        seed: row.seed,
        log: JSON.stringify(replay.state.log),
        actionLog: actions,
        eventLog: replay.events,
        actionHash,
        stateHash: finalStateHash,
        integrityHash,
        deckSnapshot: snapshotReplayBundle(playerDeck, aiDeck),
        contentHash: snapshotReplayBundle(playerDeck, aiDeck).contentHash,
        engineVersion: ENGINE_VERSION,
        rulesetVersion: RULESET_VERSION,
        contentVersion: CONTENT_VERSION,
        engineRules: replay.state.rules,
        aiRules: replay.state.aiRules,
        matchOptionsSnapshot: { aiDifficulty: row.aiDifficulty },
      });
      return { match, winner: replay.state.winner, appliedActions: replay.applied };
    });

    if ("error" in result) return Response.json({ ok: false, error: result.error }, { status: result.status });
    return Response.json({ ok: true, match: result.match, authoritative: true, winner: result.winner, appliedActions: result.appliedActions });
  } catch (error) {
    console.error("[matches] authoritative settlement failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const recent = await db.select({
      id: matches.id, playerName: matches.playerName,
      deckName: matches.deckName, won: matches.won, rounds: matches.rounds,
      nexusRemaining: matches.nexusRemaining, matchMode: matches.matchMode, createdAt: matches.createdAt,
    }).from(matches).orderBy(desc(matches.createdAt)).limit(20);
    const [totals] = await db.select({ total: sql<number>`count(*)::int`, wins: sql<number>`coalesce(sum(case when ${matches.won} then 1 else 0 end),0)::int` }).from(matches);
    const leaderboard = await db.select({
      playerName: matches.playerName,
      games: sql<number>`count(*)::int`,
      wins: sql<number>`coalesce(sum(case when ${matches.won} then 1 else 0 end),0)::int`,
    }).from(matches).groupBy(matches.playerName).orderBy(sql`sum(case when ${matches.won} then 1 else 0 end) desc`).limit(10);
    return Response.json({ ok: true, recent, totals: totals ?? { total: 0, wins: 0 }, leaderboard });
  } catch (error) {
    console.error("[matches] GET failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
