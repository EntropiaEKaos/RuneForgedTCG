import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, adminGameDefinitions, cardCosmeticVariants } from "@/db/schema";
import { normalizeCardFramePreset } from "@/game/card-frame-presets";
import { adminRoleAllowed, getAdminSessionContext, unauthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
const DOMAIN = "card-frame-presets";

async function actorFor(req: NextRequest, role: "designer" | "publisher") {
  const actor = await getAdminSessionContext(req);
  if (!actor || !adminRoleAllowed(actor.role, role)) return null;
  return actor;
}

function asPreset(row: typeof adminGameDefinitions.$inferSelect) {
  const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
    ? row.payload as Record<string, unknown>
    : {};
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    config: payload.config || payload,
    status: row.status,
    enabled: row.enabled,
    revision: row.revision,
    updatedAt: row.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  const actor = await actorFor(req, "designer");
  if (!actor) return unauthorized();
  const rows = await db.select().from(adminGameDefinitions)
    .where(eq(adminGameDefinitions.domain, DOMAIN))
    .orderBy(desc(adminGameDefinitions.updatedAt), desc(adminGameDefinitions.id));
  return Response.json({ ok: true, rows: rows.map(asPreset), role: actor.role });
}

export async function POST(req: NextRequest) {
  const actor = await actorFor(req, "designer");
  if (!actor) return unauthorized();
  const body = await req.json() as Record<string, unknown>;
  const normalized = normalizeCardFramePreset(body);
  if (!normalized.value) return Response.json({ ok: false, error: normalized.errors.join("; ") }, { status: 400 });
  const preset = normalized.value;
  const existing = await db.select({ id: adminGameDefinitions.id }).from(adminGameDefinitions).where(and(
    eq(adminGameDefinitions.domain, DOMAIN),
    eq(adminGameDefinitions.key, preset.key),
  )).limit(1);
  if (existing.length) return Response.json({ ok: false, error: "Frame key already exists" }, { status: 409 });
  const row = await db.transaction(async (tx) => {
    const inserted = await tx.insert(adminGameDefinitions).values({
      domain: DOMAIN,
      key: preset.key,
      name: preset.name,
      description: preset.description || "",
      dangerLevel: "safe",
      schemaVersion: 1,
      revision: 1,
      payload: { config: preset.config },
      status: "draft",
      enabled: false,
    }).returning();
    await tx.insert(adminAuditLogs).values({
      action: "card.frame.create",
      resource: "card-frame-preset",
      resourceId: inserted[0].id,
      actor: actor.actorId,
      details: { key: inserted[0].key, revision: inserted[0].revision },
    });
    return inserted[0];
  });
  return Response.json({ ok: true, row: asPreset(row) });
}

export async function PATCH(req: NextRequest) {
  const actor = await actorFor(req, "designer");
  if (!actor) return unauthorized();
  const body = await req.json() as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ ok: false, error: "Valid id is required" }, { status: 400 });
  const [current] = await db.select().from(adminGameDefinitions).where(and(eq(adminGameDefinitions.id, id), eq(adminGameDefinitions.domain, DOMAIN))).limit(1);
  if (!current) return Response.json({ ok: false, error: "Frame preset not found" }, { status: 404 });
  const currentPayload = current.payload && typeof current.payload === "object" && !Array.isArray(current.payload) ? current.payload as Record<string, unknown> : {};
  const merged = {
    id,
    key: current.key,
    name: body.name ?? current.name,
    description: body.description ?? current.description,
    config: body.config ?? currentPayload.config ?? currentPayload,
  };
  const normalized = normalizeCardFramePreset(merged);
  if (!normalized.value) return Response.json({ ok: false, error: normalized.errors.join("; ") }, { status: 400 });
  const requestedStatus = String(body.status ?? current.status);
  const requestedEnabled = body.enabled == null ? current.enabled : Boolean(body.enabled);
  if (!new Set(["draft", "published", "archived"]).has(requestedStatus)) return Response.json({ ok: false, error: "Invalid status" }, { status: 400 });
  if ((requestedStatus === "published" || requestedEnabled || current.status === "published" || current.enabled) && !adminRoleAllowed(actor.role, "publisher")) {
    return Response.json({ ok: false, error: "Publisher role required to change a live frame preset" }, { status: 403 });
  }
  if (requestedEnabled && requestedStatus !== "published") return Response.json({ ok: false, error: "Only published frame presets may be enabled" }, { status: 400 });
  const row = await db.transaction(async (tx) => {
    const updated = await tx.update(adminGameDefinitions).set({
      name: normalized.value!.name,
      description: normalized.value!.description || "",
      payload: { config: normalized.value!.config },
      status: requestedStatus,
      enabled: requestedEnabled,
      revision: current.revision + 1,
      updatedAt: new Date(),
    }).where(eq(adminGameDefinitions.id, id)).returning();
    await tx.insert(adminAuditLogs).values({
      action: "card.frame.update",
      resource: "card-frame-preset",
      resourceId: id,
      actor: actor.actorId,
      details: { key: current.key, fromRevision: current.revision, revision: updated[0].revision, status: requestedStatus, enabled: requestedEnabled },
    });
    return updated[0];
  });
  return Response.json({ ok: true, row: asPreset(row) });
}

export async function DELETE(req: NextRequest) {
  const actor = await actorFor(req, "publisher");
  if (!actor) return unauthorized();
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return Response.json({ ok: false, error: "Valid id is required" }, { status: 400 });
  const [current] = await db.select().from(adminGameDefinitions).where(and(eq(adminGameDefinitions.id, id), eq(adminGameDefinitions.domain, DOMAIN))).limit(1);
  if (!current) return Response.json({ ok: false, error: "Frame preset not found" }, { status: 404 });
  const [usage] = await db.select({ id: cardCosmeticVariants.id }).from(cardCosmeticVariants).where(eq(cardCosmeticVariants.frameId, current.key)).limit(1);
  if (usage) {
    const row = await db.transaction(async (tx) => {
      const updated = await tx.update(adminGameDefinitions).set({ status: "archived", enabled: false, revision: current.revision + 1, updatedAt: new Date() }).where(eq(adminGameDefinitions.id, id)).returning();
      await tx.insert(adminAuditLogs).values({ action: "card.frame.archive", resource: "card-frame-preset", resourceId: id, actor: actor.actorId, details: { key: current.key, reason: "cosmetic-usage-exists" } });
      return updated[0];
    });
    return Response.json({ ok: true, archived: true, row: asPreset(row) });
  }
  await db.transaction(async (tx) => {
    await tx.delete(adminGameDefinitions).where(eq(adminGameDefinitions.id, id));
    await tx.insert(adminAuditLogs).values({ action: "card.frame.delete", resource: "card-frame-preset", resourceId: id, actor: actor.actorId, details: { key: current.key } });
  });
  return Response.json({ ok: true, deleted: true });
}
