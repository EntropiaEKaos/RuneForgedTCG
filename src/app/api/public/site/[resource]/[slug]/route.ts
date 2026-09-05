import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { siteContent } from "@/db/schema";
import { isSiteContentResource, normalizeSiteSlug, parseSiteLocale } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ resource: string; slug: string }> }) {
  const raw = await params;
  if (!isSiteContentResource(raw.resource)) return Response.json({ ok: false, error: "Unknown site resource" }, { status: 404 });

  const slug = normalizeSiteSlug(raw.slug);
  const locale = parseSiteLocale(req.nextUrl.searchParams.get("locale"));
  if (!slug) return Response.json({ ok: false, error: "Invalid slug" }, { status: 400 });
  if (!locale) return Response.json({ ok: false, error: "Invalid locale" }, { status: 400 });

  const [item] = await db.select({
    slug: siteContent.slug,
    locale: siteContent.locale,
    payload: siteContent.payload,
    seo: siteContent.seo,
    version: siteContent.version,
    publishedAt: siteContent.publishedAt,
  }).from(siteContent).where(and(
    eq(siteContent.resource, raw.resource),
    eq(siteContent.slug, slug),
    eq(siteContent.locale, locale),
    eq(siteContent.status, "published"),
  )).limit(1);

  if (!item) return Response.json({ ok: false, error: "Published site content not found" }, { status: 404 });
  return Response.json({ ok: true, resource: raw.resource, item });
}
