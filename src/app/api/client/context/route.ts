import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { players } from "@/db/schema";
import { getAdminSessionContext } from "@/lib/admin-auth";
import { canAccessStudioAuthoring } from "@/lib/admin-studio-access";
import { getPlayerSession } from "@/lib/player-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const [admin, playerSession] = await Promise.all([
    getAdminSessionContext(req),
    getPlayerSession(req),
  ]);

  let player: { authenticated: boolean; name?: string | null; avatar?: string | null } = { authenticated: false };
  if (playerSession) {
    const [row] = await db.select({ name: players.name, avatar: players.avatar })
      .from(players)
      .where(eq(players.id, playerSession.playerId))
      .limit(1);
    player = {
      authenticated: Boolean(row),
      name: row?.name ?? null,
      avatar: row?.avatar ?? null,
    };
  }

  return Response.json({
    ok: true,
    player,
    admin: admin
      ? {
          authenticated: true,
          role: admin.role,
          canStudio: canAccessStudioAuthoring(admin.role),
        }
      : { authenticated: false, role: null, canStudio: false },
  }, {
    headers: { "cache-control": "private, no-store" },
  });
}
