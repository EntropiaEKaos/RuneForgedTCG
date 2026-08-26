import { runtimeGate } from "@/lib/runtime-gates";
import { db } from "@/db";
import { customDecks } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { validateDeck } from "@/game/decks";
import { ensureConfigLoaded } from "@/game/settings";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { validateFormatDeck } from "@/game/format-rules";
import { ensureCustomCardsLoaded } from "@/game/catalog";

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

    return Response.json({
      ok: true,
      decks: rows.map((r) => ({
        ...r,
        cards: parseCards(r.cards),
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
    const requestedOwner = String(body.ownerName ?? "").trim().slice(0, 40);
    void requestedOwner;
    await ensureCustomCardsLoaded();
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Authenticated player session required" }, { status: 401 });
    const ownerName = identity.playerName;
    const name = String(body.name ?? "Untitled Deck").slice(0, 40) || "Untitled Deck";
    const emoji = String(body.emoji ?? "🎴").slice(0, 8) || "🎴";
    const cards = parseCards(body.cards);
    const formatId = String(body.formatId || "eternal").trim().toLowerCase();
    const check = validateDeck(cards);
    const formatCheck = await validateFormatDeck(cards, formatId);
    if (!check.ok || !formatCheck.ok) {
      return Response.json({ ok: false, errors: [...check.errors, ...formatCheck.errors] }, { status: 400 });
    }

    const [row] = await db
      .insert(customDecks)
      .values({ ownerName, ownerPlayerId: identity.playerId, name, emoji, formatId, cards: JSON.stringify(cards) })
      .returning();

    return Response.json({ ok: true, deck: { ...row, cards } });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
