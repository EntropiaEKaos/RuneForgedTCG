import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { fourPlayerDecks } from "@/db/schema";
import { FOUR_PLAYER_RULESET_V0 } from "@/game/four-player-rules";
import { fourPlayerFeatureGate } from "@/lib/four-player-feature";
import { parseFourPlayerCards, validateFourPlayerDeckInput } from "@/lib/four-player-service";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { runtimeGate } from "@/lib/runtime-gates";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const featureBlocked = fourPlayerFeatureGate();
  if (featureBlocked) return featureBlocked;
  const identity = await requireStablePlayerIdentity(req);
  if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
  const decks = await db.select().from(fourPlayerDecks).where(eq(fourPlayerDecks.ownerPlayerId, identity.playerId)).orderBy(desc(fourPlayerDecks.updatedAt));
  return Response.json({ ok: true, ruleset: FOUR_PLAYER_RULESET_V0, decks });
}

export async function POST(req: NextRequest) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  const featureBlocked = fourPlayerFeatureGate();
  if (featureBlocked) return featureBlocked;
  try {
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const body = await req.json() as Record<string, unknown>;
    const cards = parseFourPlayerCards(body.cards);
    const generalDefId = String(body.generalDefId || "").trim();
    const validation = await validateFourPlayerDeckInput(cards, generalDefId);
    if (!validation.ok) return Response.json({ ok: false, errors: validation.errors, identity: validation.identity }, { status: 400 });
    const name = String(body.name || "Deck 4P").trim().slice(0, 40) || "Deck 4P";
    const emoji = String(body.emoji || "⚔️").slice(0, 8) || "⚔️";
    const [deck] = await db.insert(fourPlayerDecks).values({
      ownerPlayerId: identity.playerId,
      name,
      emoji,
      cards,
      generalDefId,
      rulesetVersion: FOUR_PLAYER_RULESET_V0.id,
    }).returning();
    return Response.json({ ok: true, deck: { ...deck, identity: validation.identity } }, { status: 201 });
  } catch (error) {
    console.error("[four-player/decks] POST failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
