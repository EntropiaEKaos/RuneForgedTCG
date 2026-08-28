import { sql } from "drizzle-orm";
import { db } from "@/db";
import { adminContentDependencies, adminEvents, adminGameDefinitions, customDecks, matches, replays, sharedDecks } from "@/db/schema";

async function count(table: any, expr: any) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(table).where(expr);
  return Number(row?.n || 0);
}

/** Server-authoritative dependency report used by both Studio UI and archive enforcement. */
export async function analyzeCardImpact(defId: string) {
  const id = String(defId || "").trim();
  if (!id) throw new Error("defId is required");
  const escaped = id.replace(/[\\%_]/g, "\\$&").replace(/"/g, '\\"');
  const like = `%"${escaped}"%`;
  const [custom, shared, events, defs, deps, matchCount, replayCount] = await Promise.all([
    count(customDecks, sql`${customDecks.cards} LIKE ${like}`),
    count(sharedDecks, sql`${sharedDecks.cards} LIKE ${like}`),
    count(adminEvents, sql`(${adminEvents.rules}::text LIKE ${like} OR ${adminEvents.rewards}::text LIKE ${like})`),
    count(adminGameDefinitions, sql`${adminGameDefinitions.payload}::text LIKE ${like} AND ${adminGameDefinitions.enabled}=true`),
    count(adminContentDependencies, sql`${adminContentDependencies.graph}::text LIKE ${like}`),
    count(matches, sql`${matches.deckSnapshot}::text LIKE ${like}`),
    count(replays, sql`${replays.deckSnapshot}::text LIKE ${like}`),
  ]);
  const active = { customDecks: custom, sharedDecks: shared, events, controlPlane: defs, dependencies: deps };
  const historical = { matches: matchCount, replays: replayCount };
  return {
    defId: id,
    active,
    historical,
    totalActiveReferences: Object.values(active).reduce((a, b) => a + b, 0),
    historicalReferences: Object.values(historical).reduce((a, b) => a + b, 0),
  };
}

export function cardArchiveAcknowledgement(defId: string, activeReferences: number) {
  return `ARCHIVE ${defId} WITH ${activeReferences} ACTIVE REFERENCES`;
}
