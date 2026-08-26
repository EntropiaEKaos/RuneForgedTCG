import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { adminAuditLogs, adminGameDefinitions } from "@/db/schema";
import { getAdminSessionContext, unauthorized } from "@/lib/admin-auth";
import { deleteAdminAsset, detectAssetType, storeAdminAsset, validateAssetPayload } from "@/lib/asset-storage";
import { generateImageDerivatives } from "@/lib/image-derivatives";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";
const MAX_ASSET_BYTES = 12_000_000;

export async function POST(req: NextRequest) {
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (actor.role !== "admin") return Response.json({ ok: false, error: "Admin role required" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ ok: false, error: "File is required" }, { status: 400 });
  if (file.size < 1 || file.size > MAX_ASSET_BYTES) return Response.json({ ok: false, error: "Asset must be between 1 byte and 12 MB" }, { status: 413 });

  // Read once, then validate by magic bytes instead of trusting client MIME.
  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = detectAssetType(bytes);
  if (!detected) return Response.json({ ok: false, error: "Unsupported or invalid media file" }, { status: 415 });
  const metadata = validateAssetPayload(bytes, detected);
  if (!metadata) return Response.json({ ok: false, error: "Media payload is truncated, malformed, or exceeds safe dimensions" }, { status: 415 });

  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  const filename = `${digest.slice(0, 24)}.${detected.extension}`;
  const originalStored = await storeAdminAsset(filename, bytes, detected.mimeType);
  const url = originalStored.url;
  const createdNames = originalStored.created ? [filename] : [];
  const derivativeResult = await generateImageDerivatives(bytes, detected);
  const derivativeRows: Record<string, { url:string; mimeType:string; size:number; width:number; height:number; sha256:string }> = {};
  try {
    for (const derivative of derivativeResult.derivatives) {
      const derivativeFilename = `${derivative.sha256.slice(0, 24)}.${derivative.extension}`;
      const derivativeStored = await storeAdminAsset(derivativeFilename, derivative.bytes, derivative.mimeType);
      if (derivativeStored.created) createdNames.push(derivativeFilename);
      derivativeRows[derivative.format] = {
        url: derivativeStored.url, mimeType: derivative.mimeType, size: derivative.size,
        width: derivative.width, height: derivative.height, sha256: derivative.sha256,
      };
    }
  } catch (error) {
    await Promise.all(createdNames.map((name) => deleteAdminAsset(name).catch(() => {})));
    throw error;
  }
  const key = `asset-${digest.slice(0, 16)}`;
  const originalVariant = { url, mimeType: detected.mimeType, size: bytes.length, sha256: digest, ...metadata };
  const payload = {
    type: detected.kind,
    url,
    preferredUrl: derivativeRows.webp?.url || url,
    variants: { original: originalVariant, ...derivativeRows },
    optimization: { status: derivativeResult.status, reason: derivativeResult.reason || null, maxDimension: derivativeResult.maxDimension, encoder: "sharp", generatedAt: new Date().toISOString() },
    mimeType: detected.mimeType,
    size: bytes.length,
    sha256: digest,
    originalName: String(file.name || "").slice(0, 200),
    ...metadata,
    tags: [],
    usages: [],
  };
  let row: typeof adminGameDefinitions.$inferSelect;
  try {
    row = await db.transaction(async (tx) => {
      const inserted = await tx.insert(adminGameDefinitions).values({
        domain: "asset-library", key, name: String(file.name || filename).slice(0, 120),
        description: "Uploaded through Total Control", dangerLevel: "safe", schemaVersion: 1, payload, status: "draft", enabled: false,
      }).onConflictDoNothing({ target: [adminGameDefinitions.domain, adminGameDefinitions.key] }).returning();

      let saved = inserted[0];
      let duplicate = false;
      if (!saved) {
        duplicate = true;
        const [existing] = await tx.select().from(adminGameDefinitions).where(and(
          eq(adminGameDefinitions.domain, "asset-library"),
          eq(adminGameDefinitions.key, key),
        )).limit(1).for("update");
        if (!existing) throw new Error("Asset library conflict could not be resolved");
        const oldPayload = existing.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
          ? existing.payload as Record<string, unknown> : {};
        const mergedPayload = {
          ...payload,
          tags: Array.isArray(oldPayload.tags) ? oldPayload.tags : payload.tags,
          usages: Array.isArray(oldPayload.usages) ? oldPayload.usages : payload.usages,
        };
        [saved] = await tx.update(adminGameDefinitions).set({ payload: mergedPayload, updatedAt: new Date() }).where(eq(adminGameDefinitions.id, existing.id)).returning();
      }
      if (!saved) throw new Error("Asset library row was not persisted");
      await tx.insert(adminAuditLogs).values({
        action: "asset.upload", resource: "asset-library", resourceId: saved.id, actor: actor.actorId,
        details: { mimeType: detected.mimeType, size: bytes.length, sha256: digest, derivatives: Object.keys(derivativeRows), optimizationStatus: derivativeResult.status, duplicate, storage: process.env.ASSET_STORAGE_MODE || (process.env.NODE_ENV === "production" ? "s3" : "local") },
      });
      return saved;
    });
  } catch (error) {
    await Promise.all(createdNames.map((name) => deleteAdminAsset(name).catch(() => {})));
    throw error;
  }
  return Response.json({ ok: true, row, url });
}
