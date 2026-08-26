import { db } from "@/db";
import { adminEvents, adminPromotions } from "@/db/schema";
import { and, eq, gte, isNull, lte, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Endpoint público (sem auth de admin) — devolve eventos e promoções que
 * estão de fato "ao vivo" agora: status=published E dentro da janela de
 * tempo (ou sem janela definida). O Studio já tinha o CRUD completo de
 * eventos/promoções, mas nada no jogo consumia isso — o jogador não tinha
 * como saber que uma promoção estava rolando.
 */
export async function GET() {
  try {
    const now = new Date();
    const inWindow = (startsAt: any, endsAt: any) =>
      and(
        or(isNull(startsAt), lte(startsAt, now)),
        or(isNull(endsAt), gte(endsAt, now)),
      );

    const [events, promotions] = await Promise.all([
      db
        .select({ key: adminEvents.key, name: adminEvents.name, description: adminEvents.description, type: adminEvents.type, endsAt: adminEvents.endsAt, rules: adminEvents.rules })
        .from(adminEvents)
        .where(and(eq(adminEvents.status, "published"), inWindow(adminEvents.startsAt, adminEvents.endsAt))),
      db
        .select({ key: adminPromotions.key, name: adminPromotions.name, description: adminPromotions.description, type: adminPromotions.type, endsAt: adminPromotions.endsAt })
        .from(adminPromotions)
        .where(and(eq(adminPromotions.status, "published"), inWindow(adminPromotions.startsAt, adminPromotions.endsAt))),
    ]);

    const items = [
      ...events.map((e) => ({ ...e, kind: "event" as const })),
      ...promotions.map((p) => ({ ...p, kind: "promotion" as const })),
    ];
    return Response.json({ ok: true, items });
  } catch {
    // Se o banco estiver indisponível, o banner simplesmente não aparece —
    // nunca deve derrubar a home/o jogo.
    return Response.json({ ok: true, items: [] });
  }
}
