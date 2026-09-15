import { ensureCustomCardsLoaded, getCustomCardCatalogRevision, listCustomCardsCached } from "@/game/catalog";
import { baseCardsOnly } from "@/game/cards";
import { loadGameConfig } from "@/game/settings";
import { db } from "@/db";
import { adminCollections, adminGameDefinitions, cardCatalogMeta, cardCosmeticVariants } from "@/db/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getRuntimeDecks, getRuntimeDefinition, getRuntimeDoctrines } from "@/lib/control-plane";
import { rankedOperational, rankedReleaseCertified } from "@/lib/runtime-gates";

export const dynamic = "force-dynamic";
const FRAME_PRESET_DOMAIN = "card-frame-presets";

export async function GET() {
  try {
    await ensureCustomCardsLoaded();
    const config = await loadGameConfig();
    const [decks, doctrines, visualTheme, localization] = await Promise.all([getRuntimeDecks(), getRuntimeDoctrines(), getRuntimeDefinition("visual-themes", config.advanced.presentation.defaultTheme), getRuntimeDefinition("localizations", config.advanced.localization.defaultLocale.toLowerCase())]);
    const [collectionRevisionRow, cardCollections, cardArt, cardCosmetics, framePresetRows] = await Promise.all([
      db.select({
        revision: sql<string>`concat(
          coalesce((select max(${cardCatalogMeta.updatedAt})::text from ${cardCatalogMeta}), ''), ':',
          coalesce((select count(*)::text from ${cardCatalogMeta}), '0'), ':',
          coalesce((select max(${adminCollections.updatedAt})::text from ${adminCollections}), ''), ':',
          coalesce((select count(*)::text from ${adminCollections}), '0'), ':',
          coalesce((select max(${cardCosmeticVariants.updatedAt})::text from ${cardCosmeticVariants}), ''), ':',
          coalesce((select count(*)::text from ${cardCosmeticVariants}), '0'), ':',
          coalesce((select max(${adminGameDefinitions.updatedAt})::text from ${adminGameDefinitions} where ${adminGameDefinitions.domain} = 'card-frame-presets'), ''), ':',
          coalesce((select count(*)::text from ${adminGameDefinitions} where ${adminGameDefinitions.domain} = 'card-frame-presets'), '0')
        )`,
      }).from(cardCatalogMeta).limit(1),
      db.select({
        defId: cardCatalogMeta.defId,
        id: adminCollections.id,
        key: adminCollections.key,
        code: adminCollections.code,
        name: adminCollections.name,
        symbol: adminCollections.symbol,
      })
      .from(cardCatalogMeta)
      .innerJoin(adminCollections, eq(cardCatalogMeta.collectionId, adminCollections.id))
      .where(eq(adminCollections.status, "published")),
      db.select({ defId: cardCatalogMeta.defId, url: cardCatalogMeta.artUrl, crop: cardCatalogMeta.artCrop })
        .from(cardCatalogMeta)
        .innerJoin(adminCollections, eq(cardCatalogMeta.collectionId, adminCollections.id))
        .where(and(eq(adminCollections.status, "published"), isNotNull(cardCatalogMeta.artUrl))),
      db.select({
        id: cardCosmeticVariants.id,
        defId: cardCosmeticVariants.defId,
        variantId: cardCosmeticVariants.variantId,
        name: cardCosmeticVariants.name,
        kind: cardCosmeticVariants.kind,
        frameId: cardCosmeticVariants.frameId,
        finish: cardCosmeticVariants.finish,
        artUrl: cardCosmeticVariants.artUrl,
        animationUrl: cardCosmeticVariants.animationUrl,
        artCrop: cardCosmeticVariants.artCrop,
        edition: cardCosmeticVariants.edition,
        serialLimit: cardCosmeticVariants.serialLimit,
        acquisition: cardCosmeticVariants.acquisition,
        packEligible: cardCosmeticVariants.packEligible,
        dropWeight: cardCosmeticVariants.dropWeight,
        metadata: cardCosmeticVariants.metadata,
        status: cardCosmeticVariants.status,
        enabled: cardCosmeticVariants.enabled,
      }).from(cardCosmeticVariants).where(and(eq(cardCosmeticVariants.status, "published"), eq(cardCosmeticVariants.enabled, true))),
      db.select({
        id: adminGameDefinitions.id,
        key: adminGameDefinitions.key,
        name: adminGameDefinitions.name,
        description: adminGameDefinitions.description,
        payload: adminGameDefinitions.payload,
        status: adminGameDefinitions.status,
        enabled: adminGameDefinitions.enabled,
        revision: adminGameDefinitions.revision,
      }).from(adminGameDefinitions).where(and(
        eq(adminGameDefinitions.domain, FRAME_PRESET_DOMAIN),
        eq(adminGameDefinitions.status, "published"),
        eq(adminGameDefinitions.enabled, true),
      )),
    ]);
    const framePresets = framePresetRows.map((row) => {
      const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload as Record<string, unknown> : {};
      return { id: row.id, key: row.key, name: row.name, description: row.description, config: payload.config || payload, status: row.status, enabled: row.enabled, revision: row.revision };
    });
    return Response.json({
      ok: true,
      config: {
        maintenanceMode: config.maintenanceMode,
        announcement: config.announcement,
        aiEnabled: config.aiEnabled,
        rankedEnabled: rankedOperational(config),
        rankedConfigured: config.rankedEnabled,
        rankedCertified: rankedReleaseCertified(),
        reactionMs: config.reactionMs,
        nexusStart: config.nexusStart,
        maxMana: config.maxMana,
        deckMin: config.deckMin,
        deckMax: config.deckMax,
        maxCopies: config.maxCopies,
        maxRegions: config.maxRegions,
        maxSpellMana: config.maxSpellMana,
        handCap: config.handCap,
        startHand: config.startHand,
        benchCap: config.benchCap,
        permanentsCap: config.permanentsCap,
        engine: config.advanced.engine,
        ai: config.advanced.ai,
        advanced: { engine: config.advanced.engine, ai: config.advanced.ai },
      },
      baseCount: baseCardsOnly().length,
      catalogRevision: `${getCustomCardCatalogRevision()}:${collectionRevisionRow[0]?.revision ?? "empty"}`,
      custom: listCustomCardsCached(),
      cardCollections,
      cardArt: cardArt.filter((row) => typeof row.url === "string" && row.url),
      cardCosmetics,
      framePresets,
      decks,
      doctrines,
      presentation: config.advanced.presentation,
      visualTheme,
      localization: { ...config.advanced.localization, dictionary: localization?.strings || {} },
    });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
