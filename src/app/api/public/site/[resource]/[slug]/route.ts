import { NextRequest } from "next/server";
import { isSiteContentResource, normalizeSiteSlug, parseSiteLocale } from "@/lib/site-content";
import { readPublishedSiteContentItem } from "@/lib/site-content-public";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ resource: string; slug: string }> }) {
  const raw = await params;
  if (!isSiteContentResource(raw.resource)) return Response.json({ ok: false, error: "Unknown site resource" }, { status: 404 });

  const slug = normalizeSiteSlug(raw.slug);
  const locale = parseSiteLocale(req.nextUrl.searchParams.get("locale"));
  if (!slug) return Response.json({ ok: false, error: "Invalid slug" }, { status: 400 });
  if (!locale) return Response.json({ ok: false, error: "Invalid locale" }, { status: 400 });

  const item = await readPublishedSiteContentItem(raw.resource, slug, locale);
  if (!item) return Response.json({ ok: false, error: "Published site content not found" }, { status: 404 });

  return Response.json({ ok: true, resource: raw.resource, item });
}
