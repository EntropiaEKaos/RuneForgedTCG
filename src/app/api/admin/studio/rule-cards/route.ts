import { NextRequest } from "next/server";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, adminRoleAllowed } from "@/lib/admin-auth";
import { allCards } from "@/game/cards";
import { ensureCustomCardsLoaded } from "@/game/catalog";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, ["designer", "qa"])) return Response.json({ ok: false, error: `Role ${actor.role} cannot access rule fixtures` }, { status: 403 });
  try {
    await ensureCustomCardsLoaded();
    const cards = allCards()
      .filter((card) => card.type === "Unit")
      .map((card) => ({ defId: card.defId, name: card.name, emoji: card.emoji, region: card.region, race: card.race, secondaryRaces: card.secondaryRaces ?? [], classes: card.classes ?? [], power: card.power ?? 0, health: card.health ?? 1, keywords: card.keywords ?? [], rarity: card.rarity }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return Response.json({ ok: true, cards });
  } catch {
    return Response.json({ ok: false, error: "Could not load card fixtures" }, { status: 500 });
  }
}
