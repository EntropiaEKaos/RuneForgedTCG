import "./aura-2-types";
import type { CardDef, Keyword } from "./types";
import { validateAuthorableCardWithActivatedAbilities } from "./activated-ability-authoring";
import { CANONICAL_KEYWORDS, keywordIsAuraGrantable } from "./keywords";
import {
  CERTIFIED_SEMANTIC_CARD_TYPES,
  type CertifiedSemanticCardTypeKey,
  validateCertifiedSemanticCardType,
} from "./semantic-card-types";

export type SemanticAuthoringResult =
  | { ok: true; card: CardDef }
  | { ok: false; error: string };

type Aura2Restore = {
  buffPower: number;
  buffHealth: number;
  keywords: Keyword[];
};

type Aura2Prepared =
  | { ok: true; input: Partial<CardDef> & Record<string, unknown>; restore?: Aura2Restore }
  | { ok: false; error: string };

const canonicalKeyword = (value: unknown): value is Keyword =>
  typeof value === "string" && (CANONICAL_KEYWORDS as readonly string[]).includes(value);

/**
 * The legacy stat-Aura sanitizer remains replay-compatible. Aura 2.0 is layered
 * at the canonical Studio/API boundary so keyword-only Auras can be introduced
 * without changing persisted structural CardType or historical card payloads.
 */
function prepareAura2Input(raw: Partial<CardDef>): Aura2Prepared {
  const input = { ...raw } as Partial<CardDef> & Record<string, unknown>;
  const auraRaw = (raw as Partial<CardDef> & Record<string, unknown>).aura;
  if (!auraRaw || typeof auraRaw !== "object" || Array.isArray(auraRaw)) return { ok: true, input };

  const aura = auraRaw as Record<string, unknown>;
  if (!("keywords" in aura)) return { ok: true, input };
  if (!Array.isArray(aura.keywords)) return { ok: false, error: "Aura keywords must be an array" };
  if (aura.keywords.some((keyword) => !canonicalKeyword(keyword))) {
    return { ok: false, error: "Aura contains an unknown keyword" };
  }

  const keywords = [...new Set(aura.keywords as Keyword[])];
  const unsafe = keywords.find((keyword) => !keywordIsAuraGrantable(keyword));
  if (unsafe) return { ok: false, error: `${unsafe} cannot be granted by a continuous Aura.` };

  const buffPower = Number(aura.buffPower ?? 0);
  const buffHealth = Number(aura.buffHealth ?? 0);
  if (
    !Number.isInteger(buffPower) ||
    !Number.isInteger(buffHealth) ||
    buffPower < 0 ||
    buffHealth < 0 ||
    buffPower > 20 ||
    buffHealth > 20
  ) {
    return { ok: false, error: "Aura stat bonuses must be integers from 0 to 20" };
  }

  if (keywords.length === 0) return { ok: true, input };

  // The pre-Aura-2 sanitizer requires a non-zero stat bonus. Use a validation
  // probe only when the authored Aura is keyword-only, then restore its exact
  // 0/0 + keyword contract after the established source/filter checks pass.
  const legacyAura: Record<string, unknown> = { ...aura };
  delete legacyAura.keywords;
  if (buffPower === 0 && buffHealth === 0) legacyAura.buffPower = 1;
  input.aura = legacyAura;
  return { ok: true, input, restore: { buffPower, buffHealth, keywords } };
}

/** Canonical publish/import/sandbox validator for cards plus certified semantic gameplay types. */
export function validateAuthorableCardWithSemanticTypes(
  raw: Partial<CardDef>,
): SemanticAuthoringResult {
  const prepared = prepareAura2Input(raw);
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
        keywords: prepared.restore.keywords,
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
