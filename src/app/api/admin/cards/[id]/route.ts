import { NextRequest } from "next/server";
import { db } from "@/db";
import { customCards, cardCatalogMeta, adminAuditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, adminRoleAllowed } from "@/lib/admin-auth";
import { refreshCustomCardCache } from "@/game/catalog";
import type { CardDef } from "@/game/types";
import { validateAuthorableCard as validateCard } from "@/game/card-authoring";
import { analyzeCardImpact } from "@/lib/card-impact";
import { removeCardArtUsages } from "@/lib/card-art-integrity";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req); if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, "designer")) return Response.json({ ok: false, error: `Role ${actor.role} cannot edit cards` }, { status: 403 });
  try {
    const dbId = Number((await ctx.params).id); if (!Number.isFinite(dbId)) return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
    const body = await req.json(); const rawPatch = body?.card && typeof body.card === "object" ? body.card : body; const metadata = body?.metadata && typeof body.metadata === "object" ? body.metadata : null;
    const [existing] = await db.select().from(customCards).where(eq(customCards.id, dbId)).limit(1); if (!existing) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    if (existing.enabled) return Response.json({ ok: false, error: "Active cards must be archived before editing." }, { status: 409 });
    const candidate: Partial<CardDef> = { ...(existing.data as CardDef), ...rawPatch, defId: existing.defId }; const validation = validateCard(candidate); if (!validation.ok) return Response.json({ ok: false, error: validation.error }, { status: 400 }); const next = validation.card;
    const row = await db.transaction(async tx => {
      const [updated] = await tx.update(customCards).set({ name: next.name, region: next.region, type: next.type, cost: next.cost, enabled: false, data: next, updatedAt: new Date() }).where(eq(customCards.id, dbId)).returning();
      if (metadata) await tx.insert(cardCatalogMeta).values({ defId: existing.defId, collectionId: metadata.collectionId ? Number(metadata.collectionId) : null, tags: Array.isArray(metadata.tags) ? metadata.tags : [], classKeys: Array.isArray(metadata.classKeys) ? metadata.classKeys : next.classes || [], raceKeys: Array.isArray(metadata.raceKeys) ? metadata.raceKeys : next.race ? [next.race] : [], releaseState: "draft", notes: metadata.notes ? String(metadata.notes).slice(0,1000) : null }).onConflictDoUpdate({ target: cardCatalogMeta.defId, set: { collectionId: metadata.collectionId ? Number(metadata.collectionId) : null, tags: Array.isArray(metadata.tags) ? metadata.tags : [], classKeys: Array.isArray(metadata.classKeys) ? metadata.classKeys : next.classes || [], raceKeys: Array.isArray(metadata.raceKeys) ? metadata.raceKeys : next.race ? [next.race] : [], notes: metadata.notes ? String(metadata.notes).slice(0,1000) : null, updatedAt: new Date() } });
      return updated;
    });
    await refreshCustomCardCache(); return Response.json({ ok: true, card: { ...(row.data as CardDef), dbId: row.id, enabled: row.enabled, source: "custom" } });
  } catch { return Response.json({ ok: false, error: "Internal server error" }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, "publisher")) return Response.json({ ok: false, error: `Role ${actor.role} cannot delete cards` }, { status: 403 });
  try {
    const { id } = await ctx.params;
    const dbId = Number(id);
    if (!Number.isFinite(dbId)) {
      return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }
    const [existing] = await db.select().from(customCards).where(eq(customCards.id, dbId)).limit(1);
    if (!existing) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    if (existing.enabled) return Response.json({ ok: false, error: "Active cards cannot be deleted. Archive the card first." }, { status: 409 });
    const defId = existing.defId;
    const impact = await analyzeCardImpact(defId);
    if (impact.totalActiveReferences > 0 || impact.historicalReferences > 0) {
      return Response.json({ ok: false, error: "Card is referenced by active content, stored decks or match history and cannot be hard-deleted. Keep it archived.", impact }, { status: 409 });
    }
    await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(customCards).where(eq(customCards.id, dbId)).limit(1).for("update");
      if (!locked || locked.enabled) throw new Error("CARD_DELETE_STATE_CHANGED");
      const removedAssetUsages = await removeCardArtUsages(tx, defId);
      await tx.delete(cardCatalogMeta).where(eq(cardCatalogMeta.defId, defId));
      await tx.delete(customCards).where(eq(customCards.id, dbId));
      await tx.insert(adminAuditLogs).values({ action: "delete", resource: "cards", resourceId: dbId, actor: actor.actorId, details: { defId, removedAssetUsages, impact } });
    });
    await refreshCustomCardCache();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
