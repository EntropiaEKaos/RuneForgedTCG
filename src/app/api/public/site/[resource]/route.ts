import { NextRequest } from "next/server";
import { isSiteContentResource, parseSiteLocale } from "@/lib/site-content";
import { listPublishedSiteContent } from "@/lib/site-content-public";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  if (!isSiteContentResource(resource)) return Response.json({ ok: false, error: "Unknown site resource" }, { status: 404 });

  const locale = parseSiteLocale(req.nextUrl.searchParams.get("locale"));
  if (!locale) return Response.json({ ok: false, error: "Invalid locale" }, { status: 400 });

  const items = await listPublishedSiteContent(resource, locale);
  return Response.json({ ok: true, resource, locale, items });
}
