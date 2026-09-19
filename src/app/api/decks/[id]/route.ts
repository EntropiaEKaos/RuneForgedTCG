import { runtimeGate } from "@/lib/runtime-gates";
import { db } from "@/db";
import { customDecks } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { validateDeck } from "@/game/decks";
import { ensureConfigLoaded } from "@/game/settings";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { validateFormatDeck } from "@/game/format-rules-server";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import { DeckPrintingValidationError, replaceDeckPrintingPreferences } from "@/lib/deck-printing-service";

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

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  await ensureConfigLoaded();
  try {
    const { id } = await ctx.params;
    const deckId = Number(id);
    if (!Number.isFinite(deckId)) return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });

    const body = await req.json();
    await ensureCustomCardsLoaded();
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Authenticated player session required" }, { status: 401 });
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
        .update(customDecks)
        .set({ name, emoji, formatId, cards: JSON.stringify(cards), updatedAt: new Date() })
        .where(and(eq(customDecks.id, deckId), eq(customDecks.ownerPlayerId, identity.playerId!)))
        .returning();
      if (!row) return null;
      const printings = await replaceDeckPrintingPreferences(tx, {
        deckId: row.id,
        playerId: identity.playerId!,
        cards,
        printings: body.printings,
      });
      return { row, printings };
    });

    if (!result) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    return Response.json({ ok: true, deck: { ...result.row, cards, printings: result.printings } });
  } catch (error) {
    if (error instanceof DeckPrintingValidationError) return Response.json({ ok: false, error: error.message }, { status: 400 });
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  try {
    const { id } = await ctx.params;
    const deckId = Number(id);
    if (!Number.isFinite(deckId)) return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Authenticated player session required" }, { status: 401 });
    const deleted = await db.delete(customDecks).where(and(eq(customDecks.id, deckId), eq(customDecks.ownerPlayerId, identity.playerId))).returning({ id: customDecks.id });
    if (!deleted.length) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
