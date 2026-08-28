import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, adminGameDefinitions, cardCatalogMeta } from "@/db/schema";
import { allCards } from "@/game/cards";
import { ensureCustomCardsLoaded, refreshCustomCardCache } from "@/game/catalog";
import { adminRoleAllowed, getAdminSessionContext, unauthorized } from "@/lib/admin-auth";
import { removeCardArtUsages } from "@/lib/card-art-integrity";

export const dynamic = "force-dynamic";

function safeCrop(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const x = Math.max(0, Math.min(1, Number(source.x ?? .5)));
  const y = Math.max(0, Math.min(1, Number(source.y ?? .5)));
  const scale = Math.max(1, Math.min(2.5, Number(source.scale ?? 1)));
  return { x: Number.isFinite(x) ? x : .5, y: Number.isFinite(y) ? y : .5, scale: Number.isFinite(scale) ? scale : 1 };
}
function safeAssetUrl(value: unknown) {
  const url = typeof value === "string" ? value.trim() : "";
  return /^\/(?!\/)/.test(url) || /^https:\/\//i.test(url) ? url : "";
}

function safeVariants(payload: Record<string, unknown>) {
  const raw = payload.variants && typeof payload.variants === "object" && !Array.isArray(payload.variants) ? payload.variants as Record<string, unknown> : {};
  const pick = (key: string) => {
    const item = raw[key] && typeof raw[key] === "object" && !Array.isArray(raw[key]) ? raw[key] as Record<string, unknown> : {};
    const url = safeAssetUrl(item.url);
    return url ? { url, mimeType: String(item.mimeType || ""), size: Number(item.size || 0), width: Number(item.width || 0), height: Number(item.height || 0) } : null;
  };
  return { original: pick("original"), webp: pick("webp"), avif: pick("avif") };
}

function selectVariantUrl(payload: Record<string, unknown>, requested: unknown): { url: string; variant: "original" | "webp" | "avif" } | null {
  const variants = safeVariants(payload);
  const choice = String(requested || "auto").toLowerCase();
  if (choice === "avif" && variants.avif) return { url: variants.avif.url, variant: "avif" };
  if ((choice === "webp" || choice === "auto") && variants.webp) return { url: variants.webp.url, variant: "webp" };
  if (choice === "original" && variants.original) return { url: variants.original.url, variant: "original" };
  const fallback = safeAssetUrl(payload.preferredUrl) || safeAssetUrl(payload.url);
  return fallback ? { url: fallback, variant: variants.webp?.url === fallback ? "webp" : "original" } : null;
}

export async function GET(req: NextRequest) {
  const actor = await getAdminSessionContext(req);
  if (!actor || !adminRoleAllowed(actor.role, "designer")) return unauthorized();
  await ensureCustomCardsLoaded();
  const [meta, assetRows] = await Promise.all([
    db.select().from(cardCatalogMeta),
    db.select().from(adminGameDefinitions).where(eq(adminGameDefinitions.domain, "asset-library")),
  ]);
  const byDef = new Map(meta.map((row) => [row.defId, row]));
  const cards = allCards().filter((card) => card.collectible !== false).map((card) => {
    const row = byDef.get(card.defId);
    const editorial = safeAssetUrl(row?.artUrl);
    return { defId: card.defId, name: card.name, region: card.region, type: card.type, rarity: card.rarity, art: editorial || card.art || null, editorialArt: editorial || null, crop: row?.artCrop || {}, missing: !(editorial || card.art) };
  }).sort((a, b) => Number(b.missing) - Number(a.missing) || a.region.localeCompare(b.region) || a.name.localeCompare(b.name));
  const assets = assetRows.map((row) => ({ id: row.id, key: row.key, name: row.name, status: row.status, enabled: row.enabled, payload: row.payload as Record<string, unknown> }))
    .filter((row) => row.payload?.type === "image" && safeAssetUrl(row.payload?.url))
    .map((row) => {
      const variants = safeVariants(row.payload);
      const selected = selectVariantUrl(row.payload, "auto");
      return { id: row.id, key: row.key, name: row.name, status: row.status, url: safeAssetUrl(row.payload.url), preferredUrl: selected?.url || safeAssetUrl(row.payload.url), preferredVariant: selected?.variant || "original", variants, optimization: row.payload.optimization || null, mimeType: String(row.payload.mimeType || ""), width: Number(row.payload.width || 0), height: Number(row.payload.height || 0), size: Number(row.payload.size || 0) };
    });
  const missing = cards.filter((card) => card.missing).length;
  return Response.json({ ok: true, coverage: { total: cards.length, withArt: cards.length - missing, missing, percent: cards.length ? Math.round(((cards.length - missing) / cards.length) * 1000) / 10 : 100 }, cards, assets });
}

export async function POST(req: NextRequest) {
  const actor = await getAdminSessionContext(req);
  if (!actor || !adminRoleAllowed(actor.role, "publisher")) return unauthorized();
  await ensureCustomCardsLoaded();
  const body = await req.json();
  const defId = String(body.defId || "").trim();
  if (!defId || !allCards().some((card) => card.defId === defId)) return Response.json({ ok: false, error: "Unknown card" }, { status: 404 });
  const [meta] = await db.select().from(cardCatalogMeta).where(eq(cardCatalogMeta.defId, defId)).limit(1);
  if (!meta) return Response.json({ ok: false, error: "Card has no catalog metadata/collection assignment" }, { status: 409 });

  if (body.action === "clear") {
    await db.transaction(async (tx) => {
      await tx.update(cardCatalogMeta).set({ artUrl: null, artCrop: {}, updatedAt: new Date() }).where(eq(cardCatalogMeta.id, meta.id));
      const removedAssetUsages = await removeCardArtUsages(tx, defId);
      await tx.insert(adminAuditLogs).values({ action: "card.art.clear", resource: "card-meta", resourceId: meta.id, actor: actor.actorId, details: { defId, removedAssetUsages } });
    });
    await refreshCustomCardCache();
    return Response.json({ ok: true, defId, artUrl: null });
  }

  const assetId = Number(body.assetId);
  if (!Number.isInteger(assetId) || assetId < 1) return Response.json({ ok: false, error: "Valid image assetId is required" }, { status: 400 });
  const [asset] = await db.select().from(adminGameDefinitions).where(eq(adminGameDefinitions.id, assetId)).limit(1);
  if (!asset || asset.domain !== "asset-library") return Response.json({ ok: false, error: "Image asset not found" }, { status: 404 });
  const payload = asset.payload as Record<string, unknown>;
  const selectedVariant = payload?.type === "image" ? selectVariantUrl(payload, body.variant) : null;
  const artUrl = selectedVariant?.url || "";
  if (!artUrl) return Response.json({ ok: false, error: "Asset is not a valid image" }, { status: 409 });
  const crop = safeCrop(body.crop);
  await db.transaction(async (tx) => {
    await tx.update(cardCatalogMeta).set({ artUrl, artCrop: crop, updatedAt: new Date() }).where(eq(cardCatalogMeta.id, meta.id));
    await removeCardArtUsages(tx, defId, asset.id);
    const usages = Array.isArray(payload.usages) ? payload.usages.filter((usage) => !(usage && typeof usage === "object" && (usage as Record<string, unknown>).type === "card-art" && (usage as Record<string, unknown>).defId === defId)) : [];
    usages.push({ type: "card-art", defId, crop });
    await tx.update(adminGameDefinitions).set({ payload: { ...payload, usages }, updatedAt: new Date() }).where(eq(adminGameDefinitions.id, asset.id));
    await tx.insert(adminAuditLogs).values({ action: "card.art.assign", resource: "card-meta", resourceId: meta.id, actor: actor.actorId, details: { defId, assetId, artUrl, crop, variant: selectedVariant?.variant || "original" } });
  });
  await refreshCustomCardCache();
  return Response.json({ ok: true, defId, artUrl, crop, variant: selectedVariant?.variant || "original" });
}
