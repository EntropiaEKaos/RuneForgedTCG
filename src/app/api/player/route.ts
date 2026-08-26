import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { players, playerCards, playerAchievements, playerDailies, matches, customDecks, sharedDecks, playerSessions } from "@/db/schema";
import { and, eq, gt, desc, sql } from "drizzle-orm";
import { ACHIEVEMENTS, DAILY_QUESTS, levelFromXp, xpForLevel } from "@/lib/achievements";
import { clearPlayerSession, getPlayerSession, preparePlayerSession, setPlayerSession, setPlayerSessionCookie } from "@/lib/player-session";
import { consumeRequestRateLimit } from "@/lib/rate-limit";
import { getRuntimeStarterWallet } from "@/lib/control-plane";
import { playerSelfDto } from "@/lib/player-public";
import { recoveryExpiresAt, recoveryHash } from "@/lib/account-recovery";

export const dynamic = "force-dynamic";
function safeDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, 40);
  if (!normalized || normalized.toLowerCase() === "challenger" || normalized.toLowerCase().startsWith("guest-")) return null;
  if (!/^[\p{L}\p{N} _.'-]{2,40}$/u.test(normalized)) return null;
  return normalized;
}

async function uniqueGuestName(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const candidate = `Guest-${randomBytes(3).toString("hex").toUpperCase()}`;
    const [existing] = await db.select({ id: players.id }).from(players).where(eq(players.name, candidate)).limit(1);
    if (!existing) return candidate;
  }
  throw new Error("Could not allocate guest identity");
}

async function profilePayload(player: typeof players.$inferSelect) {
  const [collection, achievements, dailies, shared, matchStats, deckCount] = await Promise.all([
    db.select().from(playerCards).where(eq(playerCards.playerId, player.id)),
    db.select().from(playerAchievements).where(eq(playerAchievements.playerId, player.id)),
    db.select().from(playerDailies).where(eq(playerDailies.playerId, player.id)),
    db.select().from(sharedDecks).where(eq(sharedDecks.playerId, player.id)).orderBy(desc(sharedDecks.createdAt)).limit(20),
    db.select({ total: sql<number>`count(*)::int`, wins: sql<number>`coalesce(sum(case when ${matches.won} then 1 else 0 end),0)::int` }).from(matches).where(eq(matches.playerId, player.id)),
    db.select({ n: sql<number>`count(*)::int` }).from(customDecks).where(eq(customDecks.ownerPlayerId, player.id)),
  ]);
  const now = new Date();
  const activeDailies = dailies.filter((d) => new Date(d.expiresAt) > now);
  const level = levelFromXp(player.xp);
  return {
    ok: true,
    player: {
      ...playerSelfDto(player),
      level,
      currentLevelXp: player.xp % xpForLevel(level),
      nextLevelXp: xpForLevel(level),
    },
    collection: collection.map((c) => ({ defId: c.defId, count: c.count, shiny: c.shiny })),
    achievements: achievements.map((a) => ({ ...a, def: ACHIEVEMENTS.find((x) => x.id === a.achievementId) })),
    dailies: activeDailies.map((d) => ({ ...d, def: DAILY_QUESTS.find((x) => x.id === d.questId) })),
    sharedDecks: shared,
    stats: {
      matches: matchStats[0]?.total ?? 0,
      wins: matchStats[0]?.wins ?? 0,
      customDecks: deckCount[0]?.n ?? 0,
      uniqueCards: collection.length,
    },
  };
}

/** Session-safe profile read. GET never creates accounts or cookies. */
export async function GET(req: NextRequest) {
  try {
    const session = await getPlayerSession(req);
    if (!session) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const [player] = await db.select().from(players).where(eq(players.id, session.playerId)).limit(1);
    if (!player) return Response.json({ ok: false, error: "Player not found" }, { status: 404 });
    return Response.json(await profilePayload(player));
  } catch (error) {
    console.error("[player] GET failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

/** Create a guest account or recover an existing one with its one-time-issued recovery code. */
export async function POST(req: NextRequest) {
  try {
    const rate = await consumeRequestRateLimit(req, "player-session", 20, 60_000);
    if (!rate.allowed) return Response.json({ ok: false, error: "Too many requests" }, { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const current = await getPlayerSession(req);
    if (current) {
      const [player] = await db.select().from(players).where(eq(players.id, current.playerId)).limit(1);
      if (!player) return Response.json({ ok: false, error: "Player not found" }, { status: 404 });
      if (body.rotateRecoveryCode === true) {
        const issuedRecoveryCode = randomBytes(24).toString("base64url");
        const [updated] = await db.update(players).set({ recoveryKeyHash: recoveryHash(issuedRecoveryCode), recoveryKeyExpiresAt: recoveryExpiresAt() }).where(eq(players.id, player.id)).returning();
        return Response.json({ ...(await profilePayload(updated)), recoveryCode: issuedRecoveryCode, recoveryRotated: true });
      }
      if (body.displayName !== undefined) {
        const displayName = safeDisplayName(body.displayName);
        if (!displayName) return Response.json({ ok: false, error: "Invalid display name" }, { status: 400 });
        if (displayName !== player.name) {
          const [existing] = await db.select({ id: players.id }).from(players).where(eq(players.name, displayName)).limit(1);
          if (existing && existing.id !== player.id) return Response.json({ ok: false, error: "Display name is already in use" }, { status: 409 });
          const [updated] = await db.update(players).set({ name: displayName }).where(eq(players.id, player.id)).returning();
          return Response.json({ ...(await profilePayload(updated)), renamed: true });
        }
      }
      return Response.json(await profilePayload(player));
    }

    const recoveryCode = typeof body.recoveryCode === "string" ? body.recoveryCode.trim() : "";
    if (recoveryCode) {
      if (recoveryCode.length < 24 || recoveryCode.length > 128) return Response.json({ ok: false, error: "Invalid recovery code" }, { status: 400 });
      const oldHash = recoveryHash(recoveryCode);
      const issuedRecoveryCode = randomBytes(24).toString("base64url");
      const rotated = await db.transaction(async (tx) => {
        const [candidate] = await tx.select().from(players).where(and(
          eq(players.recoveryKeyHash, oldHash),
          gt(players.recoveryKeyExpiresAt, new Date()),
        )).limit(1).for("update");
        if (!candidate) return null;

        const prepared = preparePlayerSession(candidate.id, candidate.name);
        const [updated] = await tx.update(players).set({
          recoveryKeyHash: recoveryHash(issuedRecoveryCode),
          recoveryKeyExpiresAt: recoveryExpiresAt(),
        }).where(and(eq(players.id, candidate.id), eq(players.recoveryKeyHash, oldHash))).returning();
        if (!updated) return null;

        // Recovery is a single DB security transition: rotate the credential,
        // revoke every prior browser session and persist the replacement session
        // before any of those changes become visible to another request.
        await tx.update(playerSessions).set({ revokedAt: new Date() }).where(eq(playerSessions.playerId, updated.id));
        await tx.insert(playerSessions).values({ sessionId: prepared.sessionId, playerId: prepared.playerId, expiresAt: prepared.expiresAt });
        return { player: updated, token: prepared.token };
      });
      if (!rotated) return Response.json({ ok: false, error: "Recovery code not recognized or expired" }, { status: 401 });
      await setPlayerSessionCookie(rotated.token);
      return Response.json({ ...(await profilePayload(rotated.player)), recovered: true, recoveryCode: issuedRecoveryCode, recoveryRotated: true });
    }

    const requestedName = safeDisplayName(body.displayName);
    const name = requestedName ?? await uniqueGuestName();
    if (requestedName) {
      const [existing] = await db.select({ id: players.id }).from(players).where(eq(players.name, requestedName)).limit(1);
      if (existing) return Response.json({ ok: false, error: "Display name is already in use" }, { status: 409 });
    }

    const issuedRecoveryCode = randomBytes(24).toString("base64url");
    const wallet = await getRuntimeStarterWallet();
    const [player] = await db.insert(players).values({
      name, recoveryKeyHash: recoveryHash(issuedRecoveryCode), recoveryKeyExpiresAt: recoveryExpiresAt(), gold: wallet.gold, dust: wallet.dust, xp: wallet.xp, level: levelFromXp(wallet.xp),
    }).returning();
    await setPlayerSession(player.id, player.name);
    return Response.json({ ...(await profilePayload(player)), created: true, recoveryCode: issuedRecoveryCode }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") return Response.json({ ok: false, error: "Display name is already in use" }, { status: 409 });
    console.error("[player] POST failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearPlayerSession();
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[player] DELETE failed", error);
    return Response.json({ ok: false, error: "Could not clear player session" }, { status: 500 });
  }
}
