import { NextRequest } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, siteContent, siteContentVersions } from "@/db/schema";
import { getAdminSessionContext, isAdminAuthorized, unauthorized } from "@/lib/admin-auth";
import {
  SITE_CONTENT_PAYLOAD_MAX_BYTES,
  SITE_CONTENT_SEO_MAX_BYTES,
  canEditSiteContent,
  canReadSiteContent,
  isSiteContentResource,
  parseExpectedSiteVersion,
  parseSiteLocale,
  sanitizeSiteChangeNote,
  siteContentLockKey,
  normalizeSiteSlug,
  validateSiteDocument,
} from "@/lib/site-content";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ resource: string; slug: string }> }) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();

  const raw = await params;
  if (!isSiteContentResource(raw.resource)) return Response.json({ ok: false, error: "Unknown site resource" }, { status: 404 });
  if (!canReadSiteContent(actor.role, raw.resource)) return Response.json({ ok: false, error: `Role ${actor.role} cannot read ${raw.resource}` }, { status: 403 });

  const slug = normalizeSiteSlug(raw.slug);
  const locale = parseSiteLocale(req.nextUrl.searchParams.get("locale"));
  if (!slug) return Response.json({ ok: false, error: "Invalid slug" }, { status: 400 });
  if (!locale) return Response.json({ ok: false, error: "Invalid locale" }, { status: 400 });

  const [item] = await db.select().from(siteContent).where(and(
    eq(siteContent.resource, raw.resource),
    eq(siteContent.slug, slug),
    eq(siteContent.locale, locale),
  )).limit(1);
  if (!item) return Response.json({ ok: false, error: "Site content not found" }, { status: 404 });

  const versions = await db.select().from(siteContentVersions)
    .where(eq(siteContentVersions.contentId, item.id))
    .orderBy(desc(siteContentVersions.version));

  return Response.json({ ok: true, item, versions });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ resource: string; slug: string }> }) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();

  const raw = await params;
  if (!isSiteContentResource(raw.resource)) return Response.json({ ok: false, error: "Unknown site resource" }, { status: 404 });
  if (!canEditSiteContent(actor.role, raw.resource)) return Response.json({ ok: false, error: `Role ${actor.role} cannot edit ${raw.resource}` }, { status: 403 });

  const slug = normalizeSiteSlug(raw.slug);
  if (!slug) return Response.json({ ok: false, error: "Invalid slug" }, { status: 400 });

  const body = await req.json().catch(() => null) as null | {
    locale?: unknown;
    payload?: unknown;
    seo?: unknown;
    changeNote?: unknown;
    status?: unknown;
    expectedVersion?: unknown;
  };
  if (!body) return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });

  const locale = parseSiteLocale(body.locale);
  if (!locale) return Response.json({ ok: false, error: "Invalid locale" }, { status: 400 });
  const expectedVersion = parseExpectedSiteVersion(body.expectedVersion);
  if (expectedVersion === null) return Response.json({ ok: false, error: "expectedVersion must be a non-negative integer" }, { status: 400 });

  const payloadError = validateSiteDocument(body.payload, SITE_CONTENT_PAYLOAD_MAX_BYTES, "payload");
  if (payloadError) return Response.json({ ok: false, error: payloadError }, { status: 400 });
  const seo = body.seo ?? {};
  const seoError = validateSiteDocument(seo, SITE_CONTENT_SEO_MAX_BYTES, "seo");
  if (seoError) return Response.json({ ok: false, error: seoError }, { status: 400 });

  const requestedStatus = body.status === "review" ? "review" : "draft";
  const changeNote = sanitizeSiteChangeNote(body.changeNote);
  const lockKey = siteContentLockKey(raw.resource, slug, locale);

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
    const [existing] = await tx.select().from(siteContent).where(and(
      eq(siteContent.resource, raw.resource),
      eq(siteContent.slug, slug),
      eq(siteContent.locale, locale),
    )).limit(1).for("update");

    const currentVersion = existing?.version ?? 0;
    if (expectedVersion !== currentVersion) return { conflict: true as const, currentVersion };

    const nextVersion = currentVersion + 1;
    let saved;
    if (existing) {
      [saved] = await tx.update(siteContent).set({
        payload: body.payload,
        seo,
        status: requestedStatus,
        version: nextVersion,
        updatedBy: actor.actorId,
        publishedAt: null,
        updatedAt: new Date(),
      }).where(eq(siteContent.id, existing.id)).returning();
    } else {
      [saved] = await tx.insert(siteContent).values({
        resource: raw.resource,
        slug,
        locale,
        payload: body.payload as Record<string, unknown>,
        seo: seo as Record<string, unknown>,
        status: requestedStatus,
        version: nextVersion,
        updatedBy: actor.actorId,
      }).returning();
    }

    await tx.insert(siteContentVersions).values({
      contentId: saved.id,
      version: saved.version,
      status: saved.status,
      snapshot: { payload: saved.payload, seo: saved.seo },
      actor: actor.actorId,
      changeNote,
    });
    await tx.insert(adminAuditLogs).values({
      action: existing ? "site_content.update" : "site_content.create",
      resource: `site:${raw.resource}`,
      resourceId: saved.id,
      actor: actor.actorId,
      details: { slug, locale, version: saved.version, status: saved.status, expectedVersion, changeNote },
    });

    return { conflict: false as const, item: saved };
  });

  if (result.conflict) return Response.json({
    ok: false,
    error: "Version conflict",
    currentVersion: result.currentVersion,
  }, { status: 409 });

  return Response.json({ ok: true, item: result.item });
}
