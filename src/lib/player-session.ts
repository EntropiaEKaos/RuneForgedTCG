import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { playerSessions, players } from "@/db/schema";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  createPlayerSessionToken,
  parsePlayerSessionToken,
  PLAYER_SESSION_MAX_AGE,
  verifyPlayerSessionToken,
} from "./player-session-token";

const COOKIE = "rf_player_session";
export function createPlayerSession(playerId: number, playerName: string): string {
  return createPlayerSessionToken(playerId, playerName);
}

export function verifyPlayerSession(value: string | null | undefined): { playerId: number; playerName: string } | null {
  return verifyPlayerSessionToken(value);
}

function cookieValue(req: Request | NextRequest): string | null {
  return req.headers.get("cookie")?.match(/(?:^|; )rf_player_session=([^;]+)/)?.[1] ?? null;
}

export async function getPlayerSession(req: Request | NextRequest) {
  const parsed = parsePlayerSessionToken(cookieValue(req));
  if (!parsed) return null;
  const [session] = await db.select({ playerId: playerSessions.playerId })
    .from(playerSessions)
    .where(and(eq(playerSessions.sessionId, parsed.sessionId), isNull(playerSessions.revokedAt), gt(playerSessions.expiresAt, new Date())))
    .limit(1);
  if (!session || session.playerId !== parsed.playerId) return null;
  const [player] = await db.select({ id: players.id, name: players.name }).from(players).where(eq(players.id, parsed.playerId)).limit(1);
  if (!player) return null;
  return { playerId: player.id, playerName: player.name };
}

export async function requireStablePlayerIdentity(req: Request | NextRequest): Promise<{ playerId: number; playerName: string } | null> {
  return getPlayerSession(req);
}

export async function requirePlayerIdentity(req: Request | NextRequest, requestedName?: string) {
  const session = await getPlayerSession(req);
  if (session) return session;
  const allowLegacy = process.env.NODE_ENV !== "production" && process.env.ALLOW_LEGACY_PLAYER_IDENTITY === "true";
  if (allowLegacy && requestedName?.trim()) return { playerId: null, playerName: requestedName.trim().slice(0, 40) };
  return null;
}

export async function setPlayerSession(playerId: number, playerName: string) {
  const token = createPlayerSession(playerId, playerName);
  const parsed = parsePlayerSessionToken(token);
  if (!parsed) throw new Error("Could not create player session");
  await db.insert(playerSessions).values({ sessionId: parsed.sessionId, playerId, expiresAt: new Date(parsed.exp * 1000) });
  const store = await cookies();
  store.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: PLAYER_SESSION_MAX_AGE });
}

export async function clearPlayerSession() {
  const store = await cookies();
  // The browser cookie is revoked server-side before deletion.
  const token = store.get(COOKIE)?.value;
  const parsed = parsePlayerSessionToken(token);
  if (parsed) await db.update(playerSessions).set({ revokedAt: new Date() }).where(eq(playerSessions.sessionId, parsed.sessionId));
  store.set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}
