import { NextRequest } from "next/server";
import { db } from "@/db";
import { adminAuditLogs, customCards } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, adminRoleAllowed } from "@/lib/admin-auth";
import { tableFor } from "@/lib/content-pipeline";
import { refreshCustomCardCache } from "@/game/catalog";

export const dynamic = "force-dynamic";

const STATE_FIELDS: Record<string, "enabled" | "status" | "releaseState"> = {
  cards: "enabled", keywords: "enabled", effects: "enabled", archetypes: "enabled", races: "enabled", classes: "enabled", interactions: "enabled",
  collections: "status", events: "status", promotions: "status", "card-meta": "releaseState",
};
const ARCHIVE_VALUES: Record<string, string | boolean> = { status: "archived", releaseState: "archived", enabled: false };

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  try {
    const b = await req.json();
    const resource = String(b.resource || "");
    const ids = ((Array.isArray(b.ids) ? [...new Set(b.ids.map(Number).filter(Number.isInteger))] : []) as number[]).slice(0, 500);
    const action = String(b.action || "");
    const table = tableFor(resource);
    if (!table || !ids.length) return Response.json({ ok: false, error: "resource and ids required" }, { status: 400 });
    if (!["archive", "enable", "disable", "duplicate"].includes(action)) return Response.json({ ok: false, error: "Unsupported bulk action" }, { status: 400 });
    if (action === "duplicate") {
      if (!adminRoleAllowed(actor.role, "designer")) return Response.json({ ok: false, error: `Role ${actor.role} cannot duplicate content` }, { status: 403 });
    }
    if (action === "disable") {
      if (!adminRoleAllowed(actor.role, "publisher")) return Response.json({ ok: false, error: `Role ${actor.role} cannot deactivate live content` }, { status: 403 });
    }
    if (action === "archive" || action === "enable") {
      return Response.json({ ok: false, error: "Bulk publish/archive is disabled. Use the Content Pipeline for each resource so validation and approvals cannot be bypassed." }, { status: 409 });
    }

    if (action === "duplicate" && resource === "cards") {
      const created = [];
      for (const id of ids) {
        const [source] = await db.select().from(customCards).where(eq(customCards.id, id)).limit(1);
        if (!source) continue;
        const base = String(source.defId).replace(/_copy_[a-z0-9]+$/i, "");
        const defId = `${base}_copy_${Date.now().toString(36)}_${id}`.slice(0, 120);
        const data = { ...(source.data as Record<string, unknown>), defId, name: `${source.name} Copy`.slice(0, 120) };
        const [row] = await db.insert(customCards).values({ defId, name: String(data.name), region: source.region, type: source.type, cost: source.cost, enabled: false, data }).returning();
        if (row) {
          created.push(row);
          await db.insert(adminAuditLogs).values({ action: "bulk_duplicate", resource, resourceId: row.id, actor: actor.actorId, details: { sourceId: id } });
        }
      }
      return Response.json({ ok: true, count: created.length, rows: created });
    }

    const stateField = STATE_FIELDS[resource];
    if (!stateField) return Response.json({ ok: false, error: `Bulk state operation is unsupported for ${resource}` }, { status: 400 });
    // Publishing is a pipeline operation. Never let bulk actions bypass
    // validation/QA/approval by translating enable -> published.
    if (action === "enable" && stateField !== "enabled") {
      return Response.json({ ok: false, error: "Bulk publish is disabled for this resource. Use the Content Pipeline approval workflow." }, { status: 409 });
    }
    const patchValue = action === "archive" ? ARCHIVE_VALUES[stateField] : action === "enable" ? true : false;
    const rows = [];
    for (const id of ids) {
      const [row] = await db.update(table).set({ [stateField]: patchValue, updatedAt: new Date() } as any).where(eq((table as any).id, id)).returning();
      if (row) {
        rows.push(row);
        await db.insert(adminAuditLogs).values({ action: `bulk_${action}`, resource, resourceId: id, actor: actor.actorId, details: { stateField, patchValue } });
      }
    }
    if (resource === "cards" && action === "disable") await refreshCustomCardCache();
    return Response.json({ ok: true, count: rows.length, rows });
  } catch (error) {
    console.error("[admin/studio/bulk] POST failed", error);
    return Response.json({ ok: false, error: "Bulk operation failed" }, { status: 500 });
  }
}
