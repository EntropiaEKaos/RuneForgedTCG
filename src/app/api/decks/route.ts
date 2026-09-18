import { runtimeGate } from "@/lib/runtime-gates";
import { db } from "@/db";
import { customDecks } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { validateDeck } from "@/game/decks";
import { ensureConfigLoaded } from "@/game/settings";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { validateFormatDeck } from "@/game/format-rules-server";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import { DeckPrintingValidationError, loadDeckPrintingPreferences, replaceDeckPrintingPreferences } from "@/lib/deck-printing-service";

export const dynamic = "force-dynamic";

function parseCards(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [];
    }
  }
  return [];
}

export async function GET(req: Request) {
  try {
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const rows = await db
      .select()
      .from(customDecks)
      .where(eq(customDecks.ownerPlayerId, identity.playerId))
      .orderBy(desc(customDecks.updatedAt));
    const printings = await loadDeckPrintingPreferences(db, identity.playerId, rows.map((row) => row.id));

    return Response.json({
      ok: true,
      decks: rows.map((row) => ({
        ...row,
        cards: parseCards(row.cards),
        printings: printings.get(row.id) ?? [],
      })),
    });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  await ensureConfigLoaded();
  try {
    const body = await req.json();
    await ensureCustomCardsLoaded();
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Authenticated player session required" }, { status: 401 });
    const ownerName = identity.playerName;
    const name = String(body.name ?? "Untitled Deck").slice(0, 40) || "Untitled Deck";
    const emoji = String(body.emoji ?? "🎴").slice(0, 8) || "🎴";
    const cards = parseCards(body.cards);
    const formatId = String(body.formatId || "eternal").trim().toLowerCase();
    const deckValidation = validateDeck(cards);
    const formatCheck = await validateFormatDeck(cards, formatId);
    if (!deckValidation.ok || !formatCheck.ok) {
      return Response.json({ ok: false, errors: [...deckValidation.errors, ...formatCheck.errors] }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(customDecks)
        .values({ ownerName, ownerPlayerId: identity.playerId, name, emoji, formatId, cards: JSON.stringify(cards) })
        .returning();
      const printings = await replaceDeckPrintingPreferences(tx, {
        deckId: row.id,
        playerId: identity.playerId!,
        cards,
        printings: body.printings,
      });
      return { row, printings };
    });

    return Response.json({ ok: true, deck: { ...result.row, cards, printings: result.printings } });
  } catch (error) {
    if (error instanceof DeckPrintingValidationError) return Response.json({ ok: false, error: error.message }, { status: 400 });
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
