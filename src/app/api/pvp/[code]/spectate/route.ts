import { db } from "@/db";
import { pvpRooms, pvpSpectatorSnapshots } from "@/db/schema";
import { and, desc, eq, lte } from "drizzle-orm";
import type { GameState } from "@/game/types";
import { toSpectatorGameState } from "@/lib/spectator-state";
import { cleanupExpiredRuntimeSessions } from "@/lib/session-cleanup";

export const dynamic = "force-dynamic";
const SPECTATOR_DELAY_MS = 10_000;

/** Public spectator feed. Hidden hands are stripped and live games are delayed. */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    await cleanupExpiredRuntimeSessions().catch(() => ({ pvpExpired: 0, pvpDeleted: 0, drafts: 0 }));
    const { code } = await ctx.params;
    const [room] = await db.select().from(pvpRooms).where(eq(pvpRooms.code, code.toUpperCase())).limit(1);
    if (!room) return Response.json({ ok: false, error: "Room not found" }, { status: 404 });
    const cutoff = new Date(Date.now() - SPECTATOR_DELAY_MS);
    const [snapshot] = await db.select().from(pvpSpectatorSnapshots)
      .where(and(eq(pvpSpectatorSnapshots.roomId, room.id), lte(pvpSpectatorSnapshots.capturedAt, cutoff)))
      .orderBy(desc(pvpSpectatorSnapshots.capturedAt)).limit(1);
    // Legacy rooms may predate the snapshot table. They are only exposed once
    // their last mutation itself is older than the anti-stream-snipe delay.
    const legacyState = !snapshot && new Date(room.updatedAt) <= cutoff ? room.gameState as GameState | null : null;
    const state = snapshot ? snapshot.gameState as GameState : legacyState;
    if (!state) return Response.json({ ok: true, delayed: true, retryAfterMs: 2_000, status: room.state, state: null });
    const publicState = toSpectatorGameState(state);
    const snapshotVersion = snapshot?.roomVersion ?? room.version;
    return Response.json({ ok: true, delayed: false, delayMs: SPECTATOR_DELAY_MS, status: room.state, winner: publicState.winner ? room.winner : null, version: snapshotVersion, updatedAt: snapshot?.capturedAt ?? room.updatedAt, state: publicState, actionCount: snapshotVersion });
  } catch (error) {
    console.error("[pvp/spectate] failed", error);
    return Response.json({ ok: false, error: "Spectator feed unavailable" }, { status: 500 });
  }
}
