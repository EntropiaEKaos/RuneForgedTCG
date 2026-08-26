import { runtimeGate } from "@/lib/runtime-gates";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { sharedDecks } from "@/db/schema";
import { eq, desc, or } from "drizzle-orm";
import { encodeDeck } from "@/lib/deck-codec";
import { validateDeck } from "@/game/decks";
import { ensureConfigLoaded } from "@/game/settings";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { validateFormatDeck } from "@/game/format-rules";
import { ensureCustomCardsLoaded } from "@/game/catalog";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const region = url.searchParams.get("region");
    const archetype = url.searchParams.get("archetype");
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));

    let query = db.select().from(sharedDecks);
    
    if (region) {
      const decks = await query
        .where(or(eq(sharedDecks.region1, region), eq(sharedDecks.region2, region), eq(sharedDecks.region3, region)))
        .orderBy(desc(sharedDecks.upvotes), desc(sharedDecks.createdAt))
        .limit(limit);
      return Response.json({ ok: true, decks });
    }
    
    if (archetype && archetype !== "All") {
      const decks = await query
        .where(eq(sharedDecks.archetype, archetype))
        .orderBy(desc(sharedDecks.upvotes), desc(sharedDecks.createdAt))
        .limit(limit);
      return Response.json({ ok: true, decks });
    }

    const decks = await query
      .orderBy(desc(sharedDecks.upvotes), desc(sharedDecks.createdAt))
      .limit(limit);

    return Response.json({ ok: true, decks });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  await ensureConfigLoaded();
  try {
    const body = await req.json();
    const identity = await requireStablePlayerIdentity(req);
    if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    if (identity.playerId == null) return Response.json({ ok: false, error: "Stable player identity required" }, { status: 401 });
    const playerName = identity.playerName;
    const name = String(body.name || "Untitled Deck").trim().slice(0, 60);
    const description = String(body.description || "").trim().slice(0, 300);
    const cards = Array.isArray(body.cards) ? body.cards : [];
    const archetype = String(body.archetype || "Custom").slice(0, 40);

    await ensureCustomCardsLoaded();
    const formatId = String(body.formatId || "eternal").trim().toLowerCase();
    const validation = validateDeck(cards);
    const formatCheck = await validateFormatDeck(cards, formatId);
    if (!validation.ok || !formatCheck.ok) {
      return Response.json({ ok: false, errors: [...validation.errors, ...formatCheck.errors] }, { status: 400 });
    }
    const [region1, region2 = null, region3 = null] = validation.regions;

    const [deck] = await db
      .insert(sharedDecks)
      .values({
        playerId: identity.playerId,
        name,
        description,
        region1,
        region2,
        region3,
        cards: JSON.stringify(cards),
        archetype,
        formatId,
      })
      .returning();

    return Response.json({ ok: true, deck, code: encodeDeck(name, cards) });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
