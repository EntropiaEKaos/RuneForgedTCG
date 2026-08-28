import { NextRequest } from "next/server";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, adminRoleAllowed } from "@/lib/admin-auth";
import { tableFor, validateContent, validateContentReferences, type ContentResource } from "@/lib/content-pipeline";
import { db } from "@/db";
import { adminAuditLogs, customCards } from "@/db/schema";
import { validateAuthorableCard as validateCard } from "@/game/card-authoring";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role,"designer")) return Response.json({ ok:false, error:`Role ${actor.role} cannot import content` }, { status:403 });
  try {
    const b = await req.json();
    const resource = String(b.resource || "") as ContentResource;
    const rows = Array.isArray(b.rows) ? b.rows : [];
    const table = tableFor(resource);
    if (!table || !rows.length || rows.length > 500) return Response.json({ ok: false, error: "resource and 1-500 rows are required" }, { status: 400 });

    const prepared: any[] = [];
    const errors: Array<{ index: number; errors: string[] }> = [];
    for (let index = 0; index < rows.length; index++) {
      const input = rows[index];
      if (!input || typeof input !== "object" || Array.isArray(input)) { errors.push({ index, errors: ["Row must be an object."] }); continue; }
      const clean = { ...input };
      delete clean.id; delete clean.createdAt; delete clean.updatedAt;
      if (resource === "cards") {
        const result = validateCard(clean.data ?? clean);
        if (!result.ok) { errors.push({ index, errors: [result.error] }); continue; }
        prepared.push({ defId: result.card.defId, name: result.card.name, region: result.card.region, type: result.card.type, cost: result.card.cost, enabled: false, data: result.card });
        continue;
      }
      // Imported content is always staged as draft/inactive. Import must never be a publication bypass.
      if ("enabled" in clean) clean.enabled = false;
      if ("status" in clean) clean.status = "draft";
      if ("releaseState" in clean) clean.releaseState = "draft";
      const validation = validateContent(resource, clean);
      const refErrors = await validateContentReferences(resource, clean);
      if (!validation.passed || refErrors.length) errors.push({ index, errors: [...validation.errors, ...refErrors] });
      else prepared.push(clean);
    }
    if (errors.length) return Response.json({ ok: false, error: "Import validation failed", errors }, { status: 400 });

    const inserted = (await db.transaction(async (tx) => {
      const result = (await tx.insert(table).values(prepared as any).returning()) as any[];
      await tx.insert(adminAuditLogs).values({ action: "bulk_import", resource, actor: actor.actorId, details: { count: result.length, dryRun: false } });
      return result;
    })) as any[];
    return Response.json({ ok: true, count: inserted.length, rows: inserted, requiresApproval: true });
  } catch (error) {
    console.error("[admin/studio/import] POST failed", error);
    return Response.json({ ok: false, error: "Import failed" }, { status: 500 });
  }
}
