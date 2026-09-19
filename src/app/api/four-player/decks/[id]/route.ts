import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { fourPlayerDecks } from "@/db/schema";
import { FOUR_PLAYER_RULESET_V0 } from "@/game/four-player-rules";
import { fourPlayerFeatureGate } from "@/lib/four-player-feature";
import { parseFourPlayerCards, validateFourPlayerDeckInput } from "@/lib/four-player-service";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { runtimeGate } from "@/lib/runtime-gates";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  const featureBlocked = fourPlayerFeatureGate();
  if (featureBlocked) return featureBlocked;
  try {
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const deckId = Number((await ctx.params).id);
    if (!Number.isInteger(deckId) || deckId < 1) return Response.json({ ok: false, error: "Invalid deck id" }, { status: 400 });
    const body = await req.json() as Record<string, unknown>;
    const cards = parseFourPlayerCards(body.cards);
    const generalDefId = String(body.generalDefId || "").trim();
    const validation = await validateFourPlayerDeckInput(cards, generalDefId);
    if (!validation.ok) return Response.json({ ok: false, errors: validation.errors, identity: validation.identity }, { status: 400 });
    const name = String(body.name || "Deck 4P").trim().slice(0, 40) || "Deck 4P";
    const emoji = String(body.emoji || "⚔️").slice(0, 8) || "⚔️";
    const [deck] = await db.update(fourPlayerDecks).set({
      name,
      emoji,
      cards,
      generalDefId,
      rulesetVersion: FOUR_PLAYER_RULESET_V0.id,
      updatedAt: new Date(),
    }).where(and(eq(fourPlayerDecks.id, deckId), eq(fourPlayerDecks.ownerPlayerId, identity.playerId))).returning();
    if (!deck) return Response.json({ ok: false, error: "Deck not found" }, { status: 404 });
    return Response.json({ ok: true, deck: { ...deck, identity: validation.identity } });
  } catch (error) {
    console.error("[four-player/decks/:id] PUT failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  const featureBlocked = fourPlayerFeatureGate();
  if (featureBlocked) return featureBlocked;
  try {
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const deckId = Number((await ctx.params).id);
    if (!Number.isInteger(deckId) || deckId < 1) return Response.json({ ok: false, error: "Invalid deck id" }, { status: 400 });
    try {
      const rows = await db.delete(fourPlayerDecks).where(and(
        eq(fourPlayerDecks.id, deckId),
        eq(fourPlayerDecks.ownerPlayerId, identity.playerId),
      )).returning({ id: fourPlayerDecks.id });
      if (!rows.length) return Response.json({ ok: false, error: "Deck not found" }, { status: 404 });
      return Response.json({ ok: true });
    } catch (error) {
      // A deck snapshotted by an active room is intentionally protected by FK RESTRICT.
      if ((error as { code?: string }).code === "23503") return Response.json({ ok: false, error: "Deck is in use by a 4P room" }, { status: 409 });
      throw error;
    }
  } catch (error) {
    console.error("[four-player/decks/:id] DELETE failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
