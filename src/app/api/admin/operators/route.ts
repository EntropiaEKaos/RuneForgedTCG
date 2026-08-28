import { NextRequest } from "next/server";
import { db } from "@/db";
import { adminAuditLogs, adminSessions, adminUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, verifyAdminStepUp } from "@/lib/admin-auth";
import { consumeRateLimit, consumeRequestRateLimit } from "@/lib/rate-limit";
import { encryptMfaSecret, generateMfaSecret, hashAdminPassword } from "@/lib/admin-credentials";

const roles = ["admin", "designer", "qa", "liveops", "publisher"];
async function admin(req: NextRequest) { if (!(await isAdminAuthorized(req))) return null; const actor = await getAdminSessionContext(req); return actor?.role === "admin" ? actor : null; }
async function stepUpGate(req: NextRequest, actor: { userId: number }) {
  const requestLimit = await consumeRequestRateLimit(req, "admin-operator-stepup", 12, 5 * 60_000);
  const actorLimit = await consumeRateLimit(`admin-operator-stepup:user:${actor.userId}`, 10, 5 * 60_000);
  const limit = !requestLimit.allowed ? requestLimit : actorLimit;
  if (!limit.allowed) return Response.json({ ok: false, error: "Too many sensitive admin changes", code: "ADMIN_STEP_UP_RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  return null;
}


export async function GET(req: NextRequest) {
  const actor = await admin(req); if (!actor) return unauthorized();
  const rows = await db.select({ id: adminUsers.id, username: adminUsers.username, role: adminUsers.role, enabled: adminUsers.enabled, mfaSecret: adminUsers.mfaSecret, createdAt: adminUsers.createdAt }).from(adminUsers);
  return Response.json({ ok: true, currentUserId: actor.userId, rows: rows.map((row) => ({ ...row, mfaEnabled: Boolean(row.mfaSecret), mfaSecret: undefined })) });
}

export async function POST(req: NextRequest) {
  const actor = await admin(req); if (!actor) return unauthorized();
  const limited = await stepUpGate(req, actor); if (limited) return limited;
  const body = await req.json();
  const stepUpOk = await verifyAdminStepUp(actor.userId, String(body.currentPassword || ""), typeof body.currentTotp === "string" ? body.currentTotp : undefined);
  if (!stepUpOk) return Response.json({ ok: false, error: "Current administrator credentials are required to create operators", code: "ADMIN_STEP_UP_REQUIRED" }, { status: 403 });
  const username = String(body.username || "").trim().toLowerCase(); const role = String(body.role || "designer"); const password = String(body.password || "");
  if (!/^[a-z0-9._-]{3,80}$/.test(username) || password.length < 12 || !roles.includes(role)) return Response.json({ ok: false, error: "Invalid operator" }, { status: 400 });
  const { salt, hash } = hashAdminPassword(password); const mfaSecret = body.requireMfa ? generateMfaSecret() : null; const encryptedMfa = mfaSecret ? encryptMfaSecret(mfaSecret) : null;
  try {
    const [row] = await db.insert(adminUsers).values({ username, passwordSalt: salt, passwordHash: hash, role, enabled: true, mfaSecret: encryptedMfa }).returning({ id: adminUsers.id, username: adminUsers.username, role: adminUsers.role });
    await db.insert(adminAuditLogs).values({ action: "operator.create", resource: "admin-operators", resourceId: row.id, actor: actor.actorId, details: { username, role, mfaEnabled: Boolean(mfaSecret), stepUp: true } });
    return Response.json({ ok: true, row, mfaSecret });
  } catch { return Response.json({ ok: false, error: "Username already exists" }, { status: 409 }); }
}

export async function PATCH(req: NextRequest) {
  const actor = await admin(req); if (!actor) return unauthorized();
  const limited = await stepUpGate(req, actor); if (limited) return limited;
  const body = await req.json(); const id = Number(body.id);
  if (!Number.isInteger(id)) return Response.json({ ok: false, error: "Invalid operator id" }, { status: 400 });
  if (id === actor.userId && (body.enabled === false || (body.role && body.role !== "admin"))) return Response.json({ ok: false, error: "Current operator cannot disable or demote itself" }, { status: 400 });
  const sensitiveCredentialChange = body.newPassword !== undefined || body.mfaAction !== undefined || body.enabled !== undefined || body.role !== undefined;
  const stepUpOk = await verifyAdminStepUp(actor.userId, String(body.currentPassword || ""), typeof body.currentTotp === "string" ? body.currentTotp : undefined);
  if (!stepUpOk) return Response.json({ ok: false, error: "Current administrator credentials are required for operator changes", code: "ADMIN_STEP_UP_REQUIRED" }, { status: 403 });
  const patch: Record<string, any> = { updatedAt: new Date() }; const fields: string[] = []; let clearSessions = false; let mfaSecret: string | null = null;
  if (typeof body.enabled === "boolean") { patch.enabled = body.enabled; fields.push("enabled"); clearSessions ||= !body.enabled; }
  if (roles.includes(String(body.role))) { patch.role = String(body.role); fields.push("role"); clearSessions = true; }
  if (body.newPassword !== undefined) {
    const password = String(body.newPassword); if (password.length < 12) return Response.json({ ok: false, error: "Password must contain at least 12 characters" }, { status: 400 });
    const hashed = hashAdminPassword(password); patch.passwordSalt = hashed.salt; patch.passwordHash = hashed.hash; fields.push("password"); clearSessions = true;
  }
  if (["enable", "rotate"].includes(String(body.mfaAction))) { mfaSecret = generateMfaSecret(); patch.mfaSecret = encryptMfaSecret(mfaSecret); fields.push("mfa"); clearSessions = true; }
  if (body.mfaAction === "disable") { patch.mfaSecret = null; fields.push("mfa"); clearSessions = true; }
  if (!fields.length) return Response.json({ ok: false, error: "No operator changes requested" }, { status: 400 });
  const [row] = await db.update(adminUsers).set(patch).where(eq(adminUsers.id, id)).returning({ id: adminUsers.id, username: adminUsers.username, role: adminUsers.role, enabled: adminUsers.enabled });
  if (!row) return Response.json({ ok: false, error: "Operator not found" }, { status: 404 });
  if (clearSessions) await db.update(adminSessions).set({ revokedAt: new Date() }).where(eq(adminSessions.actorId, String(id)));
  await db.insert(adminAuditLogs).values({ action: "operator.update", resource: "admin-operators", resourceId: id, actor: actor.actorId, details: { fields, sessionsRevoked: clearSessions, stepUp: sensitiveCredentialChange } });
  return Response.json({ ok: true, row, mfaSecret, reauthRequired: clearSessions && id === actor.userId });
}
