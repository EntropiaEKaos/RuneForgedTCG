import { runtimeGate } from "@/lib/runtime-gates";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { modeAttempts, modeRewards, players, playerPacks, replays } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getRuntimeModes } from "@/lib/control-plane";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { recordEconomyTransaction } from "@/lib/economy-ledger";
import { replayAuthoritativeMatch } from "@/game/authoritative";
import { resolveDeck, snapshotDeck, snapshotReplayBundle } from "@/game/deck-service";
import { levelFromXp } from "@/lib/achievements";
import type { DeckInput } from "@/game/types";
import type { GameAction } from "@/game/reducer";
import { actionLogHash, replayIntegrity, stateHash } from "@/lib/match-integrity";
import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";
import { CONTENT_VERSION } from "@/game/content-version";
import { ensureConfigLoaded } from "@/game/settings";

export const dynamic = "force-dynamic";
const MAX_ACTIONS = 2000;

export async function GET() {
  return Response.json({ ok: true, ...(await getRuntimeModes()) });
}

function parseActions(value: unknown): GameAction[] | null {
  if (!Array.isArray(value) || value.length > MAX_ACTIONS) return null;
  const allowed = new Set(["play", "cast", "attack", "block", "pass", "react", "resolve", "sentinela", "mulligan", "skipMulligan"]);
  for (const item of value) {
    if (!item || typeof item !== "object" || !allowed.has(String((item as { type?: unknown }).type))) return null;
  }
  return value as GameAction[];
}

export async function POST(req: NextRequest) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  try {
    await ensureConfigLoaded();
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 2_000_000) return Response.json({ ok: false, error: "Payload too large" }, { status: 413 });
    const body = await req.json();
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const modeType = String(body.modeType || "") as "puzzle" | "boss" | "brawl" | "expedition";
    const modeId = String(body.modeId || "");
    const attemptToken = String(body.attemptToken || "").trim();
    const actions = parseActions(body.actions);
    if (!["puzzle", "boss", "brawl", "expedition"].includes(modeType) || !modeId || !attemptToken || !actions) {
      return Response.json({ ok: false, error: "A valid authoritative mode attempt is required" }, { status: 400 });
    }

    const runtime = await getRuntimeModes();
    const PUZZLES = runtime.puzzles, BOSSES = runtime.bosses, BRAWLS = runtime.brawls, ENCOUNTERS = runtime.encounters;
    const result = await db.transaction(async (tx) => {
      const [player] = await tx.select().from(players).where(eq(players.id, identity.playerId!)).limit(1).for("update");
      if (!player) return { error: "Player not found", status: 404 as const };
      const existing = await tx.select({ id: modeRewards.id }).from(modeRewards).where(and(eq(modeRewards.playerId, player.id), eq(modeRewards.modeType, modeType), eq(modeRewards.modeId, modeId))).limit(1);
      if (existing.length) return { already: true };

      const [attempt] = await tx.select().from(modeAttempts).where(and(eq(modeAttempts.token, attemptToken), eq(modeAttempts.playerId, player.id), eq(modeAttempts.modeType, modeType), eq(modeAttempts.modeId, modeId))).limit(1).for("update");
      if (!attempt || attempt.usedAt) return { error: "Mode attempt is invalid or already used", status: 403 as const };
      if (new Date(attempt.expiresAt) < new Date()) return { error: "Mode attempt expired", status: 403 as const };
      if (!attempt.engineRules || !attempt.aiRules) return { error: "Mode attempt predates immutable rules snapshots; start a new attempt", status: 409 as const };

      let playerDeck: DeckInput;
      let aiDeck: DeckInput;
      try {
        playerDeck = snapshotDeck(attempt.playerDeckSnapshot as DeckInput);
        aiDeck = snapshotDeck(attempt.opponentDeckSnapshot as DeckInput);
        if (!playerDeck.id || !aiDeck.id) throw new Error("Invalid authoritative mode snapshots");
      } catch {
        return { error: "Mode attempt contains invalid authoritative deck snapshots", status: 409 as const };
      }
      const playerFirst = attempt.playerFirst;
      const seed = attempt.seed;
      let customOptions: Parameters<typeof replayAuthoritativeMatch>[0]["customOptions"] = {};
      let reward: { gold: number; dust: number; xp: number; pack?: string } | null = null;
      let aiName = aiDeck.name;
      if (modeType === "puzzle") {
        const puzzle = PUZZLES.find((p) => p.id === modeId);
        if (!puzzle) return { error: "Mode not found", status: 404 as const };
        customOptions = { aiName: "Puzzle", playerNexus: puzzle.playerNexus, aiNexus: puzzle.aiNexus, playerStartingMana: puzzle.playerMana, aiStartingMana: Math.max(1, Math.min(10, puzzle.playerMana - 1)), playerStartingHand: puzzle.playerHand.length, aiStartingHand: puzzle.aiHand.length, playerBench: puzzle.playerBench, aiBench: puzzle.aiBench, playerGoesFirst: true, skipMulligan: true, logPrefix: "🧩 Puzzle — " };
        reward = puzzle.reward;
        aiName = puzzle.name;
      } else if (modeType === "boss") {
        const boss = BOSSES.find((b) => b.id === modeId);
        if (!boss) return { error: "Mode not found", status: 404 as const };
        customOptions = { aiName: boss.name, playerNexus: boss.playerNexusStart, aiNexus: boss.aiNexusStart, aiBench: boss.aiStartingBench, playerGoesFirst: true, skipMulligan: true, logPrefix: `👹 ${boss.emoji} Boss — ` };
        reward = boss.reward;
        aiName = boss.name;
      } else if (modeType === "expedition") {
        const encounter = ENCOUNTERS.find((item) => item.id === modeId);
        if (!encounter) return { error: "Mode not found", status: 404 as const };
        customOptions = {
          aiName: encounter.name,
          playerNexus: encounter.playerNexus,
          aiNexus: encounter.aiNexus,
          playerStartingMana: encounter.playerMana ?? 1,
          aiStartingMana: encounter.aiMana ?? 1,
          playerStartingHand: encounter.playerHand,
          aiStartingHand: encounter.aiHand,
          aiBench: encounter.aiBench,
          playerGoesFirst: true,
          skipMulligan: true,
          aiDifficulty: "overlord",
          logPrefix: `🧭 ${encounter.chapter} — `,
        };
        reward = encounter.reward;
        aiName = encounter.name;
      } else {
        const brawl = BRAWLS.find((b) => b.id === modeId);
        if (!brawl) return { error: "Mode not found", status: 404 as const };
        const rules = brawl.rules;
        customOptions = { aiName: "Brawl AI", playerNexus: rules.startingNexus, aiNexus: rules.startingNexus, playerStartingMana: rules.startingMana ?? 1, aiStartingMana: rules.startingMana ?? 1, playerStartingHand: rules.startingHand, aiStartingHand: rules.startingHand, playerGoesFirst: playerFirst, logPrefix: `⚡ ${brawl.name} — ` };
        reward = { gold: 60, dust: 30, xp: 50 };
        aiName = brawl.name;
      }
      customOptions = { ...customOptions, rules: attempt.engineRules as import("@/game/types").EngineRulesSnapshot, aiRules: attempt.aiRules as import("@/game/types").AiRulesSnapshot };
      const replay = replayAuthoritativeMatch({ playerName: player.name, playerDeck: snapshotDeck(playerDeck), aiDeck: snapshotDeck(aiDeck), playerGoesFirst: modeType === "brawl" ? playerFirst : true, seed, actions, customOptions });
      if (replay.state.phase !== "gameover" || replay.state.winner !== "player") return { error: "Mode completion could not be verified by the authoritative engine", status: 422 as const };
      if (!reward) return { error: "Mode reward is unavailable", status: 409 as const };

      const consumedAttempt = await tx.update(modeAttempts).set({ usedAt: new Date() }).where(and(eq(modeAttempts.id, attempt.id), isNull(modeAttempts.usedAt))).returning({ id: modeAttempts.id });
      if (!consumedAttempt.length) return { error: "Mode attempt already consumed", status: 409 as const };
      await tx.insert(modeRewards).values({ playerId: player.id, modeType, modeId });
      const newXp = player.xp + reward.xp;
      const newLevel = levelFromXp(newXp);
      await tx.update(players).set({ gold: sql`${players.gold} + ${reward.gold}`, dust: sql`${players.dust} + ${reward.dust}`, xp: sql`${players.xp} + ${reward.xp}`, level: newLevel }).where(eq(players.id, player.id));
      if (reward.gold) await recordEconomyTransaction(tx, { playerId: player.id, currency: "gold", amount: reward.gold, balanceAfter: player.gold + reward.gold, reason: "mode_reward", referenceType: modeType, referenceId: modeId });
      if (reward.dust) await recordEconomyTransaction(tx, { playerId: player.id, currency: "dust", amount: reward.dust, balanceAfter: player.dust + reward.dust, reason: "mode_reward", referenceType: modeType, referenceId: modeId });
      if (reward.xp) await recordEconomyTransaction(tx, { playerId: player.id, currency: "xp", amount: reward.xp, balanceAfter: player.xp + reward.xp, reason: "mode_reward", referenceType: modeType, referenceId: modeId });
      if (reward.pack) await tx.insert(playerPacks).values({ playerId: player.id, packType: reward.pack, count: 1 }).onConflictDoUpdate({ target: [playerPacks.playerId, playerPacks.packType], set: { count: sql`${playerPacks.count} + 1` } });
      await tx.insert(replays).values({ playerName: player.name, playerId: player.id, deckName: playerDeck.name, deckId: playerDeck.id, aiDeckName: aiName, aiDeckId: aiDeck.id, aiDifficulty: modeType === "expedition" ? "overlord" : "tactician", won: true, rounds: replay.state.round, playerFirst: modeType === "brawl" ? playerFirst : true, seed, log: JSON.stringify(replay.state.log), actionLog: actions, eventLog: replay.events, actionHash: actionLogHash(actions), stateHash: stateHash(replay.state), integrityHash: replayIntegrity(actions, replay.state), deckSnapshot: snapshotReplayBundle(playerDeck, aiDeck), contentHash: snapshotReplayBundle(playerDeck, aiDeck).contentHash, engineVersion: ENGINE_VERSION, rulesetVersion: RULESET_VERSION, contentVersion: CONTENT_VERSION, matchMode: `mode-${modeType}`, opponentPlayerId: null, perspective: "player", engineRules: replay.state.rules, aiRules: replay.state.aiRules, matchOptionsSnapshot: customOptions });
      return { already: false, reward, newGold: player.gold + reward.gold, newDust: player.dust + reward.dust, newXp, rounds: replay.state.round };
    });

    if ("error" in result) return Response.json({ ok: false, error: result.error }, { status: result.status });
    if (result.already) return Response.json({ ok: false, error: "Reward already claimed" }, { status: 409 });
    return Response.json({ ok: true, authoritative: true, reward: result.reward, newGold: result.newGold, newDust: result.newDust, newXp: result.newXp, rounds: result.rounds });
  } catch (error) {
    console.error("[modes] authoritative settlement failed", error);
    return Response.json({ ok: false, error: "Mode completion verification failed" }, { status: 500 });
  }
}
