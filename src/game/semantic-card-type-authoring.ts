import "./aura-2-types";
import type { CardDef, Keyword } from "./types";
import { validateAuthorableCardWithActivatedAbilities } from "./activated-ability-authoring";
import {
  CANONICAL_KEYWORDS,
  keywordIsAuraGrantable,
  keywordIsAuraSuppressible,
} from "./keywords";
import {
  CERTIFIED_SEMANTIC_CARD_TYPES,
  type CertifiedSemanticCardTypeKey,
  validateCertifiedSemanticCardType,
} from "./semantic-card-types";

export type SemanticAuthoringResult =
  | { ok: true; card: CardDef }
  | { ok: false; error: string };

type ContinuousAuraRestore = {
  buffPower: number;
  buffHealth: number;
  keywords: Keyword[];
  suppressKeywords: Keyword[];
  affects?: "enemies";
};

type ContinuousAuraPrepared =
  | { ok: true; input: Partial<CardDef> & Record<string, unknown>; restore?: ContinuousAuraRestore }
  | { ok: false; error: string };

const canonicalKeyword = (value: unknown): value is Keyword =>
  typeof value === "string" && (CANONICAL_KEYWORDS as readonly string[]).includes(value);

/**
 * Compatibility boundary for Aura 2.x.
 *
 * The legacy stat-Aura sanitizer remains unchanged for historical payloads.
 * Extended Aura fields are validated here, projected through the legacy source
 * and filter checks with a harmless probe, then restored exactly afterward.
 */
function prepareContinuousAuraInput(raw: Partial<CardDef>): ContinuousAuraPrepared {
  const input = { ...raw } as Partial<CardDef> & Record<string, unknown>;
  const auraRaw = (raw as Partial<CardDef> & Record<string, unknown>).aura;
  if (!auraRaw || typeof auraRaw !== "object" || Array.isArray(auraRaw)) return { ok: true, input };

  const aura = auraRaw as unknown as Record<string, unknown>;
  const buffPower = Number(aura.buffPower ?? 0);
  const buffHealth = Number(aura.buffHealth ?? 0);
  const extended =
    "keywords" in aura ||
    "suppressKeywords" in aura ||
    "affects" in aura ||
    buffPower < 0 ||
    buffHealth < 0;
  if (!extended) return { ok: true, input };

  const rawAudience = aura.affects;
  if (rawAudience !== undefined && rawAudience !== "allies" && rawAudience !== "enemies") {
    return { ok: false, error: "Aura affects must be allies or enemies" };
  }
  const affects = rawAudience === "enemies" ? "enemies" : "allies";

  let keywords: Keyword[] = [];
  if (aura.keywords !== undefined) {
    if (!Array.isArray(aura.keywords)) return { ok: false, error: "Aura keywords must be an array" };
    if (aura.keywords.some((keyword) => !canonicalKeyword(keyword))) {
      return { ok: false, error: "Aura contains an unknown granted keyword" };
    }
    keywords = [...new Set(aura.keywords as Keyword[])];
  }

  let suppressKeywords: Keyword[] = [];
  if (aura.suppressKeywords !== undefined) {
    if (!Array.isArray(aura.suppressKeywords)) return { ok: false, error: "Aura suppressKeywords must be an array" };
    if (aura.suppressKeywords.some((keyword) => !canonicalKeyword(keyword))) {
      return { ok: false, error: "Aura contains an unknown suppressed keyword" };
    }
    suppressKeywords = [...new Set(aura.suppressKeywords as Keyword[])];
  }

  if (!Number.isInteger(buffPower) || !Number.isInteger(buffHealth) || buffPower < -20 || buffPower > 20 || buffHealth < -20 || buffHealth > 20) {
    return { ok: false, error: "Aura stat modifiers must be integers from -20 to 20" };
  }

  if (affects === "enemies") {
    if (buffPower > 0 || buffHealth > 0) {
      return { ok: false, error: "Enemy Auras may only apply non-positive Power/Health modifiers" };
    }
    if (keywords.length > 0) {
      return { ok: false, error: "Enemy Auras cannot grant continuous keywords" };
    }
    const unsafeSuppression = suppressKeywords.find((keyword) => !keywordIsAuraSuppressible(keyword));
    if (unsafeSuppression) {
      return { ok: false, error: `${unsafeSuppression} cannot be suppressed by a continuous Aura.` };
    }
    if (buffPower === 0 && buffHealth === 0 && suppressKeywords.length === 0) {
      return { ok: false, error: "Enemy Aura requires a negative stat modifier or at least one suppressed keyword" };
    }
  } else {
    if (buffPower < 0 || buffHealth < 0) {
      return { ok: false, error: "Allied Auras may only apply non-negative Power/Health modifiers" };
    }
    if (suppressKeywords.length > 0) {
      return { ok: false, error: "Allied Auras cannot suppress keywords" };
    }
    const unsafeGrant = keywords.find((keyword) => !keywordIsAuraGrantable(keyword));
    if (unsafeGrant) return { ok: false, error: `${unsafeGrant} cannot be granted by a continuous Aura.` };
    if (buffPower === 0 && buffHealth === 0 && keywords.length === 0) {
      return { ok: false, error: "Aura requires a stat modifier or at least one continuous keyword" };
    }
  }

  const legacyAura: Record<string, unknown> = { ...aura };
  delete legacyAura.keywords;
  delete legacyAura.suppressKeywords;
  delete legacyAura.affects;
  if (affects === "enemies") {
    legacyAura.buffPower = Math.abs(buffPower);
    legacyAura.buffHealth = Math.abs(buffHealth);
    // Suppression-only hostile Aura: probe legacy source/filter validation with +1.
    if (buffPower === 0 && buffHealth === 0) legacyAura.buffPower = 1;
  } else if (buffPower === 0 && buffHealth === 0) {
    // Keyword-only allied Aura: probe the legacy stat sanitizer with a temporary +1.
    legacyAura.buffPower = 1;
    legacyAura.buffHealth = 0;
  }
  (input as Record<string, unknown>).aura = legacyAura;

  return {
    ok: true,
    input,
    restore: {
      buffPower,
      buffHealth,
      keywords,
      suppressKeywords,
      ...(affects === "enemies" ? { affects: "enemies" as const } : {}),
    },
  };
}

/** Canonical publish/import/sandbox validator for cards plus certified semantic gameplay types. */
export function validateAuthorableCardWithSemanticTypes(
  raw: Partial<CardDef>,
): SemanticAuthoringResult {
  const prepared = prepareContinuousAuraInput(raw);
  if (!prepared.ok) return prepared;

  const base = validateAuthorableCardWithActivatedAbilities(prepared.input);
  if (!base.ok) return base;

  let card = base.card;
  if (prepared.restore) {
    if (card.type !== "Enchantment" && card.type !== "Artifact") {
      return { ok: false, error: "Continuous Aura is supported only on Enchantment or Artifact cards" };
    }
    card = {
      ...card,
      aura: {
        ...(card.aura ?? { buffPower: 0, buffHealth: 0 }),
        buffPower: prepared.restore.buffPower,
        buffHealth: prepared.restore.buffHealth,
        ...(prepared.restore.keywords.length ? { keywords: prepared.restore.keywords } : {}),
        ...(prepared.restore.suppressKeywords.length ? { suppressKeywords: prepared.restore.suppressKeywords } : {}),
        ...(prepared.restore.affects ? { affects: prepared.restore.affects } : {}),
      },
    };
  }

  return validateCertifiedSemanticCardType(card);
}

/**
 * Convert a Studio draft to one of the certified semantic gameplay types while
 * preserving fields that are meaningful for that structural base.
 */
export function applyCertifiedSemanticCardType(
  card: Partial<CardDef>,
  key: CertifiedSemanticCardTypeKey,
): Partial<CardDef> {
  const contract = CERTIFIED_SEMANTIC_CARD_TYPES.find((item) => item.key === key);
  if (!contract) return card;

  const next: Partial<CardDef> = {
    ...card,
    type: contract.baseType,
    archetypeKey: contract.key,
    archetypeName: contract.name,
  };

  if (key === "structure") {
    delete next.spell;
    delete next.speed;
    delete next.equipment;
    delete next.sentinela;
    next.maxHealth = next.maxHealth ?? 3;
  } else {
    next.spell = next.spell ?? { kind: "draw", amount: 1, target: "none" };
    delete next.equipment;
    delete next.sentinela;
    if (key === "ritual") delete next.speed;
    if (key === "trap" && next.speed !== "Fast" && next.speed !== "Burst") next.speed = "Fast";
  }

  return next;
}
