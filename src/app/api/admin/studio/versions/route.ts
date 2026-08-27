import { NextRequest } from "next/server";
import { db } from "@/db";
import { adminContentVersions, adminAuditLogs } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, adminRoleAllowed } from "@/lib/admin-auth";
import { approvalSnapshot, fetchContent, validateContent, validateContentReferences } from "@/lib/content-pipeline";
import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, ["designer", "qa", "publisher"])) return Response.json({ ok: false, error: `Role ${actor.role} cannot access this resource` }, { status: 403 });
  const resource = req.nextUrl.searchParams.get("resource") || "";
  const id = Number(req.nextUrl.searchParams.get("resourceId"));
  if (!resource || !Number.isInteger(id)) return Response.json({ ok: false, error: "resource and resourceId required" }, { status: 400 });
  const rows = await db.select().from(adminContentVersions).where(and(eq(adminContentVersions.resource, resource), eq(adminContentVersions.resourceId, id))).orderBy(desc(adminContentVersions.version));
  return Response.json({ ok: true, rows });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  const body = await req.json();
  const resource = String(body.resource || "");
  const id = Number(body.resourceId);
  const status = String(body.status || "draft");
  if (!["draft", "qa"].includes(status)) return Response.json({ ok: false, error: "Version snapshots may only be draft or qa. Publishing must use the approval pipeline." }, { status: 400 });
  if (status === "draft" && !adminRoleAllowed(actor.role,"designer")) return Response.json({ ok: false, error: `Role ${actor.role} cannot create draft versions` }, { status: 403 });
  if (status === "qa" && !adminRoleAllowed(actor.role,"qa")) return Response.json({ ok: false, error: `Role ${actor.role} cannot create qa versions` }, { status: 403 });

  const row = await fetchContent(resource as any, id);
  if (!row) return Response.json({ ok: false, error: "Content not found" }, { status: 404 });
  const validation = validateContent(resource, row);
  if (status === "qa") {
    const referenceErrors = await validateContentReferences(resource as any, row);
    validation.errors.push(...referenceErrors);
    validation.checks = validation.checks.map((check) => check.key === "references" ? { ...check, passed: referenceErrors.length === 0 } : check);
    validation.passed = validation.errors.length === 0;
  }
  if (!validation.passed) return Response.json({ ok: false, error: "Content failed validation", validation }, { status: 400 });

  const last = await db.select().from(adminContentVersions).where(and(eq(adminContentVersions.resource, resource), eq(adminContentVersions.resourceId, id))).orderBy(desc(adminContentVersions.version)).limit(1);
  const version = (last[0]?.version || 0) + 1;
  const snapshot = await approvalSnapshot(resource, row);
  const [created] = await db.insert(adminContentVersions).values({ resource, resourceId: id, version, status, snapshot: snapshot as any, changeNote: String(body.changeNote || ""), author: actor.actorId, engineVersion: ENGINE_VERSION, rulesetVersion: RULESET_VERSION }).returning();
  await db.insert(adminAuditLogs).values({ action: `version_${status}`, resource, resourceId: id, actor: actor.actorId, details: { version, changeNote: body.changeNote || "" } });
  return Response.json({ ok: true, row: created, validation });
}
