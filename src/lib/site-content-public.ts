import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { siteContent, siteContentVersions } from "@/db/schema";
import { isPlainRecord, type SiteContentResource } from "./site-content";

export type PublishedSiteContentView = {
  slug: string;
  locale: string;
  payload: Record<string, unknown>;
  seo: Record<string, unknown>;
  version: number;
  publishedAt: Date | null;
};

function fromCurrent(item: typeof siteContent.$inferSelect): PublishedSiteContentView {
  return {
    slug: item.slug,
    locale: item.locale,
    payload: isPlainRecord(item.payload) ? item.payload : {},
    seo: isPlainRecord(item.seo) ? item.seo : {},
    version: item.version,
    publishedAt: item.publishedAt,
  };
}

function fromPublishedVersion(
  item: typeof siteContent.$inferSelect,
  version: typeof siteContentVersions.$inferSelect,
): PublishedSiteContentView | null {
  const snapshot = isPlainRecord(version.snapshot) ? version.snapshot : {};
  const payload = isPlainRecord(snapshot.payload) ? snapshot.payload : null;
  const seo = isPlainRecord(snapshot.seo) ? snapshot.seo : {};
  if (!payload) return null;
  return {
    slug: item.slug,
    locale: item.locale,
    payload,
    seo,
    version: version.version,
    publishedAt: version.createdAt,
  };
}

/**
 * Public continuity contract:
 * - published current rows are served directly;
 * - draft/review edits keep serving the latest immutable published snapshot;
 * - archived rows are never public;
 * - content that has never been published remains private.
 */
export async function readPublishedSiteContentItem(
  resource: SiteContentResource,
  slug: string,
  locale: string,
): Promise<PublishedSiteContentView | null> {
  const [current] = await db.select().from(siteContent).where(and(
    eq(siteContent.resource, resource),
    eq(siteContent.slug, slug),
    eq(siteContent.locale, locale),
  )).limit(1);

  if (!current || current.status === "archived") return null;
  if (current.status === "published") return fromCurrent(current);

  const [published] = await db.select().from(siteContentVersions).where(and(
    eq(siteContentVersions.contentId, current.id),
    eq(siteContentVersions.status, "published"),
  )).orderBy(desc(siteContentVersions.version)).limit(1);

  return published ? fromPublishedVersion(current, published) : null;
}

export async function listPublishedSiteContent(
  resource: SiteContentResource,
  locale: string,
): Promise<PublishedSiteContentView[]> {
  const currentRows = await db.select().from(siteContent).where(and(
    eq(siteContent.resource, resource),
    eq(siteContent.locale, locale),
  ));

  if (!currentRows.length) return [];

  const publishedVersions = await db.select({
    contentId: siteContentVersions.contentId,
    version: siteContentVersions.version,
    status: siteContentVersions.status,
    snapshot: siteContentVersions.snapshot,
    actor: siteContentVersions.actor,
    changeNote: siteContentVersions.changeNote,
    createdAt: siteContentVersions.createdAt,
    id: siteContentVersions.id,
  }).from(siteContentVersions)
    .innerJoin(siteContent, eq(siteContentVersions.contentId, siteContent.id))
    .where(and(
      eq(siteContent.resource, resource),
      eq(siteContent.locale, locale),
      eq(siteContentVersions.status, "published"),
    ))
    .orderBy(desc(siteContentVersions.version));

  const latestPublished = new Map<number, typeof siteContentVersions.$inferSelect>();
  for (const row of publishedVersions) {
    if (!latestPublished.has(row.contentId)) latestPublished.set(row.contentId, row);
  }

  const items: PublishedSiteContentView[] = [];
  for (const current of currentRows) {
    if (current.status === "archived") continue;
    if (current.status === "published") {
      items.push(fromCurrent(current));
      continue;
    }
    const published = latestPublished.get(current.id);
    if (!published) continue;
    const view = fromPublishedVersion(current, published);
    if (view) items.push(view);
  }

  return items.sort((a, b) => {
    const aTime = a.publishedAt?.getTime() ?? 0;
    const bTime = b.publishedAt?.getTime() ?? 0;
    return bTime - aTime || a.slug.localeCompare(b.slug);
  });
}
