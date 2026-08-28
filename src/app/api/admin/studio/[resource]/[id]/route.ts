import { NextRequest } from "next/server";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { adminKeywords, adminEffects, adminRaces, adminClasses, adminInteractions, adminCollections, cardCatalogMeta, adminEvents, adminPromotions, adminCardArchetypes, players, customCards } from "@/db/schema";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, adminRoleAllowed } from "@/lib/admin-auth";
import { adminAuditLogs } from "@/db/schema";
import { validateContent, validateContentReferences } from "@/lib/content-pipeline";
import { recordEconomyTransaction } from "@/lib/economy-ledger";
import { levelFromXp } from "@/lib/achievements";
import { analyzeContentReverseDependencies } from "@/lib/content-impact";

export const dynamic = "force-dynamic";
const tables = { keywords: adminKeywords, effects: adminEffects, archetypes: adminCardArchetypes, races: adminRaces, classes: adminClasses, interactions: adminInteractions, collections: adminCollections, "card-meta": cardCatalogMeta, events: adminEvents, promotions: adminPromotions, players } as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ resource: string; id: string }> }) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, "designer")) return Response.json({ ok: false, error: `Role ${actor.role} cannot edit content` }, { status: 403 });
  const { resource, id } = await params;
  if (resource === "players" && !adminRoleAllowed(actor.role, "admin")) return Response.json({ ok: false, error: "Only admin can edit player profiles" }, { status: 403 });
  const table = tables[resource as keyof typeof tables];
  if (!table) return Response.json({ ok: false, error: "Unknown resource" }, { status: 404 });
  const body = await req.json();
  const clean = { ...body };
  delete clean.id; delete clean.createdAt; delete clean.updatedAt;
  if (resource === "players") {
    const allowed = ["name","avatar","cardBack","title","bio","banner","status","badges","moderatorNote","gold","dust","xp","level","mmr","peakMmr","rankedWins","rankedLosses"];
    for (const k of Object.keys(clean)) if (!allowed.includes(k)) delete clean[k];
    const numericFields = ["gold","dust","xp","level","mmr","peakMmr","rankedWins","rankedLosses"];
    for (const n of numericFields) {
      if (clean[n] === undefined) continue;
      const v = Number(clean[n]);
      if (!Number.isFinite(v) || !Number.isInteger(v) || v < 0) return Response.json({ ok: false, error: `${n} must be a non-negative integer` }, { status: 400 });
      clean[n] = v;
    }
    if (clean.level !== undefined && clean.xp === undefined) return Response.json({ ok: false, error: "level is derived from xp; edit xp instead" }, { status: 400 });
    const economyFields = ["gold", "dust", "xp"];
    const economyChanged = economyFields.some((n) => clean[n] !== undefined);
    if (economyChanged && !String(body.economyReason || "").trim()) return Response.json({ ok: false, error: "economyReason is required for admin balance changes" }, { status: 400 });
    clean.__economyReason = economyChanged ? String(body.economyReason).trim().slice(0, 200) : undefined;
  } else {
    const allowedByResource: Record<string, string[]> = {
      keywords: ["name", "description", "icon", "engineKeyword", "behavior"],
      effects: ["name", "description", "kind", "schema"],
      archetypes: ["name", "description", "baseType", "definition"],
      races: ["name", "description", "icon", "region", "color"],
      classes: ["name", "description", "icon", "color"],
      interactions: ["name", "sourceType", "sourceKey", "targetType", "targetKey", "condition", "effect", "priority"],
      collections: ["name", "description", "symbol", "banner", "releaseDate", "rotationDate", "metadata"],
      "card-meta": ["collectionId", "tags", "classKeys", "raceKeys", "notes"],
      events: ["name", "description", "type", "startsAt", "endsAt", "rules", "rewards", "metadata"],
      promotions: ["name", "description", "type", "startsAt", "endsAt", "conditions", "offers", "metadata"],
    };
    const allowed = allowedByResource[resource];
    if (!allowed) return Response.json({ ok: false, error: "Unsupported resource" }, { status: 400 });
    for (const k of Object.keys(clean)) if (!allowed.includes(k)) delete clean[k];
    if (clean.name !== undefined) clean.name = String(clean.name).slice(0, 120);
    if (clean.description !== undefined) clean.description = String(clean.description).slice(0, 1000);
    if (clean.priority !== undefined) {
      const priority = Number(clean.priority);
      if (!Number.isInteger(priority) || priority < -100000 || priority > 100000) return Response.json({ ok: false, error: "priority must be a bounded integer" }, { status: 400 });
      clean.priority = priority;
    }
    if (clean.collectionId !== undefined && clean.collectionId !== null) {
      const collectionId = Number(clean.collectionId);
      if (!Number.isInteger(collectionId) || collectionId < 1) return Response.json({ ok: false, error: "collectionId must be a positive integer" }, { status: 400 });
      clean.collectionId = collectionId;
    }
    for (const field of ["startsAt", "endsAt", "releaseDate", "rotationDate"]) {
      if (clean[field] === undefined || clean[field] === null) continue;
      const d = new Date(clean[field]);
      if (Number.isNaN(d.getTime())) return Response.json({ ok: false, error: `${field} must be a valid date` }, { status: 400 });
      clean[field] = d;
    }
  }
  if (resource !== "players" && (clean.status === "published" || clean.releaseState === "published" || clean.enabled === true || clean.status === "archived" || clean.releaseState === "archived")) {
    return Response.json({ ok: false, error: "Content state changes must go through the Content Pipeline approval workflow." }, { status: 409 });
  }
  if (resource !== "players") {
    // Draft edits cannot silently activate content. State transitions belong to the pipeline.
    delete clean.enabled;
    if ("status" in clean) clean.status = "draft";
    if ("releaseState" in clean) clean.releaseState = "draft";
  }
  clean.updatedAt = new Date();
  if (resource !== "players") {
    const current = await db.select().from(table).where(eq((table as any).id, Number(id))).limit(1);
    if (!current[0]) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    if (resource === "card-meta") {
      const defId = String((current[0] as any).defId || "");
      const [activeCard] = await db.select({ enabled: customCards.enabled }).from(customCards).where(eq(customCards.defId, defId)).limit(1);
      if (activeCard?.enabled) return Response.json({ ok: false, error: "The launch collection of a live card is immutable. Archive the card before editing its catalog metadata." }, { status: 409 });
    }
    const currentActive = current[0] as any;
    if (currentActive.status === "published" || currentActive.releaseState === "published" || currentActive.enabled === true) {
      return Response.json({ ok: false, error: "Published or active content must be archived before editing. Create a new draft/version and publish it through the approval pipeline." }, { status: 409 });
    }
    const candidate = { ...current[0], ...clean };
    const validation = validateContent(resource, candidate);
    const refErrors = await validateContentReferences(resource as any, candidate);
    if (!validation.passed || refErrors.length) return Response.json({ ok: false, error: "Content failed validation", validation: { ...validation, errors: [...validation.errors, ...refErrors], passed: false } }, { status: 400 });
  }
  try {
    if (resource === "players") {
      const reason = clean.__economyReason as string | undefined;
      delete clean.__economyReason;
      const row = await db.transaction(async (tx) => {
        const [current] = await tx.select().from(players).where(eq(players.id, Number(id))).limit(1).for("update");
        if (!current) return null;
        const next = { ...clean, updatedAt: new Date() } as any;
        if (next.xp !== undefined) {
          // Level is derived data. Never allow an admin patch to make it diverge
          // from the authoritative XP value, even when both fields were supplied.
          next.level = levelFromXp(Number(next.xp));
        }
        const [updated] = await tx.update(players).set(next).where(eq(players.id, Number(id))).returning();
        if (reason) {
          for (const currency of ["gold", "dust", "xp"] as const) {
            if (clean[currency] === undefined) continue;
            const delta = Number(clean[currency]) - Number((current as any)[currency]);
            if (delta) await recordEconomyTransaction(tx, { playerId: current.id, currency, amount: delta, balanceAfter: Number(clean[currency]), reason: `admin_adjustment:${reason}`, referenceType: "player", referenceId: String(current.id) });
          }
        }
        await tx.insert(adminAuditLogs).values({ action: "update", resource, resourceId: Number(id), actor: actor.actorId, details: { role: actor.role, fields: Object.keys(clean), economyReason: reason || null } });
        return updated;
      });
      if (!row) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
      return Response.json({ ok: true, row });
    }
    const [row] = await db.update(table).set(clean as any).where(eq((table as any).id, Number(id))).returning();
    if (!row) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    await db.insert(adminAuditLogs).values({ action: "update", resource, resourceId: Number(id), actor: actor.actorId, details: { role: actor.role, fields: Object.keys(clean).filter((k) => k !== "updatedAt") } });
    return Response.json({ ok: true, row });
  } catch { return Response.json({ ok: false, error: "Update failed" }, { status: 409 }); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ resource: string; id: string }> }) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, "publisher")) return Response.json({ ok: false, error: `Role ${actor.role} cannot delete content` }, { status: 403 });
  const { resource, id } = await params;
  if (resource === "players") return Response.json({ ok: false, error: "Player deletion is disabled from admin studio." }, { status: 405 });
  const table = tables[resource as keyof typeof tables];
  if (!table) return Response.json({ ok: false, error: "Unknown resource" }, { status: 404 });
  const current = await db.select().from(table).where(eq((table as any).id, Number(id))).limit(1);
  if (!current[0]) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  if (resource !== "players" && ((current[0] as any).status === "published" || (current[0] as any).releaseState === "published" || (current[0] as any).enabled === true)) return Response.json({ ok: false, error: "Published or active content must be archived before deletion." }, { status: 409 });
  if (resource !== "card-meta") {
    const impact = await analyzeContentReverseDependencies(resource, current[0]);
    if (impact.totalActiveReferences > 0) return Response.json({ ok: false, error: "Content has active reverse dependencies and cannot be deleted.", impact }, { status: 409 });
  }
  await db.delete(table).where(eq((table as any).id, Number(id)));
  await db.insert(adminAuditLogs).values({ action: "delete", resource, resourceId: Number(id), actor: actor.actorId, details: { role: actor.role } });
  return Response.json({ ok: true });
}
