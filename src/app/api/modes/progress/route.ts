import { db } from "@/db";
import { modeRewards } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { requireStablePlayerIdentity } from "@/lib/player-session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) {
      return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    }

    const rows = await db
      .select({
        modeType: modeRewards.modeType,
        modeId: modeRewards.modeId,
        claimedAt: modeRewards.claimedAt,
      })
      .from(modeRewards)
      .where(eq(modeRewards.playerId, identity.playerId))
      .orderBy(asc(modeRewards.claimedAt));

    return Response.json({
      ok: true,
      completed: rows.map((row) => ({
        modeType: row.modeType,
        modeId: row.modeId,
        claimedAt: row.claimedAt.toISOString(),
      })),
    });
  } catch {
    return Response.json({ ok: false, error: "Mode progress unavailable" }, { status: 500 });
  }
}
