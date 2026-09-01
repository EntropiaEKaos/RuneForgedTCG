import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { siteContent } from "@/db/schema";
import { getAdminSessionContext, isAdminAuthorized, unauthorized } from "@/lib/admin-auth";
import { isSiteContentResource, normalizeLocale } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();

  const { resource } = await params;
  if (!isSiteContentResource(resource)) return Response.json({ ok: false, error: "Unknown site resource" }, { status: 404 });

  const locale = normalizeLocale(req.nextUrl.searchParams.get("locale"));
  const rows = await db.select().from(siteContent)
    .where(and(eq(siteContent.resource, resource), eq(siteContent.locale, locale)))
    .orderBy(desc(siteContent.updatedAt));

  return Response.json({ ok: true, resource, locale, items: rows });
}
