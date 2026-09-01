import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, siteContent, siteContentVersions } from "@/db/schema";
import { getAdminSessionContext, isAdminAuthorized, unauthorized } from "@/lib/admin-auth";
import { canPublishSiteContent, isSiteContentResource, normalizeLocale, normalizeSiteSlug } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ resource: string; slug: string; version: string }> }) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  const raw = await params;
  if (!isSiteContentResource(raw.resource)) return Response.json({ ok: false, error: "Unknown site resource" }, { status: 404 });
  if (!canPublishSiteContent(actor.role, raw.resource)) return Response.json({ ok: false, error: `Role ${actor.role} cannot rollback ${raw.resource}` }, { status: 403 });
  const version = Number(raw.version);
  const slug = normalizeSiteSlug(raw.slug);
  const body = await req.json().catch(() => ({})) as { locale?: string; changeNote?: string };
  const locale = normalizeLocale(body.locale);
  if (!Number.isInteger(version) || version < 1 || !slug) return Response.json({ ok: false, error: "Invalid rollback target" }, { status: 400 });

  const item = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(siteContent).where(and(eq(siteContent.resource, raw.resource), eq(siteContent.slug, slug), eq(siteContent.locale, locale))).limit(1);
    if (!existing) return null;
    const [target] = await tx.select().from(siteContentVersions).where(and(eq(siteContentVersions.contentId, existing.id), eq(siteContentVersions.version, version))).limit(1);
    if (!target) return undefined;
    const snapshot = target.snapshot as { payload?: unknown; seo?: unknown };
    const [restored] = await tx.update(siteContent).set({
      payload: snapshot.payload ?? {},
      seo: snapshot.seo ?? {},
      status: "draft",
      version: existing.version + 1,
      updatedBy: actor.actorId,
      publishedAt: null,
      updatedAt: new Date(),
    }).where(eq(siteContent.id, existing.id)).returning();
    await tx.insert(siteContentVersions).values({ contentId: restored.id, version: restored.version, status: "draft", snapshot: { payload: restored.payload, seo: restored.seo }, actor: actor.actorId, changeNote: typeof body.changeNote === "string" ? body.changeNote.slice(0, 500) : `Rollback from version ${version}` });
    await tx.insert(adminAuditLogs).values({ action: "site_content.rollback", resource: `site:${raw.resource}`, resourceId: restored.id, actor: actor.actorId, details: { slug, locale, fromVersion: version, newVersion: restored.version } });
    return restored;
  });

  if (item === null) return Response.json({ ok: false, error: "Site content not found" }, { status: 404 });
  if (item === undefined) return Response.json({ ok: false, error: "Version not found" }, { status: 404 });
  return Response.json({ ok: true, item });
}
