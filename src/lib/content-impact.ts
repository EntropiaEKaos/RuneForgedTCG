import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  adminContentDependencies,
  adminEvents,
  adminGameDefinitions,
  adminInteractions,
  adminPromotions,
  cardCatalogMeta,
  customCards,
} from "@/db/schema";

async function count(table: any, where: any): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(table).where(where);
  return Number(row?.n || 0);
}

function referenceKey(resource: string, row: any): string {
  if (resource === "collections") return String(row?.key || row?.code || "").trim();
  return String(row?.key || row?.defId || "").trim();
}

/**
 * Reverse dependency check for content resources. This is intentionally
 * conservative: a published/active resource cannot disappear while any live
 * card, interaction, event, promotion or control-plane definition references
 * its stable key. Collections additionally use their numeric catalog FK.
 */
export async function analyzeContentReverseDependencies(resource: string, row: any) {
  const key = referenceKey(resource, row);
  const exactJsonString = key ? `%"${key.replace(/[\\%_"]/g, (m) => `\\${m}`)}"%` : "%__runeforge_no_key__%";

  const [cards, interactions, events, promotions, controlPlane, dependencySnapshots] = await Promise.all([
    key ? count(customCards, and(eq(customCards.enabled, true), sql`${customCards.data}::text LIKE ${exactJsonString} ESCAPE '\\'`)) : 0,
    key ? count(adminInteractions, and(eq(adminInteractions.enabled, true), sql`(${adminInteractions.sourceKey} = ${key} OR ${adminInteractions.targetKey} = ${key} OR ${adminInteractions.condition}::text LIKE ${exactJsonString} ESCAPE '\\' OR ${adminInteractions.effect}::text LIKE ${exactJsonString} ESCAPE '\\')`)) : 0,
    key ? count(adminEvents, and(eq(adminEvents.status, "published"), sql`(${adminEvents.rules}::text LIKE ${exactJsonString} ESCAPE '\\' OR ${adminEvents.rewards}::text LIKE ${exactJsonString} ESCAPE '\\' OR ${adminEvents.metadata}::text LIKE ${exactJsonString} ESCAPE '\\')`)) : 0,
    key ? count(adminPromotions, and(eq(adminPromotions.status, "published"), sql`(${adminPromotions.conditions}::text LIKE ${exactJsonString} ESCAPE '\\' OR ${adminPromotions.offers}::text LIKE ${exactJsonString} ESCAPE '\\' OR ${adminPromotions.metadata}::text LIKE ${exactJsonString} ESCAPE '\\')`)) : 0,
    key ? count(adminGameDefinitions, and(eq(adminGameDefinitions.enabled, true), sql`${adminGameDefinitions.payload}::text LIKE ${exactJsonString} ESCAPE '\\'`)) : 0,
    key ? count(adminContentDependencies, sql`${adminContentDependencies.graph}::text LIKE ${exactJsonString} ESCAPE '\\'`) : 0,
  ]);

  let catalog = 0;
  if (resource === "collections" && Number.isInteger(Number(row?.id))) {
    catalog = await count(cardCatalogMeta, and(eq(cardCatalogMeta.collectionId, Number(row.id)), eq(cardCatalogMeta.releaseState, "published")));
  } else if (resource === "classes" && key) {
    catalog = await count(cardCatalogMeta, and(eq(cardCatalogMeta.releaseState, "published"), sql`${cardCatalogMeta.classKeys}::text LIKE ${exactJsonString} ESCAPE '\\'`));
  } else if (resource === "races" && key) {
    catalog = await count(cardCatalogMeta, and(eq(cardCatalogMeta.releaseState, "published"), sql`${cardCatalogMeta.raceKeys}::text LIKE ${exactJsonString} ESCAPE '\\'`));
  }

  const references = { cards, catalog, interactions, events, promotions, controlPlane, dependencySnapshots };
  return { resource, key, references, totalActiveReferences: Object.values(references).reduce((a, b) => a + b, 0) };
}
