import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { siteContent } from "@/db/schema";
import { isSiteContentResource, normalizeLocale } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  if (!isSiteContentResource(resource)) {
    return Response.json({ ok: false, error: "Unknown site resource" }, { status: 404 });
  }
  const locale = normalizeLocale(req.nextUrl.searchParams.get("locale"));
  const items = await db.select({
    slug: siteContent.slug,
    locale: siteContent.locale,
    payload: siteContent.payload,
    seo: siteContent.seo,
    version: siteContent.version,
    publishedAt: siteContent.publishedAt,
  }).from(siteContent).where(and(
    eq(siteContent.resource, resource),
    eq(siteContent.locale, locale),
    eq(siteContent.status, "published"),
  )).orderBy(desc(siteContent.publishedAt));
  return Response.json({ ok: true, resource, locale, items });
}
