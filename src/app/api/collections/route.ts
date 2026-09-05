import { db } from "@/db";
import { adminCollections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { collectibleCards } from "@/game/cards";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import { getCardCollection } from "@/game/card-collections";
import { countPublicCardsByCollection } from "@/lib/public-card-catalog";

export const dynamic = "force-dynamic";

/**
 * Public published-set index.
 *
 * Card counts intentionally use the exact same public collection identity
 * boundary as /api/public/game/cards. Counting only card_catalog_meta rows
 * under-counts code-authored waves that resolve through canonical collection
 * identity (for example later Vanilla waves).
 */
export async function GET() {
  try {
    await ensureCustomCardsLoaded();

    const rows = await db
      .select()
      .from(adminCollections)
      .where(eq(adminCollections.status, "published"))
      .orderBy(adminCollections.releaseDate);

    const publicCounts = countPublicCardsByCollection(collectibleCards(), getCardCollection);

    return Response.json({
      ok: true,
      collections: rows.map((c) => ({
        key: c.key,
        code: c.code,
        name: c.name,
        description: c.description,
        symbol: c.symbol,
        banner: c.banner,
        releaseDate: c.releaseDate,
        rotationDate: c.rotationDate,
        lifecycle: (() => {
          const now = Date.now();
          if (c.releaseDate && c.releaseDate.getTime() > now) return "upcoming";
          if (c.rotationDate && c.rotationDate.getTime() <= now) return "rotated";
          return "active";
        })(),
        cardCount: publicCounts.get(c.key) ?? 0,
        metadata: c.metadata,
      })),
    }, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return Response.json({ ok: false, error: "Public collections unavailable" }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
