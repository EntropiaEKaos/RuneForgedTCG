import { db } from "@/db";
import { adminSessions, apiRateLimits, draftSessions, economyActionReceipts, paymentOrders, playerSessions, pvpRooms, replays } from "@/db/schema";
import { ensureConfigLoaded } from "@/game/settings";
import { and, eq, isNotNull, lt, or } from "drizzle-orm";

export const PVP_WAITING_TTL_MS = 30 * 60_000;
export const PVP_PLAYING_TTL_MS = 6 * 60 * 60_000;
export const PVP_FINISHED_TTL_MS = 24 * 60 * 60_000;
export const DRAFT_TTL_MS = 24 * 60 * 60_000;
export const REVOKED_SESSION_RETENTION_MS = 7 * 24 * 60 * 60_000;
export const STALE_CHECKOUT_MS = 10 * 60_000;
export const ECONOMY_RECEIPT_RETENTION_MS = 30 * 24 * 60 * 60_000;
export const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60_000;

export async function cleanupExpiredRuntimeSessions(now = new Date()): Promise<{ pvpExpired: number; pvpDeleted: number; drafts: number }> {
  // Keep this hot-path cleanup limited to ephemeral gameplay rows. Replay retention
  // is intentionally separated so matchmaking/PvP requests do not scan/delete
  // historical replay data on every request.
  const retiredPlaying = await db.update(pvpRooms).set({
    state: "expired",
    settledAt: now,
    expiresAt: new Date(now.getTime() + PVP_FINISHED_TTL_MS),
    updatedAt: now,
  }).where(and(eq(pvpRooms.state, "playing"), lt(pvpRooms.expiresAt, now))).returning({ id: pvpRooms.id });

  const stalePvp = await db.delete(pvpRooms).where(and(
    lt(pvpRooms.expiresAt, now),
    or(eq(pvpRooms.state, "waiting"), eq(pvpRooms.state, "finished"), eq(pvpRooms.state, "expired")),
  )).returning({ id: pvpRooms.id });
  const staleDrafts = await db.delete(draftSessions).where(lt(draftSessions.expiresAt, now)).returning({ id: draftSessions.id });
  return { pvpExpired: retiredPlaying.length, pvpDeleted: stalePvp.length, drafts: staleDrafts.length };
}


export async function cleanupExpiredAuthSessions(now = new Date()): Promise<{ playerSessions: number; adminSessions: number }> {
  const revokedCutoff = new Date(now.getTime() - REVOKED_SESSION_RETENTION_MS);
  const stalePlayers = await db.delete(playerSessions).where(or(
    lt(playerSessions.expiresAt, now),
    and(isNotNull(playerSessions.revokedAt), lt(playerSessions.revokedAt, revokedCutoff)),
  )).returning({ id: playerSessions.id });
  const staleAdmins = await db.delete(adminSessions).where(or(
    lt(adminSessions.expiresAt, now),
    and(isNotNull(adminSessions.revokedAt), lt(adminSessions.revokedAt, revokedCutoff)),
  )).returning({ id: adminSessions.id });
  return { playerSessions: stalePlayers.length, adminSessions: staleAdmins.length };
}

export async function cleanupStaleCheckoutAttempts(now = new Date()): Promise<{ staleCheckouts: number }> {
  const cutoff = new Date(now.getTime() - STALE_CHECKOUT_MS);
  const stale = await db.update(paymentOrders).set({
    status: "preference_failed",
    providerPayload: { errorCode: "STALE_CREATING_CLEANUP" },
    updatedAt: now,
  }).where(and(eq(paymentOrders.status, "creating"), lt(paymentOrders.updatedAt, cutoff))).returning({ id: paymentOrders.id });
  return { staleCheckouts: stale.length };
}

export async function cleanupExpiredEconomyReceipts(now = new Date()): Promise<{ economyReceipts: number }> {
  const cutoff = new Date(now.getTime() - ECONOMY_RECEIPT_RETENTION_MS);
  const stale = await db.delete(economyActionReceipts).where(lt(economyActionReceipts.createdAt, cutoff)).returning({ id: economyActionReceipts.id });
  return { economyReceipts: stale.length };
}


export async function cleanupExpiredRateLimits(now = new Date()): Promise<{ rateLimits: number }> {
  const cutoff = new Date(now.getTime() - RATE_LIMIT_RETENTION_MS);
  const stale = await db.delete(apiRateLimits).where(lt(apiRateLimits.windowStart, cutoff)).returning({ key: apiRateLimits.key });
  return { rateLimits: stale.length };
}

export async function cleanupExpiredReplays(now = new Date()): Promise<{ replays: number }> {
  const config = await ensureConfigLoaded();
  const replayCutoff = new Date(now.getTime() - config.advanced.moderation.replayRetentionDays * 86_400_000);
  const staleReplays = await db.delete(replays).where(lt(replays.createdAt, replayCutoff)).returning({ id: replays.id });
  return { replays: staleReplays.length };
}

export async function cleanupExpiredRuntimeData(now = new Date()) {
  const [runtime, replay, auth, checkout, economy, rateLimits] = await Promise.all([
    cleanupExpiredRuntimeSessions(now),
    cleanupExpiredReplays(now),
    cleanupExpiredAuthSessions(now),
    cleanupStaleCheckoutAttempts(now),
    cleanupExpiredEconomyReceipts(now),
    cleanupExpiredRateLimits(now),
  ]);
  return { ...runtime, ...replay, ...auth, ...checkout, ...economy, ...rateLimits };
}
