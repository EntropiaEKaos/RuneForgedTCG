import type { CardDef } from "./types";

/** Server-side in-memory cache of custom cards loaded from DB. */
let customCache: Record<string, CardDef> = {};
let cacheLoaded = false;
let cacheLoadedAt = 0;
let cacheRevision = "";
let customCollectionCache: Record<string, { id?: number; key: string; code: string; name: string; symbol?: string | null }> = {};
let customArtCache: Record<string, { url: string; crop?: { x?: number; y?: number; scale?: number } }> = {};
const CACHE_REVISION_CHECK_MS = 1_000;

async function readCatalogRevision(): Promise<string> {
  if (typeof window !== "undefined") return cacheRevision;
  const { db } = await import("@/db");
  const { customCards, cardCatalogMeta, adminCollections } = await import("@/db/schema");
  const { sql } = await import("drizzle-orm");
  const [row] = await db.select({
    revision: sql<string>`concat(
      coalesce((select max(${customCards.updatedAt})::text from ${customCards}), ''), ':',
      coalesce((select count(*)::text from ${customCards}), '0'), ':',
      coalesce((select sum(case when ${customCards.enabled} then 1 else 0 end)::text from ${customCards}), '0'), ':',
      coalesce((select max(${cardCatalogMeta.updatedAt})::text from ${cardCatalogMeta}), ''), ':',
      coalesce((select count(*)::text from ${cardCatalogMeta}), '0'), ':',
      coalesce((select max(${adminCollections.updatedAt})::text from ${adminCollections}), ''), ':',
      coalesce((select count(*)::text from ${adminCollections}), '0')
    )`,
  }).from(customCards).limit(1);
  return row?.revision ?? "empty";
}

/**
 * Refreshes the local process cache. Cross-instance coherence is provided by
 * a DB-derived revision checked by ensureCustomCardsLoaded; no process is
 * allowed to trust its local cache indefinitely.
 */
export async function refreshCustomCardCache(): Promise<void> {
  if (typeof window !== "undefined") {
    cacheLoaded = true;
    cacheLoadedAt = Date.now();
    return;
  }
  try {
    const { db } = await import("@/db");
    const { customCards, cardCatalogMeta, adminCollections } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [rows, assignments] = await Promise.all([
      db.select().from(customCards).where(eq(customCards.enabled, true)),
      db.select({ defId: cardCatalogMeta.defId, id: adminCollections.id, key: adminCollections.key, code: adminCollections.code, name: adminCollections.name, symbol: adminCollections.symbol, artUrl: cardCatalogMeta.artUrl, artCrop: cardCatalogMeta.artCrop })
        .from(cardCatalogMeta).innerJoin(adminCollections, eq(cardCatalogMeta.collectionId, adminCollections.id)).where(eq(adminCollections.status, "published")),
    ]);
    const next: Record<string, CardDef> = {};
    for (const row of rows) {
      const data = row.data as CardDef;
      if (data && data.defId) next[data.defId] = data;
    }
    customCache = next;
    customCollectionCache = Object.fromEntries(assignments.map((item) => [item.defId, { id: item.id, key: item.key, code: item.code, name: item.name, symbol: item.symbol }]));
    customArtCache = Object.fromEntries(assignments.filter((item) => typeof item.artUrl === "string" && item.artUrl).map((item) => [item.defId, { url: String(item.artUrl), crop: (item.artCrop && typeof item.artCrop === "object" ? item.artCrop : {}) as { x?: number; y?: number; scale?: number } }]));
    cacheRevision = await readCatalogRevision();
    cacheLoaded = true;
    cacheLoadedAt = Date.now();
  } catch {
    // Do not replace a previously healthy cache with an empty catalog because
    // of a transient DB failure. Cold start remains empty until DB recovers.
    if (!cacheLoaded) customCache = {};
    cacheLoaded = Boolean(cacheLoaded);
    cacheLoadedAt = Date.now();
  }
}

export function getCustomCard(defId: string): CardDef | undefined { return customCache[defId]; }
export function getCustomCardsMap(): Record<string, CardDef> { return customCache; }

export async function ensureCustomCardsLoaded(): Promise<void> {
  if (typeof window !== "undefined") return;
  if (!cacheLoaded) { await refreshCustomCardCache(); return; }
  if (Date.now() - cacheLoadedAt < CACHE_REVISION_CHECK_MS) return;
  try {
    const revision = await readCatalogRevision();
    if (revision !== cacheRevision) await refreshCustomCardCache();
    else cacheLoadedAt = Date.now();
  } catch {
    // Keep last-known-good content and retry revision checking on the next request.
    cacheLoadedAt = Date.now();
  }
}

export function listCustomCardsCached(): CardDef[] { return Object.values(customCache); }
export function getCustomCardCatalogRevision(): string { return cacheRevision || "empty"; }
export function getCustomCardCollectionCached(defId: string) { return customCollectionCache[defId]; }
export function getCustomCardArtCached(defId: string) { return customArtCache[defId]; }
