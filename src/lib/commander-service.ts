import { and, inArray, eq } from "drizzle-orm";
import { playerCards } from "@/db/schema";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import { validateCommanderDeck } from "@/lib/commander-rules";

type DB = {
  select: any;
};

export async function validateOwnedCommanderLoadout(db: DB, playerId: number, cards: string[], generalDefId: string) {
  await ensureCustomCardsLoaded();
  const rules = validateCommanderDeck(cards, generalDefId);
  const errors = [...rules.errors];

  const required = new Map<string, number>();
  for (const defId of cards) required.set(defId, (required.get(defId) ?? 0) + 1);
  required.set(generalDefId, (required.get(generalDefId) ?? 0) + 1);

  const ids = [...required.keys()];
  const ownedRows = ids.length
    ? await db.select({ defId: playerCards.defId, count: playerCards.count }).from(playerCards)
      .where(and(eq(playerCards.playerId, playerId), inArray(playerCards.defId, ids)))
    : [];
  const owned = new Map<string, number>();
  for (const row of ownedRows) owned.set(String(row.defId), Number(row.count || 0));

  for (const [defId, count] of required) {
    if ((owned.get(defId) ?? 0) < count) errors.push(`Coleção insuficiente para ${defId}: precisa ${count}.`);
  }

  return { ok: errors.length === 0, errors, regions: rules.regions };
}
