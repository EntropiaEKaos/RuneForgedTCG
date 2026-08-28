import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { adminSessions, adminUsers } from "@/db/schema";
import {
  decryptMfaSecret,
  encryptMfaSecret,
  hashAdminPassword,
  verifyAdminPassword,
  verifyTotp,
} from "./admin-credentials";
import { requestOriginAllowed } from "./request-security";

const COOKIE = "rf_admin_session";
const MAX_AGE = 60 * 60 * 8;

export type AdminRole = "admin" | "designer" | "qa" | "liveops" | "publisher";
const roles = new Set<AdminRole>(["admin", "designer", "qa", "liveops", "publisher"]);

function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET?.trim() || "";
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface AdminSessionContext {
  actorId: string;
  username: string;
  role: AdminRole;
  exp: number;
  sessionId: number;
  userId: number;
}

export async function ensureBootstrapAdmin() {
  const existing = await db.select({ id: adminUsers.id }).from(adminUsers).limit(1);
  if (existing.length) return;

  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) return;

  const { salt, hash } = hashAdminPassword(password);
  const rawRole = process.env.ADMIN_ROLE?.trim() as AdminRole;
  const role = roles.has(rawRole) ? rawRole : "admin";
  await db.insert(adminUsers).values({
    username: (process.env.ADMIN_USERNAME || "admin").trim().slice(0, 80),
    passwordSalt: salt,
    passwordHash: hash,
    role,
    enabled: true,
  }).onConflictDoNothing({ target: adminUsers.username });
}

export async function authenticateAdminUser(username: string, password: string, totp?: string) {
  await ensureBootstrapAdmin();
  const [user] = await db.select().from(adminUsers).where(and(
    eq(adminUsers.username, username),
    eq(adminUsers.enabled, true),
  )).limit(1);

  if (!user || !verifyAdminPassword(password, user.passwordSalt, user.passwordHash)) return null;

  if (user.mfaSecret) {
    const clear = decryptMfaSecret(user.mfaSecret);
    if (!verifyTotp(clear, totp || "")) return null;
    if (!user.mfaSecret.startsWith("enc:v1:")) {
      await db.update(adminUsers).set({
        mfaSecret: encryptMfaSecret(clear),
        updatedAt: new Date(),
      }).where(eq(adminUsers.id, user.id));
    }
  }

  const role = roles.has(user.role as AdminRole) ? user.role as AdminRole : "designer";
  return { ...user, role };
}

export async function createAdminSession(user: { id: number; username: string; role: AdminRole }) {
  if (!sessionSecret()) throw new Error("ADMIN_SESSION_SECRET is required");
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + MAX_AGE * 1000);
  await db.insert(adminSessions).values({
    tokenHash: hashToken(token),
    actorId: String(user.id),
    roleAtLogin: user.role,
    expiresAt,
  });
  return token;
}

function readCookie(req: NextRequest | Request): string | null {
  return req.headers.get("cookie")?.match(/(?:^|; )rf_admin_session=([^;]+)/)?.[1] ?? null;
}

const requestSessionCache = new WeakMap<Request, Promise<AdminSessionContext | null>>();

async function resolveAdminSessionContext(req: NextRequest | Request): Promise<AdminSessionContext | null> {
  if (!sessionSecret() || !requestOriginAllowed(req)) return null;
  const token = readCookie(req);
  if (!token) return null;

  const now = new Date();
  const [row] = await db.select({
    id: adminSessions.id,
    actorId: adminSessions.actorId,
    expiresAt: adminSessions.expiresAt,
  }).from(adminSessions).where(and(
    eq(adminSessions.tokenHash, hashToken(token)),
    isNull(adminSessions.revokedAt),
    gt(adminSessions.expiresAt, now),
  )).limit(1);
  if (!row) return null;

  const userId = Number(row.actorId);
  if (!Number.isInteger(userId)) return null;
  const [user] = await db.select().from(adminUsers).where(and(
    eq(adminUsers.id, userId),
    eq(adminUsers.enabled, true),
  )).limit(1);
  if (!user) return null;

  const role = roles.has(user.role as AdminRole) ? user.role as AdminRole : "designer";
  await db.update(adminSessions).set({ lastSeenAt: now }).where(eq(adminSessions.id, row.id));
  return {
    actorId: `admin:${user.id}`,
    username: user.username,
    role,
    exp: Math.floor(row.expiresAt.getTime() / 1000),
    sessionId: row.id,
    userId: user.id,
  };
}

export async function getAdminSessionContext(req: NextRequest | Request): Promise<AdminSessionContext | null> {
  const cached = requestSessionCache.get(req);
  if (cached) return cached;
  const pending = resolveAdminSessionContext(req);
  requestSessionCache.set(req, pending);
  return pending;
}

export async function revokeAdminSession(req: NextRequest | Request) {
  const token = readCookie(req);
  if (token) {
    await db.update(adminSessions).set({ revokedAt: new Date() }).where(eq(adminSessions.tokenHash, hashToken(token)));
  }
}

export function isAdminConfigured() {
  return Boolean(sessionSecret());
}

export async function isAdminAuthorized(req: NextRequest | Request) {
  return (await getAdminSessionContext(req)) !== null;
}

export function adminRoleAllowed(role: AdminRole, required: AdminRole | AdminRole[]) {
  return role === "admin" || (Array.isArray(required) ? required.includes(role) : role === required);
}

export function unauthorized() {
  return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export const ADMIN_COOKIE = COOKIE;
export const ADMIN_SESSION_MAX_AGE = MAX_AGE;

/** Re-authentication gate for password/MFA changes. */
export async function verifyAdminStepUp(userId: number, password: string, totp?: string): Promise<boolean> {
  if (!password) return false;
  const [user] = await db.select().from(adminUsers).where(and(
    eq(adminUsers.id, userId),
    eq(adminUsers.enabled, true),
  )).limit(1);
  if (!user || !verifyAdminPassword(password, user.passwordSalt, user.passwordHash)) return false;
  if (user.mfaSecret) {
    const clear = decryptMfaSecret(user.mfaSecret);
    if (!verifyTotp(clear, totp || "")) return false;
  }
  return true;
}
