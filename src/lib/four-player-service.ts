import { and, eq } from "drizzle-orm";
import { fourPlayerDecks } from "@/db/schema";
import { allCards } from "@/game/cards";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import { validateFourPlayerDeck } from "@/game/four-player-rules";

export class FourPlayerDeckError extends Error {
  status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = "FourPlayerDeckError";
    this.status = status;
  }
}

export function parseFourPlayerCards(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((value) => String(value || "").trim()).filter(Boolean) : [];
}

export async function validateFourPlayerDeckInput(cards: string[], generalDefId: string) {
  await ensureCustomCardsLoaded();
  const definitions = new Map(allCards().map((card) => [card.defId, card]));
  return validateFourPlayerDeck(cards, generalDefId, (defId) => definitions.get(defId));
}

export async function loadOwnedFourPlayerDeck(query: any, playerId: number, deckId: number) {
  await ensureCustomCardsLoaded();
  const [row] = await query.select().from(fourPlayerDecks).where(and(
    eq(fourPlayerDecks.id, deckId),
    eq(fourPlayerDecks.ownerPlayerId, playerId),
  )).limit(1);
  if (!row) throw new FourPlayerDeckError("4P deck not found or not owned by player", 404);
  const cards = parseFourPlayerCards(row.cards);
  const validation = await validateFourPlayerDeckInput(cards, row.generalDefId);
  if (!validation.ok) throw new FourPlayerDeckError(`Stored 4P deck is no longer legal: ${validation.errors.join(" | ")}`);
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    cards,
    generalDefId: row.generalDefId,
    rulesetVersion: row.rulesetVersion,
    identity: validation.identity,
  };
}

export function snapshotFourPlayerDeck(deck: Awaited<ReturnType<typeof loadOwnedFourPlayerDeck>>) {
  return {
    id: deck.id,
    name: deck.name,
    cards: [...deck.cards],
    generalDefId: deck.generalDefId,
    rulesetVersion: deck.rulesetVersion,
    identity: deck.identity,
  };
}
