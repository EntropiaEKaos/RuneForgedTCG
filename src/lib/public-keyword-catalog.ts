import { CANONICAL_KEYWORDS, KEYWORD_INFO, type KeywordRuntimeDomain } from "@/game/keywords";
import type { Keyword } from "@/game/types";
import { sanitizeKeywordBehavior } from "@/game/mechanics-authoring";
import type { PublicCardDto } from "@/lib/public-card-catalog";

export type PublicKeywordSource = "canonical" | "custom";

export type PublicKeywordDto = {
  key: string;
  name: string;
  description: string;
  icon: string;
  source: PublicKeywordSource;
  engineKeyword?: Keyword;
  runtimeDomains: KeywordRuntimeDomain[];
  grantable: boolean;
  requiresTrigger?: string;
  timing?: string;
  cardCount: number;
};

export type PublicCustomKeywordRow = {
  key: string;
  name: string;
  description: string;
  icon: string | null;
  engineKeyword: string | null;
  behavior: unknown;
  enabled: boolean;
};

function canonicalKeyword(value: unknown): Keyword | null {
  return typeof value === "string" && (CANONICAL_KEYWORDS as readonly string[]).includes(value)
    ? value as Keyword
    : null;
}

export function countPublicKeywordUsage(cards: PublicCardDto[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of cards) {
    for (const key of new Set([...card.keywords, ...card.customKeywords])) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

export function canonicalPublicKeywords(usage: Map<string, number>): PublicKeywordDto[] {
  return CANONICAL_KEYWORDS.map((key) => {
    const info = KEYWORD_INFO[key];
    return {
      key,
      name: info.name,
      description: info.desc,
      icon: info.icon,
      source: "canonical" as const,
      engineKeyword: key,
      runtimeDomains: [...info.runtimeDomains],
      grantable: info.grantable,
      ...(info.requiresTrigger ? { requiresTrigger: info.requiresTrigger, timing: info.requiresTrigger } : {}),
      cardCount: usage.get(key) ?? 0,
    };
  });
}

export function toPublicCustomKeyword(
  row: PublicCustomKeywordRow,
  usage: Map<string, number>,
): PublicKeywordDto | null {
  if (!row.enabled) return null;

  const native = canonicalKeyword(row.engineKeyword);
  if (native) {
    const info = KEYWORD_INFO[native];
    return {
      key: row.key,
      name: row.name || info.name,
      description: row.description || info.desc,
      icon: row.icon || info.icon,
      source: "custom",
      engineKeyword: native,
      runtimeDomains: [...info.runtimeDomains],
      grantable: info.grantable,
      ...(info.requiresTrigger ? { requiresTrigger: info.requiresTrigger, timing: info.requiresTrigger } : {}),
      cardCount: usage.get(row.key) ?? 0,
    };
  }

  const behavior = sanitizeKeywordBehavior(row.behavior);
  if (!behavior) return null;

  return {
    key: row.key,
    name: row.name || row.key,
    description: row.description,
    icon: row.icon || "✦",
    source: "custom",
    runtimeDomains: [],
    grantable: false,
    timing: behavior.trigger,
    cardCount: usage.get(row.key) ?? 0,
  };
}

export function buildPublicKeywordCatalog(
  cards: PublicCardDto[],
  customRows: PublicCustomKeywordRow[],
): PublicKeywordDto[] {
  const usage = countPublicKeywordUsage(cards);
  const canonical = canonicalPublicKeywords(usage);
  const custom = customRows
    .map((row) => toPublicCustomKeyword(row, usage))
    .filter((row): row is PublicKeywordDto => Boolean(row))
    .sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));

  return [...canonical, ...custom];
}
