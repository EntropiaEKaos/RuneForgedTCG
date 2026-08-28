import { NextRequest } from "next/server";
import { db } from "@/db";
import { adminQaRuns, adminAuditLogs } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, adminRoleAllowed } from "@/lib/admin-auth";
import { fetchContent, validateContent, validateContentReferences } from "@/lib/content-pipeline";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role,"qa")) return Response.json({ ok: false, error: `Role ${actor.role} cannot access this resource` }, { status: 403 });
  const resource = req.nextUrl.searchParams.get("resource") || "";
  const id = Number(req.nextUrl.searchParams.get("resourceId"));
  const rows = resource && Number.isInteger(id)
    ? await db.select().from(adminQaRuns).where(and(eq(adminQaRuns.resource, resource), eq(adminQaRuns.resourceId, id))).orderBy(desc(adminQaRuns.createdAt)).limit(50)
    : await db.select().from(adminQaRuns).orderBy(desc(adminQaRuns.createdAt)).limit(50);
  return Response.json({ ok: true, rows });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role,"qa")) return Response.json({ ok: false, error: `Role ${actor.role} cannot run QA` }, { status: 403 });
  const body = await req.json();
  const resource = String(body.resource || "");
  const id = Number(body.resourceId);
  const row = await fetchContent(resource as any, id);
  if (!row) return Response.json({ ok: false, error: "Content not found" }, { status: 404 });

  const result = validateContent(resource, row);
  const referenceErrors = await validateContentReferences(resource as any, row);
  result.errors.push(...referenceErrors);
  result.checks = result.checks.map((check) => check.key === "references" ? { ...check, passed: referenceErrors.length === 0 } : check);
  result.passed = result.errors.length === 0;

  const [qa] = await db.insert(adminQaRuns).values({ resource, resourceId: id, passed: result.passed, checks: result.checks, errors: result.errors, warnings: result.warnings }).returning();
  await db.insert(adminAuditLogs).values({ action: "qa_run", resource, resourceId: id, actor: actor.actorId, details: { passed: result.passed } });
  return Response.json({ ok: true, qa, result });
}
