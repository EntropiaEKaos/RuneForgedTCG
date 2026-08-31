import type { CardDef } from "./types";
import { validateAuthorableCardWithActivatedAbilities } from "./activated-ability-authoring";
import {
  CERTIFIED_SEMANTIC_CARD_TYPES,
  type CertifiedSemanticCardTypeKey,
  validateCertifiedSemanticCardType,
} from "./semantic-card-types";

export type SemanticAuthoringResult =
  | { ok: true; card: CardDef }
  | { ok: false; error: string };

/** Canonical publish/import/sandbox validator for cards plus certified semantic gameplay types. */
export function validateAuthorableCardWithSemanticTypes(
  raw: Partial<CardDef> & Record<string, unknown>,
): SemanticAuthoringResult {
  const base = validateAuthorableCardWithActivatedAbilities(raw);
  if (!base.ok) return base;
  return validateCertifiedSemanticCardType(base.card);
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
