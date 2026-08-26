import { customDecks } from "@/db/schema";
import { ensureCustomCardsLoaded } from "./catalog";
import { and, eq } from "drizzle-orm";
import { validateDeck, type DeckDef } from "./decks";
import type { DeckInput } from "./types";
import { getRuntimeDecks } from "@/lib/control-plane";
import { validateFormatDeck } from "./format-rules-server";
export { snapshotReplayBundle } from "./replay-content-snapshot";

type DB = { select: any };

/** Single authoritative deck resolver used by PvE, PvP, ranked and replay paths. */
export async function resolveDeck(db: DB, playerId: number, deckId: string): Promise<DeckInput> {
  // Deck validation ultimately resolves card definitions through the server catalog.
  // Warm the published custom-card cache here so every authoritative caller gets the
  // same behavior on a cold process, rather than depending on /api/catalog having run first.
  await ensureCustomCardsLoaded();
  if (/^custom_\d+$/.test(deckId)) {
    const id = Number(deckId.slice(7));
    const [row] = await db.select({ id: customDecks.id, name: customDecks.name, cards: customDecks.cards, formatId: customDecks.formatId })
      .from(customDecks)
      .where(and(eq(customDecks.id, id), eq(customDecks.ownerPlayerId, playerId)))
      .limit(1);
    if (!row) throw new Error("Deck not found or not owned by player");
    let cards: string[];
    try { cards = JSON.parse(row.cards); } catch { throw new Error("Invalid stored deck"); }
    const check = validateDeck(cards);
    const formatCheck = await validateFormatDeck(cards, row.formatId || "eternal");
    if (!check.ok || !formatCheck.ok) throw new Error(`Deck is invalid: ${[...check.errors, ...formatCheck.errors].join(" | ")}`);
    return { id: `custom_${row.id}`, name: row.name, cards: [...cards], formatId: formatCheck.format.id };
  }
  const runtimeDecks = await getRuntimeDecks();
  const preset = runtimeDecks.find((deck) => deck.id === deckId);
  if (!preset) throw new Error(`Unknown or inactive deck: ${deckId}`);
  const check = validateDeck(preset.cards);
  if (!check.ok) throw new Error(`Preset deck is invalid: ${check.errors.join(" | ")}`);
  return { id: preset.id, name: preset.name, cards: [...preset.cards], formatId: "vanilla" };
}

/** Immutable match snapshot; never read a mutable deck again during replay. */
export function snapshotDeck(deck: DeckInput): DeckInput {
  return { id: deck.id, name: deck.name, cards: [...deck.cards], formatId: deck.formatId };
}

export async function listPresetDecks(): Promise<DeckDef[]> {
  const decks = await getRuntimeDecks();
  return decks.map((d) => ({ ...d, cards: [...d.cards], regions: [...d.regions] as DeckDef["regions"] }));
}
