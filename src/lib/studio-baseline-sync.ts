import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  adminClasses,
  adminCollections,
  adminEffects,
  adminKeywords,
  adminRaces,
  cardCatalogMeta,
} from "@/db/schema";
import { baseCardsOnly } from "@/game/cards";
import { VANILLA_COLLECTION } from "@/game/card-collections";
import {
  CARD_EFFECT_CONTRACTS,
  CARD_EFFECT_KINDS,
  CARD_RACES,
} from "@/game/card-authoring";
import { CANONICAL_KEYWORDS, KEYWORD_INFO, RACE_INFO } from "@/game/keywords";

function titleCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (part) => part.toUpperCase());
}

export function buildStudioBaseline() {
  const cards = baseCardsOnly();
  const classes = [...new Set(cards.flatMap((card) => Array.isArray(card.classes) ? card.classes : []))]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((a, b) => a.localeCompare(b));

  const keywords = CANONICAL_KEYWORDS.map((key) => {
    const info = KEYWORD_INFO[key];
    return {
      key,
      name: info.name,
      description: info.desc,
      icon: info.icon,
      engineKeyword: key,
      behavior: {},
      enabled: true,
    };
  });

  const effects = CARD_EFFECT_KINDS.map((kind) => ({
    key: kind,
    name: titleCase(kind),
    description: `Canonical RuneForge engine effect primitive: ${kind}.`,
    kind,
    schema: CARD_EFFECT_CONTRACTS[kind],
    enabled: true,
  }));

  const races = CARD_RACES.map((key) => {
    const usedRegions = [...new Set(cards
      .filter((card) => card.race === key)
      .flatMap((card) => Array.isArray(card.regions) && card.regions.length ? card.regions : [card.region])
      .filter(Boolean))];
    return {
      key,
      name: RACE_INFO[key]?.name ?? titleCase(key),
      description: "Canonical RuneForge race used by code-authored cards.",
      icon: RACE_INFO[key]?.icon ?? null,
      region: usedRegions.length === 1 ? String(usedRegions[0]) : null,
      color: null,
      enabled: true,
    };
  });

  const classRows = classes.map((key) => ({
    key,
    name: titleCase(key),
    description: "RuneForge class discovered from the certified code-authored card baseline.",
    icon: null,
    color: null,
    enabled: true,
  }));

  return {
    cards,
    keywords,
    effects,
    races,
    classes: classRows,
    collection: {
      key: VANILLA_COLLECTION.key,
      name: VANILLA_COLLECTION.name,
      description: "First certified RuneForge collection. Code-authored launch cards belong to Vanilla unless explicitly reassigned by published Studio metadata.",
      code: VANILLA_COLLECTION.code,
      symbol: VANILLA_COLLECTION.symbol ?? null,
      banner: null,
      status: "published",
      metadata: { source: "code-baseline", managedBy: "studio-baseline-sync" },
    },
  };
}

export type StudioBaselineSyncResult = {
  inserted: {
    keywords: number;
    effects: number;
    races: number;
    classes: number;
    collections: number;
    cardMeta: number;
  };
  totals: {
    keywords: number;
    effects: number;
    races: number;
    classes: number;
    baseCards: number;
  };
  vanillaCollectionId: number;
};

export async function syncStudioBaseline(executor: any = db): Promise<StudioBaselineSyncResult> {
  const baseline = buildStudioBaseline();

  return executor.transaction(async (tx: any) => {
    const insertedCollections = await tx.insert(adminCollections)
      .values(baseline.collection)
      .onConflictDoNothing({ target: adminCollections.key })
      .returning({ id: adminCollections.id });

    const [vanilla] = await tx.select({ id: adminCollections.id })
      .from(adminCollections)
      .where(eq(adminCollections.key, baseline.collection.key))
      .limit(1);
    if (!vanilla?.id) throw new Error("Studio baseline sync could not resolve the Vanilla collection");

    const insertedKeywords = baseline.keywords.length
      ? await tx.insert(adminKeywords).values(baseline.keywords).onConflictDoNothing({ target: adminKeywords.key }).returning({ id: adminKeywords.id })
      : [];
    const insertedEffects = baseline.effects.length
      ? await tx.insert(adminEffects).values(baseline.effects).onConflictDoNothing({ target: adminEffects.key }).returning({ id: adminEffects.id })
      : [];
    const insertedRaces = baseline.races.length
      ? await tx.insert(adminRaces).values(baseline.races).onConflictDoNothing({ target: adminRaces.key }).returning({ id: adminRaces.id })
      : [];
    const insertedClasses = baseline.classes.length
      ? await tx.insert(adminClasses).values(baseline.classes).onConflictDoNothing({ target: adminClasses.key }).returning({ id: adminClasses.id })
      : [];

    const metaRows = baseline.cards.map((card) => ({
      defId: card.defId,
      collectionId: vanilla.id,
      tags: ["vanilla", "code-baseline"],
      classKeys: Array.isArray(card.classes) ? card.classes : [],
      raceKeys: card.race ? [card.race] : [],
      releaseState: "published",
      notes: "Synchronized from the certified code-authored baseline. Base card gameplay remains engine-authoritative.",
    }));
    const insertedMeta = metaRows.length
      ? await tx.insert(cardCatalogMeta).values(metaRows).onConflictDoNothing({ target: cardCatalogMeta.defId }).returning({ id: cardCatalogMeta.id })
      : [];

    return {
      inserted: {
        keywords: insertedKeywords.length,
        effects: insertedEffects.length,
        races: insertedRaces.length,
        classes: insertedClasses.length,
        collections: insertedCollections.length,
        cardMeta: insertedMeta.length,
      },
      totals: {
        keywords: baseline.keywords.length,
        effects: baseline.effects.length,
        races: baseline.races.length,
        classes: baseline.classes.length,
        baseCards: baseline.cards.length,
      },
      vanillaCollectionId: vanilla.id,
    };
  });
}
