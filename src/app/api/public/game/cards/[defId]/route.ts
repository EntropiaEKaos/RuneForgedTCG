import { ensureCustomCardsLoaded } from "@/game/catalog";
import { getCardCollection } from "@/game/card-collections";
import { allCards } from "@/game/cards";
import { toPublicCardDto } from "@/lib/public-card-catalog";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ defId: string }> }) {
  try {
    await ensureCustomCardsLoaded();
    const defId = decodeURIComponent((await params).defId || "").trim();
    if (!defId || defId.length > 160) {
      return Response.json({ ok: false, error: "Invalid card id" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const card = allCards().find((candidate) => candidate.defId === defId && candidate.collectible !== false);
    const item = card ? toPublicCardDto(card, getCardCollection(card.defId)) : null;
    if (!item) {
      return Response.json({ ok: false, error: "Public card not found" }, {
        status: 404,
        headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
      });
    }

    return Response.json({ ok: true, item }, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch {
    return Response.json({ ok: false, error: "Public card catalog unavailable" }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
