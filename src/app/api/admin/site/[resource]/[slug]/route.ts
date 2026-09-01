import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, siteContent, siteContentVersions } from "@/db/schema";
import { getAdminSessionContext, isAdminAuthorized, unauthorized } from "@/lib/admin-auth";
import { canEditSiteContent, isSiteContentResource, normalizeLocale, normalizeSiteSlug } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ resource: string; slug: string }> }) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();

  const raw = await params;
  if (!isSiteContentResource(raw.resource)) return Response.json({ ok: false, error: "Unknown site resource" }, { status: 404 });
  const slug = normalizeSiteSlug(raw.slug);
  const locale = normalizeLocale(req.nextUrl.searchParams.get("locale"));
  if (!slug) return Response.json({ ok: false, error: "Invalid slug" }, { status: 400 });

  const [item] = await db.select().from(siteContent).where(and(
    eq(siteContent.resource, raw.resource), eq(siteContent.slug, slug), eq(siteContent.locale, locale),
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
  const body = await req.json().catch(() => null) as null | { locale?: string; payload?: unknown; seo?: unknown; changeNote?: string; status?: string };
  if (!body || typeof body.payload !== "object" || body.payload === null || Array.isArray(body.payload)) {
    return Response.json({ ok: false, error: "payload must be an object" }, { status: 400 });
  }
  const locale = normalizeLocale(body.locale);
  const seo = body.seo && typeof body.seo === "object" && !Array.isArray(body.seo) ? body.seo : {};
  const requestedStatus = body.status === "review" ? "review" : "draft";
  const changeNote = typeof body.changeNote === "string" ? body.changeNote.slice(0, 500) : "";

  const item = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(siteContent).where(and(
      eq(siteContent.resource, raw.resource), eq(siteContent.slug, slug), eq(siteContent.locale, locale),
    )).limit(1);

    const nextVersion = (existing?.version ?? 0) + 1;
    let saved;
    if (existing) {
      [saved] = await tx.update(siteContent).set({
        payload: body.payload,
        seo,
        status: requestedStatus,
        version: nextVersion,
        updatedBy: actor.actorId,
        updatedAt: new Date(),
      }).where(eq(siteContent.id, existing.id)).returning();
    } else {
      [saved] = await tx.insert(siteContent).values({
        resource: raw.resource,
        slug,
        locale,
        payload: body.payload,
        seo,
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
      details: { slug, locale, version: saved.version, status: saved.status, changeNote },
    });
    return saved;
  });

  return Response.json({ ok: true, item });
}
