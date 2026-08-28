import { and, eq, gt, lte } from "drizzle-orm";
import { rankedSeasons } from "@/db/schema";
import type { RankedSeasonWindow } from "@/lib/ranked-season-window";

export { isRankedSeasonOpen } from "@/lib/ranked-season-window";
export type { RankedSeasonWindow } from "@/lib/ranked-season-window";

export async function findOpenRankedSeason(tx: any, now = new Date()): Promise<RankedSeasonWindow | null> {
  const [season] = await tx.select({
    id: rankedSeasons.id,
    name: rankedSeasons.name,
    startAt: rankedSeasons.startAt,
    endAt: rankedSeasons.endAt,
    active: rankedSeasons.active,
  }).from(rankedSeasons).where(and(
    eq(rankedSeasons.active, true),
    lte(rankedSeasons.startAt, now),
    gt(rankedSeasons.endAt, now),
  )).limit(1);
  return season ?? null;
}
