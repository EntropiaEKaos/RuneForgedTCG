import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, cardAssets, cardCosmeticVariants } from "@/db/schema";
import { allCards } from "@/game/cards";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import { normalizeCardCosmeticInput } from "@/game/card-cosmetics";
import { adminRoleAllowed, getAdminSessionContext, unauthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

async function actorFor(req: NextRequest, role: "designer" | "publisher") {
  const actor = await getAdminSessionContext(req);
  if (!actor || !adminRoleAllowed(actor.role, role)) return null;
  return actor;
}

export async function GET(req: NextRequest) {
  const actor = await actorFor(req, "designer");
  if (!actor) return unauthorized();
  const defId = String(req.nextUrl.searchParams.get("defId") || "").trim();
  const rows = defId
    ? await db.select().from(cardCosmeticVariants).where(eq(cardCosmeticVariants.defId, defId)).orderBy(desc(cardCosmeticVariants.id))
    : await db.select().from(cardCosmeticVariants).orderBy(desc(cardCosmeticVariants.id)).limit(1000);
  return Response.json({ ok: true, rows, role: actor.role });
}

export async function POST(req: NextRequest) {
  const actor = await actorFor(req, "designer");
  if (!actor) return unauthorized();
  await ensureCustomCardsLoaded();
  const body = await req.json() as Record<string, unknown>;
  const normalized = normalizeCardCosmeticInput(body);
  if (!normalized.value) return Response.json({ ok: false, error: normalized.errors.join("; ") }, { status: 400 });
  if (!allCards().some((card) => card.defId === normalized.value!.defId)) return Response.json({ ok: false, error: "Unknown card" }, { status: 404 });
  const existing = await db.select({ id: cardCosmeticVariants.id }).from(cardCosmeticVariants).where(and(
    eq(cardCosmeticVariants.defId, normalized.value.defId),
    eq(cardCosmeticVariants.variantId, normalized.value.variantId),
  )).limit(1);
  if (existing.length) return Response.json({ ok: false, error: "Variant id already exists for this card" }, { status: 409 });
  const [row] = await db.transaction(async (tx) => {
    const inserted = await tx.insert(cardCosmeticVariants).values({
      ...normalized.value!,
      status: "draft",
      enabled: false,
      createdBy: actor.actorId,
      updatedBy: actor.actorId,
    }).returning();
    await tx.insert(adminAuditLogs).values({ action: "card.cosmetic.create", resource: "card-cosmetic", resourceId: inserted[0].id, actor: actor.actorId, details: { defId: inserted[0].defId, variantId: inserted[0].variantId } });
    return inserted;
  });
  return Response.json({ ok: true, row });
}

export async function PATCH(req: NextRequest) {
  const actor = await actorFor(req, "designer");
  if (!actor) return unauthorized();
  await ensureCustomCardsLoaded();
  const body = await req.json() as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ ok: false, error: "Valid id is required" }, { status: 400 });
  const [current] = await db.select().from(cardCosmeticVariants).where(eq(cardCosmeticVariants.id, id)).limit(1);
  if (!current) return Response.json({ ok: false, error: "Cosmetic variant not found" }, { status: 404 });
  const merged = { ...current, ...body, defId: current.defId, variantId: current.variantId };
  const normalized = normalizeCardCosmeticInput(merged);
  if (!normalized.value) return Response.json({ ok: false, error: normalized.errors.join("; ") }, { status: 400 });
  const requestedStatus = String(body.status ?? current.status);
  const requestedEnabled = body.enabled == null ? current.enabled : Boolean(body.enabled);
  if (!new Set(["draft", "published", "archived"]).has(requestedStatus)) return Response.json({ ok: false, error: "Invalid status" }, { status: 400 });
  const publishing = requestedStatus === "published" || requestedEnabled || current.status === "published" || current.enabled;
  if (publishing && !adminRoleAllowed(actor.role, "publisher")) return Response.json({ ok: false, error: "Publisher role required to change a live cosmetic" }, { status: 403 });
  if (requestedEnabled && requestedStatus !== "published") return Response.json({ ok: false, error: "Only published cosmetics may be enabled" }, { status: 400 });
  const [row] = await db.transaction(async (tx) => {
    const updated = await tx.update(cardCosmeticVariants).set({
      name: normalized.value!.name,
      kind: normalized.value!.kind,
      frameId: normalized.value!.frameId,
      finish: normalized.value!.finish,
      artUrl: normalized.value!.artUrl || null,
      animationUrl: normalized.value!.animationUrl || null,
      artCrop: normalized.value!.artCrop || {},
      edition: normalized.value!.edition || null,
      serialLimit: normalized.value!.serialLimit || null,
      acquisition: normalized.value!.acquisition,
      packEligible: normalized.value!.packEligible,
      dropWeight: normalized.value!.dropWeight,
      metadata: normalized.value!.metadata || {},
      status: requestedStatus,
      enabled: requestedEnabled,
      updatedBy: actor.actorId,
      updatedAt: new Date(),
    }).where(eq(cardCosmeticVariants.id, id)).returning();
    await tx.insert(adminAuditLogs).values({ action: "card.cosmetic.update", resource: "card-cosmetic", resourceId: id, actor: actor.actorId, details: { defId: current.defId, variantId: current.variantId, fromStatus: current.status, status: requestedStatus, enabled: requestedEnabled } });
    return updated;
  });
  return Response.json({ ok: true, row });
}

export async function DELETE(req: NextRequest) {
  const actor = await actorFor(req, "publisher");
  if (!actor) return unauthorized();
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return Response.json({ ok: false, error: "Valid id is required" }, { status: 400 });
  const [current] = await db.select().from(cardCosmeticVariants).where(eq(cardCosmeticVariants.id, id)).limit(1);
  if (!current) return Response.json({ ok: false, error: "Cosmetic variant not found" }, { status: 404 });
  const owned = await db.select({ id: cardAssets.id }).from(cardAssets).where(and(eq(cardAssets.defId, current.defId), eq(cardAssets.variantId, current.variantId))).limit(1);
  if (owned.length) {
    const [row] = await db.update(cardCosmeticVariants).set({ status: "archived", enabled: false, updatedBy: actor.actorId, updatedAt: new Date() }).where(eq(cardCosmeticVariants.id, id)).returning();
    await db.insert(adminAuditLogs).values({ action: "card.cosmetic.archive", resource: "card-cosmetic", resourceId: id, actor: actor.actorId, details: { defId: current.defId, variantId: current.variantId, reason: "owned-assets-exist" } });
    return Response.json({ ok: true, archived: true, row });
  }
  await db.transaction(async (tx) => {
    await tx.delete(cardCosmeticVariants).where(eq(cardCosmeticVariants.id, id));
    await tx.insert(adminAuditLogs).values({ action: "card.cosmetic.delete", resource: "card-cosmetic", resourceId: id, actor: actor.actorId, details: { defId: current.defId, variantId: current.variantId } });
  });
  return Response.json({ ok: true, deleted: true });
}
