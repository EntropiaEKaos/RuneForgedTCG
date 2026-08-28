import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, chatMessages, customDecks, economyTransactions, matchmakingQueue, matches, packOpenings, playerSessions, pvpRooms, replays, sharedDecks } from "@/db/schema";
import { getAdminSessionContext, isAdminAuthorized, unauthorized } from "@/lib/admin-auth";
import { cleanupExpiredRuntimeData } from "@/lib/session-cleanup";
import { ensureConfigLoaded } from "@/game/settings";

const tables = { matches, replays, "player-decks": customDecks, "shared-decks": sharedDecks, chat: chatMessages, economy: economyTransactions, rooms: pvpRooms, queue: matchmakingQueue, sessions: playerSessions, "pack-openings": packOpenings } as const;
type Resource = keyof typeof tables;
async function admin(req: NextRequest) { if (!(await isAdminAuthorized(req))) return null; const actor = await getAdminSessionContext(req); return actor?.role === "admin" ? actor : null; }

export async function GET(req: NextRequest) {
  const actor = await admin(req); if (!actor) return unauthorized();
  const resource = String(req.nextUrl.searchParams.get("resource") || "matches") as Resource;
  const table = tables[resource]; if (!table) return Response.json({ ok: false, error: "Unknown runtime resource" }, { status: 404 });
  const rows = await db.select().from(table).orderBy(desc((table as any).id)).limit(300);
  return Response.json({ ok: true, resource, rows });
}

export async function POST(req: NextRequest) {
  const actor = await admin(req); if (!actor) return unauthorized();
  const config = await ensureConfigLoaded();
  const body = await req.json(); const action = String(body.action || "");
  if ((action === "delete-player-deck" || action === "delete-shared-deck") && !config.advanced.moderation.allowDeckModeration) {
    return Response.json({ ok: false, error: "Deck moderation is disabled by Total Control" }, { status: 423 });
  }
  if (action === "cleanup") {
    const result = await cleanupExpiredRuntimeData();
    await db.insert(adminAuditLogs).values({ action: "runtime.cleanup", resource: "runtime", actor: actor.actorId, details: result });
    return Response.json({ ok: true, result });
  }
  const reason = String(body.reason || "").trim().slice(0, 300);
  if (reason.length < 8) return Response.json({ ok: false, error: "A moderation reason with at least 8 characters is required" }, { status: 400 });
  const id = Number(body.id); if (!Number.isInteger(id) || id < 1) return Response.json({ ok: false, error: "Invalid target id" }, { status: 400 });
  let affected = 0; let resource = "runtime";
  if (action === "delete-player-deck") { affected = (await db.delete(customDecks).where(eq(customDecks.id, id)).returning({ id: customDecks.id })).length; resource = "player-decks"; }
  else if (action === "delete-shared-deck") { affected = (await db.delete(sharedDecks).where(eq(sharedDecks.id, id)).returning({ id: sharedDecks.id })).length; resource = "shared-decks"; }
  else if (action === "delete-chat") { affected = (await db.delete(chatMessages).where(eq(chatMessages.id, id)).returning({ id: chatMessages.id })).length; resource = "chat"; }
  else if (action === "delete-replay") { affected = (await db.delete(replays).where(eq(replays.id, id)).returning({ id: replays.id })).length; resource = "replays"; }
  else if (action === "close-room") { affected = (await db.update(pvpRooms).set({ state: "finished", expiresAt: new Date(), updatedAt: new Date() }).where(eq(pvpRooms.id, id)).returning({ id: pvpRooms.id })).length; resource = "rooms"; }
  else if (action === "remove-queue") { affected = (await db.delete(matchmakingQueue).where(eq(matchmakingQueue.id, id)).returning({ id: matchmakingQueue.id })).length; resource = "queue"; }
  else if (action === "revoke-session") { affected = (await db.update(playerSessions).set({ revokedAt: new Date() }).where(eq(playerSessions.id, id)).returning({ id: playerSessions.id })).length; resource = "sessions"; }
  else return Response.json({ ok: false, error: "Unsupported runtime action" }, { status: 400 });
  if (!affected) return Response.json({ ok: false, error: "Target not found" }, { status: 404 });
  await db.insert(adminAuditLogs).values({ action: `runtime.${action}`, resource, resourceId: id, actor: actor.actorId, details: { reason } });
  return Response.json({ ok: true, affected });
}
