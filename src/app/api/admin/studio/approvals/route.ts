import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { stableJson } from "@/lib/match-integrity";
import { db } from "@/db";
import { adminApprovalRequests, adminAuditLogs } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getAdminSessionContext, isAdminAuthorized, adminRoleAllowed, unauthorized } from "@/lib/admin-auth";
import { approvalSnapshot, isValidApprovalStage, tableFor } from "@/lib/content-pipeline";

function contentHash(value: unknown): string {
  return crypto.createHash("sha256").update(stableJson(value)).digest("hex");
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const resource = req.nextUrl.searchParams.get("resource");
  const rows = await db.select().from(adminApprovalRequests).where(resource ? eq(adminApprovalRequests.resource, resource) : undefined).orderBy(desc(adminApprovalRequests.id)).limit(250);
  return Response.json({ ok: true, rows });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  const b = await req.json();
  const resource = String(b.resource || "");
  const resourceId = Number(b.resourceId);
  const stage = String(b.stage || "content");
  const requiredRole = stage === "content" ? "designer" : stage === "qa" ? "qa" : "liveops";
  if (!adminRoleAllowed(actor.role, requiredRole)) return Response.json({ ok: false, error: `Role ${actor.role} cannot request ${stage} approval` }, { status: 403 });
  if (!tableFor(resource) || !Number.isInteger(resourceId) || !isValidApprovalStage(stage)) return Response.json({ ok: false, error: "Invalid approval target or stage" }, { status: 400 });
  const table = tableFor(resource);
  const [current] = await db.select().from(table).where(eq((table as any).id, resourceId)).limit(1);
  if (!current) return Response.json({ ok: false, error: "Content target not found" }, { status: 404 });
  const hash = contentHash(await approvalSnapshot(resource, current));
  const [existing] = await db.select().from(adminApprovalRequests).where(and(eq(adminApprovalRequests.resource, resource), eq(adminApprovalRequests.resourceId, resourceId), eq(adminApprovalRequests.stage, stage), eq(adminApprovalRequests.contentHash, hash), eq(adminApprovalRequests.status, "pending"))).limit(1);
  if (existing) return Response.json({ ok: true, row: existing, duplicate: true });
  const [row] = await db.insert(adminApprovalRequests).values({ resource, resourceId, stage, contentHash: hash, status: "pending", requestedBy: actor.actorId, note: String(b.note || "").slice(0, 1000) }).returning();
  await db.insert(adminAuditLogs).values({ action: "approval_requested", resource, resourceId, actor: actor.actorId, details: { stage, role: actor.role } });
  return Response.json({ ok: true, row });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  const b = await req.json();
  const id = Number(b.id);
  const status = String(b.status || "");
  if (!Number.isInteger(id) || !["approved", "rejected"].includes(status)) return Response.json({ ok: false, error: "Invalid approval decision" }, { status: 400 });
  const [pending] = await db.select().from(adminApprovalRequests).where(and(eq(adminApprovalRequests.id, id), eq(adminApprovalRequests.status, "pending"))).limit(1);
  if (!pending) return Response.json({ ok: false, error: "Approval request is no longer pending" }, { status: 409 });
  const requiredRole = pending.stage === "content" ? "designer" : pending.stage === "qa" ? "qa" : "liveops";
  if (!adminRoleAllowed(actor.role, requiredRole)) return Response.json({ ok: false, error: `Role ${actor.role} cannot decide ${pending.stage} approval` }, { status: 403 });
  if (pending.requestedBy === actor.actorId) return Response.json({ ok: false, error: "Four-eyes policy: the requester cannot decide their own approval" }, { status: 403 });
  const [row] = await db.update(adminApprovalRequests).set({ status, decidedBy: actor.actorId, decisionNote: String(b.decisionNote || "").slice(0, 1000), decidedAt: new Date() }).where(and(eq(adminApprovalRequests.id, id), eq(adminApprovalRequests.status, "pending"))).returning();
  if (!row) return Response.json({ ok: false, error: "Approval request is no longer pending" }, { status: 409 });
  await db.insert(adminAuditLogs).values({ action: `approval_${status}`, resource: row.resource, resourceId: row.resourceId, actor: actor.actorId, details: { stage: row.stage, role: actor.role } });
  return Response.json({ ok: true, row });
}
