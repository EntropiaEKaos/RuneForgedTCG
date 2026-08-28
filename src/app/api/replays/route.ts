import { db } from "@/db";
import { replays } from "@/db/schema";
import { desc } from "drizzle-orm";
import { publicReplayDto } from "@/lib/replay-dto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(replays).orderBy(desc(replays.createdAt)).limit(25);
    return Response.json({ ok: true, replays: rows.map(publicReplayDto) });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
