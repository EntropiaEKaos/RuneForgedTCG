import { db } from "@/db";
import { adminKeywords } from "@/db/schema";
import { eq } from "drizzle-orm";
import { collectibleCards } from "@/game/cards";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import { getCardCollection } from "@/game/card-collections";
import { toPublicCardDto } from "@/lib/public-card-catalog";
import { buildPublicKeywordCatalog } from "@/lib/public-keyword-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureCustomCardsLoaded();

    const [customRows, publicCards] = await Promise.all([
      db.select({
        key: adminKeywords.key,
        name: adminKeywords.name,
        description: adminKeywords.description,
        icon: adminKeywords.icon,
        engineKeyword: adminKeywords.engineKeyword,
        behavior: adminKeywords.behavior,
        enabled: adminKeywords.enabled,
      }).from(adminKeywords).where(eq(adminKeywords.enabled, true)),
      Promise.resolve(
        collectibleCards()
          .map((card) => toPublicCardDto(card, getCardCollection(card.defId)))
          .filter((card): card is NonNullable<typeof card> => Boolean(card)),
      ),
    ]);

    const items = buildPublicKeywordCatalog(publicCards, customRows);

    return Response.json({ ok: true, total: items.length, items }, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch {
    return Response.json({ ok: false, error: "Public keyword catalog unavailable" }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
