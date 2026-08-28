import { NextRequest } from "next/server";
import { db } from "@/db";
import { replays } from "@/db/schema";
import { eq } from "drizzle-orm";
import { publicReplayDto } from "@/lib/replay-dto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const replayId = Number(id);
    if (!Number.isFinite(replayId)) {
      return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    const [replay] = await db.select().from(replays).where(eq(replays.id, replayId)).limit(1);
    if (!replay) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

    return Response.json({ ok: true, replay: publicReplayDto(replay) });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
