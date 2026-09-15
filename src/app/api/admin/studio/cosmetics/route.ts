import { NextRequest } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, adminGameDefinitions, cardAssets, cardCosmeticVariants, customCards, playerCardCosmeticPreferences } from "@/db/schema";
import { baseCardsOnly } from "@/game/cards";
import { normalizeCardCosmeticInput } from "@/game/card-cosmetics";
import { adminRoleAllowed, getAdminSessionContext, unauthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
const FRAME_PRESET_DOMAIN = "card-frame-presets";

async function actorFor(req: NextRequest, role: "designer" | "publisher") {
  const actor = await getAdminSessionContext(req);
  if (!actor || !adminRoleAllowed(actor.role, role)) return null;
  return actor;
}

async function cardExistsForCosmeticAuthoring(defId: string): Promise<boolean> {
  if (baseCardsOnly().some((card) => card.defId === defId)) return true;
  const [saved] = await db.select({ id: customCards.id }).from(customCards).where(eq(customCards.defId, defId)).limit(1);
  return Boolean(saved);
}

async function frameAvailableForLiveCosmetic(frameId: string): Promise<boolean> {
  if (frameId === "default") return true;
  const [frame] = await db.select({ id: adminGameDefinitions.id }).from(adminGameDefinitions).where(and(
    eq(adminGameDefinitions.domain, FRAME_PRESET_DOMAIN),
    eq(adminGameDefinitions.key, frameId),
    eq(adminGameDefinitions.status, "published"),
    eq(adminGameDefinitions.enabled, true),
  )).limit(1);
  return Boolean(frame);
}

async function clearPreferencesForVariant(tx: any, defId: string, variantId: string) {
  const assets = await tx.select({ id: cardAssets.id }).from(cardAssets).where(and(
    eq(cardAssets.defId, defId),
    eq(cardAssets.variantId, variantId),
  ));
  if (!assets.length) return 0;
  const ids = assets.map((asset: { id: number }) => asset.id);
  const removed = await tx.delete(playerCardCosmeticPreferences)
    .where(inArray(playerCardCosmeticPreferences.assetId, ids))
    .returning({ id: playerCardCosmeticPreferences.id });
  return removed.length;
}

async function validateLivePackPool(defId: string, currentId: number, nextWeight: number) {
  const siblings = await db.select({
    id: cardCosmeticVariants.id,
    dropWeight: cardCosmeticVariants.dropWeight,
    acquisition: cardCosmeticVariants.acquisition,
    packEligible: cardCosmeticVariants.packEligible,
    status: cardCosmeticVariants.status,
    enabled: cardCosmeticVariants.enabled,
  }).from(cardCosmeticVariants).where(eq(cardCosmeticVariants.defId, defId));
  const used = siblings
    .filter((row) => row.id !== currentId && row.status === "published" && row.enabled && row.packEligible && row.acquisition === "pack")
    .reduce((sum, row) => sum + Math.max(0, row.dropWeight), 0);
  return used + Math.max(0, nextWeight) <= 1_000_000;
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
  const body = await req.json() as Record<string, unknown>;
  const normalized = normalizeCardCosmeticInput(body);
  if (!normalized.value) return Response.json({ ok: false, error: normalized.errors.join("; ") }, { status: 400 });
  if (!(await cardExistsForCosmeticAuthoring(normalized.value.defId))) return Response.json({ ok: false, error: "Unknown card" }, { status: 404 });
  const existing = await db.select({ id: cardCosmeticVariants.id }).from(cardCosmeticVariants).where(and(
    eq(cardCosmeticVariants.defId, normalized.value.defId),
    eq(cardCosmeticVariants.variantId, normalized.value.variantId),
  )).limit(1);
  if (existing.length) return Response.json({ ok: false, error: "Variant id already exists for this card" }, { status: 409 });
  const [row] = await db.transaction(async (tx) => {
    const inserted = await tx.insert(cardCosmeticVariants).values({
      ...normalized.value!,
      artCrop: normalized.value!.artCrop || {},
      metadata: normalized.value!.metadata || {},
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
  if (requestedEnabled && !(await frameAvailableForLiveCosmetic(normalized.value.frameId))) {
    return Response.json({ ok: false, error: "Frame preset must be published and enabled before a cosmetic can go LIVE" }, { status: 409 });
  }
  if (requestedEnabled && normalized.value.packEligible && normalized.value.acquisition === "pack") {
    const poolValid = await validateLivePackPool(current.defId, id, normalized.value.dropWeight);
    if (!poolValid) return Response.json({ ok: false, error: "Enabled cosmetic drop weights for this card would exceed 1,000,000 PPM (100%)" }, { status: 409 });
  }
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
    let clearedPreferences = 0;
    if (!requestedEnabled || requestedStatus !== "published") clearedPreferences = await clearPreferencesForVariant(tx, current.defId, current.variantId);
    await tx.insert(adminAuditLogs).values({ action: "card.cosmetic.update", resource: "card-cosmetic", resourceId: id, actor: actor.actorId, details: { defId: current.defId, variantId: current.variantId, fromStatus: current.status, status: requestedStatus, enabled: requestedEnabled, clearedPreferences } });
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
    const [row] = await db.transaction(async (tx) => {
      const updated = await tx.update(cardCosmeticVariants).set({ status: "archived", enabled: false, updatedBy: actor.actorId, updatedAt: new Date() }).where(eq(cardCosmeticVariants.id, id)).returning();
      const clearedPreferences = await clearPreferencesForVariant(tx, current.defId, current.variantId);
      await tx.insert(adminAuditLogs).values({ action: "card.cosmetic.archive", resource: "card-cosmetic", resourceId: id, actor: actor.actorId, details: { defId: current.defId, variantId: current.variantId, reason: "owned-assets-exist", clearedPreferences } });
      return updated;
    });
    return Response.json({ ok: true, archived: true, row });
  }
  await db.transaction(async (tx) => {
    await clearPreferencesForVariant(tx, current.defId, current.variantId);
    await tx.delete(cardCosmeticVariants).where(eq(cardCosmeticVariants.id, id));
    await tx.insert(adminAuditLogs).values({ action: "card.cosmetic.delete", resource: "card-cosmetic", resourceId: id, actor: actor.actorId, details: { defId: current.defId, variantId: current.variantId } });
  });
  return Response.json({ ok: true, deleted: true });
}
