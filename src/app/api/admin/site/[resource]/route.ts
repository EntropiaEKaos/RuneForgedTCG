import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { siteContent } from "@/db/schema";
import { getAdminSessionContext, isAdminAuthorized, unauthorized } from "@/lib/admin-auth";
import { canReadSiteContent, isSiteContentResource, parseSiteLocale } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();

  const { resource } = await params;
  if (!isSiteContentResource(resource)) return Response.json({ ok: false, error: "Unknown site resource" }, { status: 404 });
  if (!canReadSiteContent(actor.role, resource)) return Response.json({ ok: false, error: `Role ${actor.role} cannot read ${resource}` }, { status: 403 });

  const locale = parseSiteLocale(req.nextUrl.searchParams.get("locale"));
  if (!locale) return Response.json({ ok: false, error: "Invalid locale" }, { status: 400 });

  const rows = await db.select().from(siteContent)
    .where(and(eq(siteContent.resource, resource), eq(siteContent.locale, locale)))
    .orderBy(desc(siteContent.updatedAt));

  return Response.json({ ok: true, resource, locale, items: rows });
}
