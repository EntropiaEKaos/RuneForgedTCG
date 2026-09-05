import { NextRequest } from "next/server";
import { collectibleCards, baseCardsOnly } from "@/game/cards";
import { ensureCustomCardsLoaded, getCustomCardCatalogRevision } from "@/game/catalog";
import { getCardCollection } from "@/game/card-collections";
import { queryPublicCardCatalog, toPublicCardDto } from "@/lib/public-card-catalog";

export const dynamic = "force-dynamic";

function numberParam(value: string | null) {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(req: NextRequest) {
  try {
    await ensureCustomCardsLoaded();

    const publicCards = collectibleCards()
      .map((card) => toPublicCardDto(card, getCardCollection(card.defId)))
      .filter((card): card is NonNullable<typeof card> => Boolean(card));

    const params = req.nextUrl.searchParams;
    const result = queryPublicCardCatalog(publicCards, {
      q: params.get("q"),
      region: params.get("region"),
      type: params.get("type"),
      rarity: params.get("rarity"),
      collection: params.get("collection"),
      page: numberParam(params.get("page")),
      pageSize: numberParam(params.get("pageSize")),
    });

    return Response.json({
      ok: true,
      catalogRevision: `${baseCardsOnly().length}:${getCustomCardCatalogRevision()}`,
      ...result,
    }, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return Response.json({ ok: false, error: "Public card catalog unavailable" }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
