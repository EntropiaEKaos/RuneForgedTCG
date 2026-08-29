import { NextRequest } from "next/server";
import { db } from "@/db";
import { customCards, cardCatalogMeta } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, adminRoleAllowed } from "@/lib/admin-auth";
import { baseCardsOnly } from "@/game/cards";
import { refreshCustomCardCache } from "@/game/catalog";
import type { CardDef } from "@/game/types";
import {
  CARD_REGIONS, CARD_TYPES, CARD_RARITIES, CARD_RACES, CARD_KEYWORDS,
  CARD_EFFECT_KINDS, CARD_TARGETS, CARD_TRIGGERS,
} from "@/game/card-authoring";
import { validateAuthorableCardWithActivatedAbilities } from "@/game/activated-ability-authoring";

export const dynamic = "force-dynamic";

export const validateCard = validateAuthorableCardWithActivatedAbilities;

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, ["designer", "qa", "publisher"])) return Response.json({ ok: false, error: `Role ${actor.role} cannot access card catalog` }, { status: 403 });
  try {
    const custom = await db.select().from(customCards).orderBy(desc(customCards.updatedAt));
    const base = baseCardsOnly();
    return Response.json({
      ok: true,
      meta: {
        regions: CARD_REGIONS,
        types: CARD_TYPES,
        rarities: CARD_RARITIES,
        races: CARD_RACES,
        keywords: CARD_KEYWORDS,
        effectKinds: CARD_EFFECT_KINDS,
        targets: CARD_TARGETS,
        triggers: CARD_TRIGGERS,
      },
      base: base.map((c) => ({ ...c, source: "base" as const })),
      custom: custom.map((r) => ({
        ...(r.data as CardDef),
        source: "custom" as const,
        enabled: r.enabled,
        dbId: r.id,
      })),
    });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, "designer")) return Response.json({ ok: false, error: `Role ${actor.role} cannot create cards` }, { status: 403 });
  try {
    const body = await req.json();
    const rawCard = body?.card && typeof body.card === "object" ? body.card : body;
    const metadata = body?.metadata && typeof body.metadata === "object" ? body.metadata : null;
    const result = validateCard(rawCard);
    if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: 400 });
    const card = result.card;
    if (baseCardsOnly().some((c) => c.defId === card.defId)) return Response.json({ ok: false, error: "Cannot overwrite a base card. Use a different defId." }, { status: 400 });
    const [existing] = await db.select().from(customCards).where(eq(customCards.defId, card.defId)).limit(1);
    if (existing) return Response.json({ ok: false, error: "Card defId already exists. Use PUT to update." }, { status: 409 });
    const row = await db.transaction(async (tx) => {
      const [created] = await tx.insert(customCards).values({ defId: card.defId, name: card.name, region: card.region, type: card.type, cost: card.cost, enabled: false, data: card }).returning();
      if (metadata) await tx.insert(cardCatalogMeta).values({ defId: card.defId, collectionId: metadata.collectionId ? Number(metadata.collectionId) : null, tags: Array.isArray(metadata.tags) ? metadata.tags : [], classKeys: Array.isArray(metadata.classKeys) ? metadata.classKeys : card.classes || [], raceKeys: Array.isArray(metadata.raceKeys) ? metadata.raceKeys : card.race ? [card.race] : [], releaseState: "draft", notes: metadata.notes ? String(metadata.notes).slice(0,1000) : null }).onConflictDoUpdate({ target: cardCatalogMeta.defId, set: { collectionId: metadata.collectionId ? Number(metadata.collectionId) : null, tags: Array.isArray(metadata.tags) ? metadata.tags : [], classKeys: Array.isArray(metadata.classKeys) ? metadata.classKeys : card.classes || [], raceKeys: Array.isArray(metadata.raceKeys) ? metadata.raceKeys : card.race ? [card.race] : [], notes: metadata.notes ? String(metadata.notes).slice(0,1000) : null, updatedAt: new Date() } });
      return created;
    });
    await refreshCustomCardCache();
    return Response.json({ ok: true, card: { ...card, dbId: row.id, enabled: row.enabled, source: "custom" } });
  } catch { return Response.json({ ok: false, error: "Internal server error" }, { status: 500 }); }
}
