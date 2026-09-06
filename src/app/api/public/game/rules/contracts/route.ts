import { collectibleCards } from "@/game/cards";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import { getCardCollection } from "@/game/card-collections";
import { toPublicCardDto } from "@/lib/public-card-catalog";
import { buildPublicRulesContracts } from "@/lib/public-rules-contracts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureCustomCardsLoaded();

    const publicCards = collectibleCards()
      .map((card) => toPublicCardDto(card, getCardCollection(card.defId)))
      .filter((card): card is NonNullable<typeof card> => Boolean(card));

    const contracts = buildPublicRulesContracts(publicCards);

    return Response.json({ ok: true, ...contracts }, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch {
    return Response.json({ ok: false, error: "Public rules contracts unavailable" }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
