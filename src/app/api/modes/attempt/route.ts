import { runtimeGate } from "@/lib/runtime-gates";
import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { db } from "@/db";
import { modeAttempts, players } from "@/db/schema";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { resolveDeck, snapshotDeck } from "@/game/deck-service";
import { and, eq, isNull, gt, lt } from "drizzle-orm";
import { getRuntimeDecks, getRuntimeModes } from "@/lib/control-plane";
import type { DeckInput } from "@/game/types";
import { ensureConfigLoaded } from "@/game/settings";
import { getRuntimeAiRules, getRuntimeEngineRules } from "@/game/runtime-config";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const runtimeBlocked = await runtimeGate("ai");
  if (runtimeBlocked) return runtimeBlocked;
  try {
    await ensureConfigLoaded();
    const engineRules = getRuntimeEngineRules();
    const aiRules = getRuntimeAiRules();
    const body = await req.json();
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });

    const modeType = String(body.modeType || "");
    const modeId = String(body.modeId || "");
    if (!(modeType === "puzzle" || modeType === "boss" || modeType === "brawl" || modeType === "expedition") || !modeId) {
      return Response.json({ ok: false, error: "Invalid mode" }, { status: 400 });
    }

    const runtime = await getRuntimeModes();
    const PUZZLES = runtime.puzzles, BOSSES = runtime.bosses, BRAWLS = runtime.brawls, ENCOUNTERS = runtime.encounters;
    const DECKS = await getRuntimeDecks();
    let playerDeck: DeckInput;
    let opponentDeck: DeckInput;
    let modeDefinition: Record<string, unknown> | null = null;
    let playerFirst = true;
    if (modeType === "puzzle") {
      const puzzle = PUZZLES.find((x) => x.id === modeId);
      if (!puzzle) return Response.json({ ok: false, error: "Mode not found" }, { status: 404 });
      modeDefinition = puzzle as unknown as Record<string, unknown>;
      playerDeck = { id: `puzzle_${puzzle.id}`, name: puzzle.name, cards: [...puzzle.playerHand, ...Array(20 - puzzle.playerHand.length).fill("ember_whelp")] };
      opponentDeck = { id: "puzzle_ai", name: puzzle.name, cards: [...puzzle.aiHand, ...Array(20 - puzzle.aiHand.length).fill("ember_whelp")] };
    } else if (modeType === "boss") {
      const boss = BOSSES.find((x) => x.id === modeId);
      if (!boss) return Response.json({ ok: false, error: "Mode not found" }, { status: 404 });
      modeDefinition = boss as unknown as Record<string, unknown>;
      const requestedDeck = String(body.deckId || "");
      if (!requestedDeck) return Response.json({ ok: false, error: "Player deck is required" }, { status: 400 });
      playerDeck = await resolveDeck(db, identity.playerId, requestedDeck);
      opponentDeck = { id: `boss_${boss.id}`, name: boss.name, cards: boss.aiDeck };
    } else if (modeType === "expedition") {
      const encounter = ENCOUNTERS.find((x) => x.id === modeId);
      if (!encounter) return Response.json({ ok: false, error: "Mode not found" }, { status: 404 });
      modeDefinition = encounter as unknown as Record<string, unknown>;
      const requestedDeck = String(body.deckId || "");
      if (!requestedDeck) return Response.json({ ok: false, error: "Player deck is required" }, { status: 400 });
      playerDeck = await resolveDeck(db, identity.playerId, requestedDeck);
      const preset = DECKS.find((deck) => deck.id === encounter.opponentDeckId);
      if (!preset) return Response.json({ ok: false, error: "Encounter opponent is unavailable" }, { status: 503 });
      opponentDeck = { id: preset.id, name: preset.name, cards: preset.cards };
      playerFirst = true;
    } else {
      const brawl = BRAWLS.find((x) => x.id === modeId);
      if (!brawl) return Response.json({ ok: false, error: "Mode not found" }, { status: 404 });
      modeDefinition = brawl as unknown as Record<string, unknown>;
      const requestedDeck = String(body.deckId || "");
      if (!requestedDeck) return Response.json({ ok: false, error: "Player deck is required" }, { status: 400 });
      playerDeck = await resolveDeck(db, identity.playerId, requestedDeck);
      const candidates = DECKS.filter((d) => d.id !== playerDeck.id);
      if (!candidates.length) return Response.json({ ok: false, error: "No server opponent decks configured" }, { status: 503 });
      const selected = candidates[crypto.randomInt(0, candidates.length)];
      opponentDeck = { id: selected.id, name: selected.name, cards: selected.cards };
      playerFirst = crypto.randomInt(0, 2) === 0;
    }

    const prepared = await db.transaction(async (tx) => {
      const [player] = await tx.select().from(players).where(eq(players.id, identity.playerId!)).limit(1).for("update");
      if (!player) return { error: "Player not found", status: 404 as const };
      const now = new Date();
      await tx.delete(modeAttempts).where(and(eq(modeAttempts.playerId, player.id), lt(modeAttempts.expiresAt, now)));
      const [existing] = await tx.select().from(modeAttempts).where(and(eq(modeAttempts.playerId, player.id), eq(modeAttempts.modeType, modeType), eq(modeAttempts.modeId, modeId), eq(modeAttempts.playerDeckId, playerDeck.id), isNull(modeAttempts.usedAt), gt(modeAttempts.expiresAt, now))).limit(1);
      if (existing?.engineRules && existing?.aiRules) {
        return { ok: true, token: existing.token, seed: existing.seed, playerFirst: existing.playerFirst, playerDeck: existing.playerDeckSnapshot, opponentDeck: existing.opponentDeckSnapshot, modeDefinition, engineRules: existing.engineRules, aiRules: existing.aiRules, expiresAt: existing.expiresAt.toISOString(), authoritative: true };
      }
      if (existing) await tx.delete(modeAttempts).where(eq(modeAttempts.id, existing.id));
      const seed = crypto.randomInt(1, 0x7fffffff);
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await tx.insert(modeAttempts).values({
        token, playerId: player.id, playerName: player.name, modeType, modeId, playerDeckId: playerDeck.id, seed, playerFirst,
        playerDeckSnapshot: snapshotDeck(playerDeck), opponentDeckSnapshot: snapshotDeck(opponentDeck), engineRules, aiRules, expiresAt,
      });
      return { ok: true, token, seed, playerFirst, playerDeck: snapshotDeck(playerDeck), opponentDeck: snapshotDeck(opponentDeck), modeDefinition, engineRules, aiRules, expiresAt: expiresAt.toISOString(), authoritative: true };
    });
    if ("error" in prepared) return Response.json({ ok: false, error: prepared.error }, { status: prepared.status });
    return Response.json(prepared);
  } catch (error) {
    console.error("[modes/attempt] failed", error);
    return Response.json({ ok: false, error: "Could not prepare authoritative mode attempt" }, { status: 500 });
  }
}
