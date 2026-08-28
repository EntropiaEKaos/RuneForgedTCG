import type { InferSelectModel } from "drizzle-orm";
import type { sharedDecks } from "@/db/schema";

type SharedDeckRow = InferSelectModel<typeof sharedDecks>;

/** Public community projection. Internal ownership ids remain server-side. */
export function publicSharedDeckDto(row: SharedDeckRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    region1: row.region1,
    region2: row.region2,
    region3: row.region3,
    cards: row.cards,
    archetype: row.archetype,
    formatId: row.formatId,
    upvotes: row.upvotes,
    downloads: row.downloads,
    createdAt: row.createdAt,
  };
}
