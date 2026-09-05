import type { CardDef, Rarity, Region } from "@/game/types";
import type { CardCollectionIdentity } from "@/game/card-collections";

export type PublicCardCollection = Pick<CardCollectionIdentity, "key" | "code" | "name" | "symbol">;

export type PublicCardDto = {
  defId: string;
  name: string;
  region: Region;
  regions: Region[];
  type: string;
  structuralType: CardDef["type"];
  archetypeKey?: string;
  archetypeName?: string;
  cost: number;
  power?: number;
  health?: number;
  keywords: string[];
  customKeywords: string[];
  description: string;
  flavor?: string;
  rarity: Rarity;
  races: string[];
  classes: string[];
  isLegend: boolean;
  isChampion: boolean;
  art?: string;
  emoji: string;
  strategicRole?: string;
  doctrineAffinities: string[];
  collection: PublicCardCollection;
};

export type PublicCardCatalogQuery = {
  q?: string | null;
  region?: string | null;
  type?: string | null;
  rarity?: string | null;
  collection?: string | null;
  page?: number | null;
  pageSize?: number | null;
};

export type PublicCardCatalogFacets = {
  regions: Array<{ value: string; count: number }>;
  types: Array<{ value: string; count: number }>;
  rarities: Array<{ value: string; count: number }>;
  collections: Array<{ value: string; label: string; count: number }>;
};

export type PublicCardCatalogResult = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: PublicCardDto[];
  facets: PublicCardCatalogFacets;
};

function unique(values: Array<string | undefined | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function normalized(value: string | null | undefined) {
  return String(value ?? "").trim().toLocaleLowerCase("en-US");
}

export function toPublicCardDto(card: CardDef, collection: CardCollectionIdentity | null): PublicCardDto | null {
  if (!collection) return null;
  const regions = unique([...(card.regions ?? []), card.region]) as Region[];
  return {
    defId: card.defId,
    name: card.name,
    region: card.region,
    regions,
    type: card.archetypeName || card.type,
    structuralType: card.type,
    ...(card.archetypeKey ? { archetypeKey: card.archetypeKey } : {}),
    ...(card.archetypeName ? { archetypeName: card.archetypeName } : {}),
    cost: card.cost,
    ...(typeof card.power === "number" ? { power: card.power } : {}),
    ...(typeof card.health === "number" ? { health: card.health } : {}),
    keywords: [...(card.keywords ?? [])],
    customKeywords: [...(card.customKeywords ?? [])],
    description: card.description,
    ...(card.flavor ? { flavor: card.flavor } : {}),
    rarity: card.rarity,
    races: unique([card.race, ...(card.secondaryRaces ?? [])]),
    classes: unique(card.classes ?? []),
    isLegend: Boolean(card.isLegend),
    isChampion: Boolean(card.isChampion),
    ...(card.art ? { art: card.art } : {}),
    emoji: card.emoji,
    ...(card.strategicRole ? { strategicRole: card.strategicRole } : {}),
    doctrineAffinities: unique(card.doctrineAffinities ?? []),
    collection: {
      key: collection.key,
      code: collection.code,
      name: collection.name,
      symbol: collection.symbol ?? null,
    },
  };
}

function countFacet(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count }));
}

export function queryPublicCardCatalog(cards: PublicCardDto[], query: PublicCardCatalogQuery): PublicCardCatalogResult {
  const q = normalized(query.q);
  const region = normalized(query.region);
  const type = normalized(query.type);
  const rarity = normalized(query.rarity);
  const collection = normalized(query.collection);

  const sorted = [...cards].sort((a, b) => a.name.localeCompare(b.name) || a.defId.localeCompare(b.defId));
  const filtered = sorted.filter((card) => {
    if (q) {
      const haystack = [
        card.name,
        card.defId,
        card.description,
        card.flavor,
        card.region,
        ...card.regions,
        card.type,
        card.structuralType,
        card.rarity,
        ...card.keywords,
        ...card.customKeywords,
        ...card.races,
        ...card.classes,
        card.collection.name,
        card.collection.code,
      ].join(" ").toLocaleLowerCase("en-US");
      if (!haystack.includes(q)) return false;
    }
    if (region && !card.regions.some((value) => normalized(value) === region)) return false;
    if (type && normalized(card.type) !== type && normalized(card.structuralType) !== type) return false;
    if (rarity && normalized(card.rarity) !== rarity) return false;
    if (collection && normalized(card.collection.key) !== collection && normalized(card.collection.code) !== collection) return false;
    return true;
  });

  const pageSize = Math.min(100, Math.max(1, Math.trunc(Number(query.pageSize) || 48)));
  const requestedPage = Math.max(1, Math.trunc(Number(query.page) || 1));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;

  const collectionCounts = new Map<string, { label: string; count: number }>();
  for (const card of sorted) {
    const key = card.collection.key;
    const current = collectionCounts.get(key);
    collectionCounts.set(key, { label: card.collection.name, count: (current?.count ?? 0) + 1 });
  }

  return {
    total: filtered.length,
    page,
    pageSize,
    totalPages,
    items: filtered.slice(start, start + pageSize),
    facets: {
      regions: countFacet(sorted.flatMap((card) => card.regions)),
      types: countFacet(sorted.map((card) => card.type)),
      rarities: countFacet(sorted.map((card) => card.rarity)),
      collections: [...collectionCounts.entries()]
        .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
        .map(([value, data]) => ({ value, label: data.label, count: data.count })),
    },
  };
}
