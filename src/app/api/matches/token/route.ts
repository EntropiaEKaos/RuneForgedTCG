import { runtimeGate } from "@/lib/runtime-gates";
import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { db } from "@/db";
import { matchTokens, players } from "@/db/schema";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { resolveDeck, snapshotDeck, listPresetDecks } from "@/game/deck-service";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import type { AiDifficulty } from "@/game/types";
import { aiPersonaForDeck } from "@/game/ai-personality";
import { loadGameConfig } from "@/game/settings";
import { getRuntimeAiRules, getRuntimeEngineRules } from "@/game/runtime-config";

export const dynamic = "force-dynamic";

/** The server owns seed, opponent and initiative. The client may only choose its own deck. */
export async function POST(req: NextRequest) {
  const runtimeBlocked = await runtimeGate("ai");
  if (runtimeBlocked) return runtimeBlocked;
  try {
    const body = await req.json();
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Authenticated player session required" }, { status: 401 });

    const mode = body.mode === "ranked" ? "ranked" : "casual";
    if (mode === "ranked") return Response.json({ ok: false, error: "Ranked matches are human-vs-human and must be created by matchmaking." }, { status: 409 });
    const deckId = String(body.deckId ?? "").slice(0, 80);
    const config = await loadGameConfig();
    const engineRules = getRuntimeEngineRules();
    const aiRules = getRuntimeAiRules();
    const difficulty: AiDifficulty = body.difficulty === "apprentice" || body.difficulty === "overlord" || body.difficulty === "tactician" ? body.difficulty : config.advanced.ai.defaultDifficulty;
    if (!deckId) return Response.json({ ok: false, error: "Player deck is required" }, { status: 400 });
    const playerDeck = await resolveDeck(db, identity.playerId, deckId);
    const presets = await listPresetDecks();
    if (!presets.length) return Response.json({ ok: false, error: "No server opponent decks configured" }, { status: 503 });

    const seed = crypto.randomInt(1, 0x7fffffff);
    const opponent = presets[crypto.randomInt(0, presets.length)];
    const playerFirst = crypto.randomInt(0, 2) === 0;
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const playerSnapshot = snapshotDeck(playerDeck);
    const opponentSnapshot = snapshotDeck({ id: opponent.id, name: opponent.name, cards: opponent.cards });

    const prepared = await db.transaction(async (tx) => {
      const [player] = await tx.select().from(players).where(eq(players.id, identity.playerId!)).limit(1).for("update");
      if (!player) return { error: "Player not found", status: 404 as const };
      const now = new Date();
      await tx.delete(matchTokens).where(and(eq(matchTokens.playerId, player.id), eq(matchTokens.mode, mode), eq(matchTokens.deckId, playerSnapshot.id), eq(matchTokens.aiDifficulty, difficulty), isNull(matchTokens.usedAt), lt(matchTokens.expiresAt, now)));
      const [existing] = await tx.select().from(matchTokens).where(and(eq(matchTokens.playerId, player.id), eq(matchTokens.mode, mode), eq(matchTokens.deckId, playerSnapshot.id), eq(matchTokens.aiDifficulty, difficulty), isNull(matchTokens.usedAt), gt(matchTokens.expiresAt, now))).limit(1);
      if (existing?.engineRules && existing?.aiRules) return { token: existing.token, mode: existing.mode, seed: existing.seed, playerFirst: existing.playerFirst, aiDeckId: existing.aiDeckId, aiDeckName: existing.aiDeckName, opponentDeck: existing.opponentSnapshot, difficulty: existing.aiDifficulty, persona: aiPersonaForDeck(existing.aiDeckId || ""), expiresAt: existing.expiresAt.toISOString(), engineRules: existing.engineRules, aiRules: existing.aiRules, authoritative: { seed: true, opponent: true, initiative: true, difficulty: true, rules: true } };
      if (existing) await tx.delete(matchTokens).where(eq(matchTokens.id, existing.id));
      await tx.insert(matchTokens).values({ token, mode, playerName: player.name, playerId: player.id, deckId: playerSnapshot.id, deckName: playerSnapshot.name, aiDeckId: opponentSnapshot.id, aiDeckName: opponentSnapshot.name, aiDifficulty: difficulty, seed, playerFirst, expiresAt, deckSnapshot: playerSnapshot, opponentSnapshot, engineRules, aiRules });
      return { token, mode, seed, playerFirst, aiDeckId: opponentSnapshot.id, aiDeckName: opponentSnapshot.name, opponentDeck: opponentSnapshot, difficulty, persona: aiPersonaForDeck(opponentSnapshot.id), expiresAt: expiresAt.toISOString(), engineRules, aiRules, authoritative: { seed: true, opponent: true, initiative: true, difficulty: true, rules: true } };
    });
    if ("error" in prepared) return Response.json({ ok: false, error: prepared.error }, { status: prepared.status });
    return Response.json({
      ok: true,
      ...prepared,
    });
  } catch (error) {
    console.error("[matches/token] failed", error);
    return Response.json({ ok: false, error: "Could not create match token" }, { status: 500 });
  }
}
