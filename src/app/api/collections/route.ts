import { db } from "@/db";
import { adminCollections, cardCatalogMeta } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Endpoint público (sem auth) — lista as coleções/sets publicados, com a
 * contagem de cartas de cada uma. O Studio já tinha o CRUD completo em
 * /api/admin/... para adminCollections, mas nada expunha isso pro jogador;
 * "coleção" ficava só metadado técnico, nunca virava algo que o jogador via.
 */
export async function GET() {
  try {
    const rows = await db
      .select()
      .from(adminCollections)
      .where(eq(adminCollections.status, "published"))
      .orderBy(adminCollections.releaseDate);

    const counts = await db
      .select({ collectionId: cardCatalogMeta.collectionId, n: sql<number>`count(*)::int` })
      .from(cardCatalogMeta)
      .groupBy(cardCatalogMeta.collectionId);
    const countById = new Map(counts.map((c) => [c.collectionId, c.n]));

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
        cardCount: countById.get(c.id) ?? 0,
        metadata: c.metadata,
      })),
    });
  } catch {
    return Response.json({ ok: true, collections: [] });
  }
}
