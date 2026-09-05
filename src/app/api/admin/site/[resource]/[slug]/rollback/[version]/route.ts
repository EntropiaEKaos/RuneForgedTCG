import { NextRequest } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, siteContent, siteContentVersions } from "@/db/schema";
import { getAdminSessionContext, isAdminAuthorized, unauthorized } from "@/lib/admin-auth";
import {
  canPublishSiteContent,
  isPlainRecord,
  isSiteContentResource,
  normalizeSiteSlug,
  parseExpectedSiteVersion,
  parseSiteLocale,
  sanitizeSiteChangeNote,
  siteContentLockKey,
} from "@/lib/site-content";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ resource: string; slug: string; version: string }> }) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();

  const raw = await params;
  if (!isSiteContentResource(raw.resource)) return Response.json({ ok: false, error: "Unknown site resource" }, { status: 404 });
  if (!canPublishSiteContent(actor.role, raw.resource)) return Response.json({ ok: false, error: `Role ${actor.role} cannot rollback ${raw.resource}` }, { status: 403 });

  const targetVersion = Number(raw.version);
  const slug = normalizeSiteSlug(raw.slug);
  if (!Number.isInteger(targetVersion) || targetVersion < 1 || !slug) return Response.json({ ok: false, error: "Invalid rollback target" }, { status: 400 });

  const body = await req.json().catch(() => ({})) as { locale?: unknown; expectedVersion?: unknown; changeNote?: unknown };
  const locale = parseSiteLocale(body.locale);
  if (!locale) return Response.json({ ok: false, error: "Invalid locale" }, { status: 400 });
  const expectedVersion = parseExpectedSiteVersion(body.expectedVersion);
  if (expectedVersion === null || expectedVersion < 1) return Response.json({ ok: false, error: "expectedVersion must be a positive integer" }, { status: 400 });

  const lockKey = siteContentLockKey(raw.resource, slug, locale);
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
    const [existing] = await tx.select().from(siteContent).where(and(
      eq(siteContent.resource, raw.resource),
      eq(siteContent.slug, slug),
      eq(siteContent.locale, locale),
    )).limit(1).for("update");
    if (!existing) return { missing: true as const };
    if (existing.version !== expectedVersion) return { conflict: true as const, currentVersion: existing.version };

    const [target] = await tx.select().from(siteContentVersions).where(and(
      eq(siteContentVersions.contentId, existing.id),
      eq(siteContentVersions.version, targetVersion),
    )).limit(1);
    if (!target) return { versionMissing: true as const };

    const snapshot = isPlainRecord(target.snapshot) ? target.snapshot : {};
    const payload = isPlainRecord(snapshot.payload) ? snapshot.payload : {};
    const seo = isPlainRecord(snapshot.seo) ? snapshot.seo : {};
    const [restored] = await tx.update(siteContent).set({
      payload,
      seo,
      status: "draft",
      version: existing.version + 1,
      updatedBy: actor.actorId,
      publishedAt: null,
      updatedAt: new Date(),
    }).where(eq(siteContent.id, existing.id)).returning();

    await tx.insert(siteContentVersions).values({
      contentId: restored.id,
      version: restored.version,
      status: "draft",
      snapshot: { payload: restored.payload, seo: restored.seo },
      actor: actor.actorId,
      changeNote: sanitizeSiteChangeNote(body.changeNote, `Rollback from version ${targetVersion}`),
    });
    await tx.insert(adminAuditLogs).values({
      action: "site_content.rollback",
      resource: `site:${raw.resource}`,
      resourceId: restored.id,
      actor: actor.actorId,
      details: { slug, locale, fromVersion: targetVersion, version: restored.version, expectedVersion },
    });

    return { item: restored };
  });

  if ("missing" in result) return Response.json({ ok: false, error: "Site content not found" }, { status: 404 });
  if ("versionMissing" in result) return Response.json({ ok: false, error: "Version not found" }, { status: 404 });
  if ("conflict" in result) return Response.json({ ok: false, error: "Version conflict", currentVersion: result.currentVersion }, { status: 409 });
  return Response.json({ ok: true, item: result.item });
}
