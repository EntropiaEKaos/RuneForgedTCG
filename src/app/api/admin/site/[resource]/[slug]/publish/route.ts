import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, siteContent, siteContentVersions } from "@/db/schema";
import { getAdminSessionContext, isAdminAuthorized, unauthorized } from "@/lib/admin-auth";
import { canPublishSiteContent, isSiteContentResource, normalizeLocale, normalizeSiteSlug } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ resource: string; slug: string }> }) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();

  const raw = await params;
  if (!isSiteContentResource(raw.resource)) return Response.json({ ok: false, error: "Unknown site resource" }, { status: 404 });
  if (!canPublishSiteContent(actor.role, raw.resource)) return Response.json({ ok: false, error: `Role ${actor.role} cannot publish ${raw.resource}` }, { status: 403 });

  const slug = normalizeSiteSlug(raw.slug);
  const body = await req.json().catch(() => ({})) as { locale?: string; changeNote?: string };
  const locale = normalizeLocale(body.locale);
  if (!slug) return Response.json({ ok: false, error: "Invalid slug" }, { status: 400 });

  const item = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(siteContent).where(and(
      eq(siteContent.resource, raw.resource), eq(siteContent.slug, slug), eq(siteContent.locale, locale),
    )).limit(1);
    if (!existing) return null;

    const nextVersion = existing.version + 1;
    const [published] = await tx.update(siteContent).set({
      status: "published",
      version: nextVersion,
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
      changeNote: typeof body.changeNote === "string" ? body.changeNote.slice(0, 500) : "Published",
    });
    await tx.insert(adminAuditLogs).values({
      action: "site_content.publish",
      resource: `site:${raw.resource}`,
      resourceId: published.id,
      actor: actor.actorId,
      details: { slug, locale, version: published.version },
    });
    return published;
  });

  if (!item) return Response.json({ ok: false, error: "Site content not found" }, { status: 404 });
  return Response.json({ ok: true, item });
}
