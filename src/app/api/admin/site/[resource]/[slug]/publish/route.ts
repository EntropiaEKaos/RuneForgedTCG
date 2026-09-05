import { NextRequest } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, siteContent, siteContentVersions } from "@/db/schema";
import { getAdminSessionContext, isAdminAuthorized, unauthorized } from "@/lib/admin-auth";
import {
  canPublishSiteContent,
  isSiteContentResource,
  normalizeSiteSlug,
  parseExpectedSiteVersion,
  parseSiteLocale,
  sanitizeSiteChangeNote,
  siteContentLockKey,
} from "@/lib/site-content";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ resource: string; slug: string }> }) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();

  const raw = await params;
  if (!isSiteContentResource(raw.resource)) return Response.json({ ok: false, error: "Unknown site resource" }, { status: 404 });
  if (!canPublishSiteContent(actor.role, raw.resource)) return Response.json({ ok: false, error: `Role ${actor.role} cannot publish ${raw.resource}` }, { status: 403 });

  const slug = normalizeSiteSlug(raw.slug);
  if (!slug) return Response.json({ ok: false, error: "Invalid slug" }, { status: 400 });
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

    const [published] = await tx.update(siteContent).set({
      status: "published",
      version: existing.version + 1,
      updatedBy: actor.actorId,
      publishedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(siteContent.id, existing.id)).returning();

    await tx.insert(siteContentVersions).values({
      contentId: published.id,
      version: published.version,
      status: "published",
      snapshot: { payload: published.payload, seo: published.seo },
      actor: actor.actorId,
      changeNote: sanitizeSiteChangeNote(body.changeNote, "Published"),
    });
    await tx.insert(adminAuditLogs).values({
      action: "site_content.publish",
      resource: `site:${raw.resource}`,
      resourceId: published.id,
      actor: actor.actorId,
      details: { slug, locale, version: published.version, expectedVersion },
    });

    return { item: published };
  });

  if ("missing" in result) return Response.json({ ok: false, error: "Site content not found" }, { status: 404 });
  if ("conflict" in result) return Response.json({ ok: false, error: "Version conflict", currentVersion: result.currentVersion }, { status: 409 });
  return Response.json({ ok: true, item: result.item });
}
