import { NextRequest } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, adminGameDefinitions, rankedSeasons } from "@/db/schema";
import { getAdminSessionContext, isAdminAuthorized, unauthorized } from "@/lib/admin-auth";
import { requireAdminStepUp } from "@/lib/admin-step-up";
import { CONTROL_DOMAINS, CONTROL_DOMAIN_INFO, validateControlDefinition, type ControlDomain, type DangerLevel } from "@/lib/control-plane";
import { ensureCustomCardsLoaded } from "@/game/catalog";

export const dynamic = "force-dynamic";

async function context(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return null;
  const actor = await getAdminSessionContext(req);
  return actor?.role === "admin" ? actor : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await context(req);
  if (!actor) return unauthorized();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
  const body = await req.json();
  const [current] = await db.select().from(adminGameDefinitions).where(eq(adminGameDefinitions.id, id)).limit(1);
  if (!current) return Response.json({ ok: false, error: "Definition not found" }, { status: 404 });

  const criticalTransition = current.dangerLevel === "critical" && (body.action === "publish" || body.action === "archive");
  if (criticalTransition) {
    const stepUp = await requireAdminStepUp(req, actor, body, {
      scope: "admin-control-critical",
      actionLabel: "critical runtime control changes",
    });
    if (stepUp) return stepUp;
  }

  if (body.action === "archive") {
    const [row] = await db.update(adminGameDefinitions).set({ status: "archived", enabled: false, revision: sql`${adminGameDefinitions.revision} + 1`, updatedAt: new Date() }).where(and(eq(adminGameDefinitions.id, id), eq(adminGameDefinitions.revision, Number(body.expectedRevision) || current.revision))).returning();
    if (!row) return Response.json({ ok: false, error: "Revision conflict; reload before archiving" }, { status: 409 });
    await db.insert(adminAuditLogs).values({ action: "control.archive", resource: current.domain, resourceId: id, actor: actor.actorId, details: { key: current.key, previousRevision: current.revision, stepUp: criticalTransition } });
    return Response.json({ ok: true, row });
  }

  if (body.action === "publish") {
    await ensureCustomCardsLoaded();
    const validation = validateControlDefinition({ domain: current.domain as ControlDomain, key: current.key, name: current.name, description: current.description, dangerLevel: current.dangerLevel as DangerLevel, schemaVersion: current.schemaVersion, payload: current.payload as Record<string, unknown> });
    if (!validation.passed) return Response.json({ ok: false, error: "Definition failed validation", validation }, { status: 400 });
    const required = `PUBLICAR ${current.domain}/${current.key}`;
    if (current.dangerLevel === "critical" && String(body.confirmation || "") !== required) return Response.json({ ok: false, error: `Critical publication requires confirmation: ${required}` }, { status: 409 });
    const published = await db.transaction(async (tx) => {
      const [row] = await tx.update(adminGameDefinitions).set({ status: "published", enabled: true, revision: sql`${adminGameDefinitions.revision} + 1`, updatedAt: new Date() }).where(and(eq(adminGameDefinitions.id, id), eq(adminGameDefinitions.revision, Number(body.expectedRevision) || current.revision))).returning();
      if (!row) return null;

      // Ranked seasons are not decorative control-plane metadata: publishing one
      // synchronizes the canonical ranked_seasons table used by settlement.
      if (current.domain === "ranked-seasons") {
        const payload = current.payload as Record<string, unknown>;
        const startsAt = new Date(String(payload.startsAt || ""));
        const endsAt = new Date(String(payload.endsAt || ""));
        if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || startsAt >= endsAt) throw new Error("Invalid ranked season window");
        const active = payload.active === true;
        if (active && process.env.RANKED_RELEASE_CERTIFIED !== "true") throw new Error("Ranked season activation refused: RANKED_RELEASE_CERTIFIED is not true");
        if (active) await tx.update(rankedSeasons).set({ active: false }).where(eq(rankedSeasons.active, true));
        const [existingSeason] = await tx.select({ id: rankedSeasons.id }).from(rankedSeasons).where(eq(rankedSeasons.controlKey, current.key)).limit(1).for("update");
        if (existingSeason) {
          await tx.update(rankedSeasons).set({ name: current.name, startAt: startsAt, endAt: endsAt, active }).where(eq(rankedSeasons.id, existingSeason.id));
        } else {
          await tx.insert(rankedSeasons).values({ controlKey: current.key, name: current.name, startAt: startsAt, endAt: endsAt, active });
        }
      }

      await tx.insert(adminAuditLogs).values({ action: "control.publish", resource: current.domain, resourceId: id, actor: actor.actorId, details: { key: current.key, dangerLevel: current.dangerLevel, warnings: validation.warnings, stepUp: criticalTransition } });
      return row;
    });
    if (!published) return Response.json({ ok: false, error: "Revision conflict; reload before publishing" }, { status: 409 });
    return Response.json({ ok: true, row: published, validation });
  }

  if (current.status === "published") return Response.json({ ok: false, error: "Archive a live definition before editing it" }, { status: 409 });
  const expectedRevision = Number(body.expectedRevision);
  if (!Number.isInteger(expectedRevision)) return Response.json({ ok: false, error: "expectedRevision is required" }, { status: 400 });
  const domain = String(body.domain ?? current.domain) as ControlDomain;
  if (!CONTROL_DOMAINS.includes(domain)) return Response.json({ ok: false, error: "Unknown domain" }, { status: 400 });
  const key = String(body.key ?? current.key).trim().toLowerCase();
  const name = String(body.name ?? current.name).trim().slice(0, 120);
  const description = String(body.description ?? current.description).trim().slice(0, 2000);
  const dangerLevel = (["safe", "elevated", "critical"].includes(String(body.dangerLevel)) ? body.dangerLevel : CONTROL_DOMAIN_INFO[domain].danger) as DangerLevel;
  const schemaVersion = Math.max(1, Math.min(1000, Number(body.schemaVersion ?? current.schemaVersion) || 1));
  const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload : current.payload as Record<string, unknown>;
  await ensureCustomCardsLoaded();
  const validation = validateControlDefinition({ domain, key, name, description, dangerLevel, schemaVersion, payload });
  if (!validation.passed) return Response.json({ ok: false, error: "Definition failed validation", validation }, { status: 400 });
  try {
    const [row] = await db.update(adminGameDefinitions).set({ domain, key, name, description, dangerLevel, schemaVersion, payload, status: "draft", enabled: false, revision: sql`${adminGameDefinitions.revision} + 1`, updatedAt: new Date() }).where(and(eq(adminGameDefinitions.id, id), eq(adminGameDefinitions.revision, expectedRevision))).returning();
    if (!row) return Response.json({ ok: false, error: "Revision conflict; reload before saving" }, { status: 409 });
    await db.insert(adminAuditLogs).values({ action: "control.update", resource: domain, resourceId: id, actor: actor.actorId, details: { key, revision: row.revision, warnings: validation.warnings } });
    return Response.json({ ok: true, row, validation });
  } catch {
    return Response.json({ ok: false, error: "Update conflicts with another domain/key" }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await context(req);
  if (!actor) return unauthorized();
  const id = Number((await params).id);
  const [current] = await db.select().from(adminGameDefinitions).where(eq(adminGameDefinitions.id, id)).limit(1);
  if (!current) return Response.json({ ok: false, error: "Definition not found" }, { status: 404 });
  if (current.status === "published" || current.enabled) return Response.json({ ok: false, error: "Archive live content before deleting it" }, { status: 409 });
  await db.delete(adminGameDefinitions).where(eq(adminGameDefinitions.id, id));
  await db.insert(adminAuditLogs).values({ action: "control.delete", resource: current.domain, resourceId: id, actor: actor.actorId, details: { key: current.key, revision: current.revision } });
  return Response.json({ ok: true });
}
