export const CARD_COSMETIC_KINDS = ["premium_frame", "full_art", "foil", "animated", "serialized"] as const;
export const CARD_COSMETIC_ACQUISITIONS = ["pack", "event", "promotion", "market", "grant"] as const;
export const CARD_COSMETIC_PRESTIGE_TIERS = ["forged", "scarce", "exalted", "relic", "exclusive"] as const;

export type CardCosmeticKind = typeof CARD_COSMETIC_KINDS[number];
export type CardCosmeticAcquisition = typeof CARD_COSMETIC_ACQUISITIONS[number];
export type CardCosmeticPrestigeId = typeof CARD_COSMETIC_PRESTIGE_TIERS[number];

export interface CardCosmeticPrestige {
  id: CardCosmeticPrestigeId;
  label: string;
  shortLabel: string;
  description: string;
  rank: number;
}

export interface CardCosmeticVariant {
  id?: number;
  defId: string;
  variantId: string;
  name: string;
  kind: CardCosmeticKind;
  frameId: string;
  finish: string;
  artUrl?: string | null;
  animationUrl?: string | null;
  artCrop?: { x?: number; y?: number; scale?: number } | null;
  edition?: string | null;
  serialLimit?: number | null;
  acquisition: CardCosmeticAcquisition;
  packEligible: boolean;
  dropWeight: number;
  metadata?: Record<string, unknown>;
  status?: string;
  enabled?: boolean;
}

export interface PlayerCardCosmeticPreference {
  defId: string;
  assetId: number;
  variantId: string;
  frameId: string;
  finish: string;
  serialNumber?: number | null;
}

export interface CardAppearanceSelection {
  variantId: string;
  serialNumber?: number | null;
  assetId?: number | null;
}

export interface ResolvedCardAppearance {
  defId: string;
  variantId: string;
  name: string;
  kind: CardCosmeticKind | "standard";
  frameId: string;
  finish: string;
  artUrl?: string | null;
  animationUrl?: string | null;
  artCrop?: { x?: number; y?: number; scale?: number } | null;
  edition?: string | null;
  serialLimit?: number | null;
  serialNumber?: number | null;
  assetId?: number | null;
}

/** Gameplay fields are intentionally illegal in cosmetic payloads. */
export const CARD_COSMETIC_FORBIDDEN_KEYS = new Set([
  "cost", "power", "health", "keywords", "description", "flavor", "rarity", "race", "classes",
  "isLegend", "isChampion", "collectible", "spell", "speed", "trigger", "levelUp", "equipment",
  "aura", "mechanics", "customKeywords", "regions", "region", "regionalPerk", "type", "emoji",
]);

const variantsByCard: Record<string, Record<string, CardCosmeticVariant>> = {};
const preferenceByCard: Record<string, PlayerCardCosmeticPreference> = {};

const COSMETIC_PRESTIGE: Record<CardCosmeticPrestigeId, CardCosmeticPrestige> = {
  forged: {
    id: "forged",
    label: "Forjada",
    shortLabel: "FORJADA",
    description: "Variante de pack com presença recorrente, mas ainda separada da impressão Standard.",
    rank: 1,
  },
  scarce: {
    id: "scarce",
    label: "Escassa",
    shortLabel: "ESCASSA",
    description: "Variante cosmética incomum, com chance nominal abaixo de 10% por cópia elegível.",
    rank: 2,
  },
  exalted: {
    id: "exalted",
    label: "Exaltada",
    shortLabel: "EXALTADA",
    description: "Variante cosmética premium, com chance nominal abaixo de 2,5% por cópia elegível.",
    rank: 3,
  },
  relic: {
    id: "relic",
    label: "Relíquia",
    shortLabel: "RELÍQUIA",
    description: "Variante cosmética extremamente rara, com chance nominal abaixo de 0,5% por cópia elegível.",
    rank: 4,
  },
  exclusive: {
    id: "exclusive",
    label: "Exclusiva",
    shortLabel: "EXCLUSIVA",
    description: "Variante distribuída fora da tabela normal de drops de pack.",
    rank: 5,
  },
};

/**
 * Cosmetic prestige is presentation-only and is derived from the already-authoritative
 * pack probability. It never reads or mutates gameplay rarity. dropWeight is PPM:
 * - Forjada: >= 100,000 PPM (>= 10%)
 * - Escassa: 25,000-99,999 PPM (2.5%-9.9999%)
 * - Exaltada: 5,000-24,999 PPM (0.5%-2.4999%)
 * - Relíquia: 1-4,999 PPM (< 0.5%)
 * - Exclusiva: event/promotion/market/grant or not pack-eligible.
 */
export function resolveCardCosmeticPrestige(
  variant: Pick<CardCosmeticVariant, "acquisition" | "packEligible" | "dropWeight"> | null | undefined,
): CardCosmeticPrestige {
  if (!variant || variant.acquisition !== "pack" || !variant.packEligible || variant.dropWeight <= 0) {
    return COSMETIC_PRESTIGE.exclusive;
  }
  if (variant.dropWeight >= 100_000) return COSMETIC_PRESTIGE.forged;
  if (variant.dropWeight >= 25_000) return COSMETIC_PRESTIGE.scarce;
  if (variant.dropWeight >= 5_000) return COSMETIC_PRESTIGE.exalted;
  return COSMETIC_PRESTIGE.relic;
}

export function cosmeticDropChancePercent(dropWeight: number): number {
  const ppm = Math.max(0, Math.min(1_000_000, Math.trunc(Number(dropWeight) || 0)));
  return ppm / 10_000;
}

function safeUrl(value: unknown): string | null {
  const url = typeof value === "string" ? value.trim() : "";
  return /^\/(?!\/)/.test(url) || /^https:\/\//i.test(url) ? url : null;
}
function safeCrop(value: unknown) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const x = Math.max(0, Math.min(1, Number(raw.x ?? .5)));
  const y = Math.max(0, Math.min(1, Number(raw.y ?? .5)));
  const scale = Math.max(1, Math.min(2.5, Number(raw.scale ?? 1)));
  return { x: Number.isFinite(x) ? x : .5, y: Number.isFinite(y) ? y : .5, scale: Number.isFinite(scale) ? scale : 1 };
}
function shortText(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

export function normalizeCardCosmeticInput(raw: unknown): { value: CardCosmeticVariant | null; errors: string[] } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { value: null, errors: ["Cosmetic payload must be an object"] };
  const source = raw as Record<string, unknown>;
  const errors: string[] = [];
  for (const key of CARD_COSMETIC_FORBIDDEN_KEYS) if (key in source) errors.push(`Gameplay field is forbidden in cosmetics: ${key}`);
  const defId = shortText(source.defId, 120);
  const variantId = shortText(source.variantId, 80);
  const name = shortText(source.name, 120);
  const kind = shortText(source.kind, 40) as CardCosmeticKind;
  const frameId = shortText(source.frameId || "default", 80);
  const finish = shortText(source.finish || "normal", 40);
  const acquisition = shortText(source.acquisition || "pack", 40) as CardCosmeticAcquisition;
  const serialLimit = source.serialLimit == null || source.serialLimit === "" ? null : Math.trunc(Number(source.serialLimit));
  const dropWeight = Math.trunc(Number(source.dropWeight ?? 0));
  if (!defId) errors.push("defId is required");
  if (!variantId || variantId === "standard") errors.push("variantId is required and 'standard' is reserved for the base appearance");
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(variantId)) errors.push("variantId must use letters, numbers, dash or underscore");
  if (!name) errors.push("name is required");
  if (!CARD_COSMETIC_KINDS.includes(kind)) errors.push("Invalid cosmetic kind");
  if (!CARD_COSMETIC_ACQUISITIONS.includes(acquisition)) errors.push("Invalid acquisition mode");
  if (!Number.isInteger(dropWeight) || dropWeight < 0 || dropWeight > 1_000_000) errors.push("dropWeight must be an integer between 0 and 1000000");
  if (serialLimit != null && (!Number.isInteger(serialLimit) || serialLimit < 1)) errors.push("serialLimit must be a positive integer");
  const artUrl = source.artUrl ? safeUrl(source.artUrl) : null;
  const animationUrl = source.animationUrl ? safeUrl(source.animationUrl) : null;
  if (source.artUrl && !artUrl) errors.push("artUrl must be a same-origin path or HTTPS URL");
  if (source.animationUrl && !animationUrl) errors.push("animationUrl must be a same-origin path or HTTPS URL");
  if (kind === "animated" && !animationUrl) errors.push("Animated cosmetics require animationUrl");
  if (kind === "serialized" && serialLimit == null) errors.push("Serialized cosmetics require serialLimit");
  if (errors.length) return { value: null, errors };
  return {
    value: {
      defId, variantId, name, kind, frameId, finish,
      artUrl, animationUrl, artCrop: safeCrop(source.artCrop),
      edition: source.edition ? shortText(source.edition, 80) : null,
      serialLimit,
      acquisition,
      packEligible: Boolean(source.packEligible),
      dropWeight,
      metadata: source.metadata && typeof source.metadata === "object" && !Array.isArray(source.metadata) ? source.metadata as Record<string, unknown> : {},
    },
    errors: [],
  };
}

export function replaceRegisteredCardCosmetics(rows: CardCosmeticVariant[]) {
  for (const key of Object.keys(variantsByCard)) delete variantsByCard[key];
  for (const raw of rows) {
    const normalized = normalizeCardCosmeticInput(raw);
    if (!normalized.value) continue;
    const value = { ...normalized.value, id: raw.id, status: raw.status, enabled: raw.enabled };
    (variantsByCard[value.defId] ||= {})[value.variantId] = value;
  }
}

export function replacePlayerCardCosmeticPreferences(rows: PlayerCardCosmeticPreference[]) {
  for (const key of Object.keys(preferenceByCard)) delete preferenceByCard[key];
  for (const row of rows) {
    if (!row?.defId || !row?.variantId || !Number.isInteger(row.assetId)) continue;
    preferenceByCard[row.defId] = { ...row };
  }
}

export function getCardCosmetics(defId: string): CardCosmeticVariant[] {
  return Object.values(variantsByCard[defId] || {});
}

export function getCardCosmetic(defId: string, variantId: string): CardCosmeticVariant | undefined {
  return variantsByCard[defId]?.[variantId];
}

export function getPreferredCardCosmetic(defId: string): PlayerCardCosmeticPreference | undefined {
  return preferenceByCard[defId];
}

export function resolveCardAppearance(
  defId: string,
  explicitVariantId?: string | null,
  explicitSelection?: CardAppearanceSelection | null,
): ResolvedCardAppearance {
  const preference = explicitSelection
    ? { defId, assetId: explicitSelection.assetId ?? 0, variantId: explicitSelection.variantId, serialNumber: explicitSelection.serialNumber }
    : preferenceByCard[defId];
  const variantId = explicitVariantId || explicitSelection?.variantId || preference?.variantId;
  const variant = variantId ? getCardCosmetic(defId, variantId) : undefined;
  if (!variant) return { defId, variantId: "standard", name: "Standard", kind: "standard", frameId: "default", finish: "normal" };
  return {
    defId,
    variantId: variant.variantId,
    name: variant.name,
    kind: variant.kind,
    frameId: variant.frameId,
    finish: variant.finish,
    artUrl: variant.artUrl,
    animationUrl: variant.animationUrl,
    artCrop: variant.artCrop,
    edition: variant.edition,
    serialLimit: variant.serialLimit,
    serialNumber: preference?.variantId === variant.variantId ? preference.serialNumber : null,
    assetId: preference?.variantId === variant.variantId ? preference.assetId : null,
  };
}

export function cosmeticClassNames(appearance: ResolvedCardAppearance): string[] {
  if (appearance.kind === "standard") return [];
  const prestige = resolveCardCosmeticPrestige(getCardCosmetic(appearance.defId, appearance.variantId));
  return [
    `card-cosmetic-${appearance.kind.replaceAll("_", "-")}`,
    `card-finish-${appearance.finish.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}`,
    `card-frame-${appearance.frameId.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}`,
    `card-prestige-${prestige.id}`,
  ];
}
