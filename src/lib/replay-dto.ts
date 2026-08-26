import type { InferSelectModel } from "drizzle-orm";
import type { replays } from "@/db/schema";

type ReplayRow = InferSelectModel<typeof replays>;

/** Explicit public projection. Never expose internal player ids or raw integrity material by accident. */
export function publicReplayDto(row: ReplayRow) {
  let log: string[] = [];
  try { log = JSON.parse(row.log) as string[]; } catch { log = [row.log]; }
  return {
    id: row.id,
    playerName: row.playerName,
    deckName: row.deckName,
    deckId: row.deckId,
    opponentName: row.aiDeckName,
    opponentDeckId: row.aiDeckId,
    aiDifficulty: row.aiDifficulty,
    won: row.won,
    rounds: row.rounds,
    playerFirst: row.playerFirst,
    log,
    engineVersion: row.engineVersion,
    rulesetVersion: row.rulesetVersion,
    contentVersion: row.contentVersion,
    matchMode: row.matchMode,
    perspective: row.perspective,
    eventLog: Array.isArray(row.eventLog) ? row.eventLog : [],
    createdAt: row.createdAt,
  };
}
