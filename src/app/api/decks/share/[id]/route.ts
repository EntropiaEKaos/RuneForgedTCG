import { runtimeGate } from "@/lib/runtime-gates";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { sharedDeckDownloads, sharedDeckVotes, sharedDecks } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { requireStablePlayerIdentity } from "@/lib/player-session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  try {
    const { id } = await ctx.params;
    const deckId = Number(id);
    if (!Number.isFinite(deckId)) {
      return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json();
    const identity = await requireStablePlayerIdentity(req);
    if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const action = body.action;

    if (identity.playerId == null) return Response.json({ ok: false, error: "Stable player identity required" }, { status: 401 });

    const result = await db.transaction(async (tx) => {
      const [deck] = await tx.select().from(sharedDecks).where(eq(sharedDecks.id, deckId)).limit(1).for("update");
      if (!deck) return { error: "Deck not found", status: 404 as const };

      if (action === "upvote") {
        const inserted = await tx.insert(sharedDeckVotes).values({ playerId: identity.playerId!, deckId }).onConflictDoNothing().returning({ id: sharedDeckVotes.id });
        if (inserted.length) {
          const [updated] = await tx.update(sharedDecks).set({ upvotes: sql`${sharedDecks.upvotes} + 1` }).where(eq(sharedDecks.id, deckId)).returning();
          return { deck: updated, changed: true };
        }
        return { deck, changed: false };
      }

      if (action === "download") {
        const inserted = await tx.insert(sharedDeckDownloads).values({ playerId: identity.playerId!, deckId }).onConflictDoNothing().returning({ id: sharedDeckDownloads.id });
        if (inserted.length) {
          const [updated] = await tx.update(sharedDecks).set({ downloads: sql`${sharedDecks.downloads} + 1` }).where(eq(sharedDecks.id, deckId)).returning();
          return { deck: updated, changed: true };
        }
        return { deck, changed: false };
      }
      return { error: "Invalid action", status: 400 as const };
    });
    if ("error" in result) return Response.json({ ok: false, error: result.error }, { status: result.status });
    return Response.json({ ok: true, deck: result.deck, ...( "changed" in result ? { changed: result.changed } : {} ) });

    return Response.json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  try {
    const { id } = await ctx.params;
    const deckId = Number(id);
    if (!Number.isFinite(deckId)) {
      return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }
    const identity = await requireStablePlayerIdentity(req);
    if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    if (identity.playerId == null) return Response.json({ ok: false, error: "Stable player identity required" }, { status: 401 });
    const deleted = await db.delete(sharedDecks).where(and(eq(sharedDecks.id, deckId), eq(sharedDecks.playerId, identity.playerId))).returning({ id: sharedDecks.id });
    if (!deleted.length) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
