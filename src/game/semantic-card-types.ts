import type { CardDef, CardEffect, CardType } from "./types";

export type CertifiedSemanticCardTypeKey = "structure" | "ritual" | "trap";

export interface CertifiedSemanticCardTypeContract {
  key: CertifiedSemanticCardTypeKey;
  name: string;
  baseType: CardType;
  icon: string;
  timing: "battlefield" | "main-only" | "reaction-only";
  mana: "regular" | "spell";
  description: string;
}

/**
 * First-class gameplay types layered on the stable six structural engine types.
 *
 * Keeping the storage/runtime structural type stable preserves old replays,
 * database rows and DTOs while `archetypeKey` gives the subtype its own
 * authoritative timing/resource contract.
 */
export const CERTIFIED_SEMANTIC_CARD_TYPES = [
  {
    key: "structure",
    name: "Estrutura",
    baseType: "Artifact",
    icon: "🏰",
    timing: "battlefield",
    mana: "regular",
    description: "Permanente de campo com integridade. Usa mana regular e não conta como feitiço conjurado.",
  },
  {
    key: "ritual",
    name: "Ritual",
    baseType: "Spell",
    icon: "🜂",
    timing: "main-only",
    mana: "spell",
    description: "Carta de mana deliberada. Só pode ser iniciada na fase principal, nunca é uma resposta e toda versão coletável deve manipular mana.",
  },
  {
    key: "trap",
    name: "Armadilha",
    baseType: "Spell",
    icon: "🪤",
    timing: "reaction-only",
    mana: "spell",
    description: "Resposta de mão. Só pode ser usada dentro de uma janela de reação legal.",
  },
] as const satisfies readonly CertifiedSemanticCardTypeContract[];

const CONTRACT_BY_KEY = new Map<CertifiedSemanticCardTypeKey, CertifiedSemanticCardTypeContract>(
  CERTIFIED_SEMANTIC_CARD_TYPES.map((contract) => [contract.key, contract]),
);

export function certifiedSemanticCardType(
  card: Pick<CardDef, "archetypeKey">,
): CertifiedSemanticCardTypeContract | null {
  const key = card.archetypeKey as CertifiedSemanticCardTypeKey | undefined;
  return key ? CONTRACT_BY_KEY.get(key) ?? null : null;
}

export function isStructureCard(card: Pick<CardDef, "archetypeKey">): boolean {
  return card.archetypeKey === "structure";
}

export function isRitualCard(card: Pick<CardDef, "archetypeKey">): boolean {
  return card.archetypeKey === "ritual";
}

export function isTrapCard(card: Pick<CardDef, "archetypeKey">): boolean {
  return card.archetypeKey === "trap";
}

export function semanticCardTypeLabel(card: Pick<CardDef, "type" | "archetypeKey" | "archetypeName">): string {
  return certifiedSemanticCardType(card)?.name ?? card.archetypeName ?? card.type;
}

/** Structures are battlefield objects rather than spells even though their stable storage base is Artifact. */
export function cardUsesSpellMana(card: Pick<CardDef, "type" | "archetypeKey">): boolean {
  if (isStructureCard(card)) return false;
  return card.type !== "Unit" && card.type !== "Sentinela";
}

export function cardCountsAsSpellCast(card: Pick<CardDef, "type" | "archetypeKey">): boolean {
  if (isStructureCard(card)) return false;
  return card.type === "Spell" || card.type === "Enchantment" || card.type === "Artifact" || card.type === "Equipment";
}

/** Trap is the only certified subtype that is intentionally illegal as a proactive main-phase play. */
export function semanticProactivePlayAllowed(card: Pick<CardDef, "archetypeKey">): boolean {
  return !isTrapCard(card);
}

/** Ritual explicitly cannot enter a reaction window. Trap and ordinary speed spells use the existing speed contract. */
export function semanticReactionAllowed(card: Pick<CardDef, "archetypeKey">): boolean {
  return !isRitualCard(card);
}

/**
 * Alpha Ritual identity: mana interaction is mandatory for collectible Rituals.
 * `manaRefund` is the first certified opcode in this family. The recursive walk
 * intentionally supports a mana effect chained through `also`, so each region
 * may express its own secondary payoff without weakening the shared identity.
 */
export function ritualHasManaInteraction(card: Pick<CardDef, "spell">): boolean {
  const includesManaEffect = (effect: CardEffect | undefined): boolean =>
    Boolean(effect && (effect.kind === "manaRefund" || includesManaEffect(effect.also)));
  return includesManaEffect(card.spell);
}

export type SemanticCardValidationResult =
  | { ok: true; card: CardDef }
  | { ok: false; error: string };

/**
 * Fail-closed semantic subtype validator. Unknown/custom archetypes remain
 * untouched; only the three certified gameplay keys gain special rules.
 */
export function validateCertifiedSemanticCardType(card: CardDef): SemanticCardValidationResult {
  const contract = certifiedSemanticCardType(card);
  if (!contract) return { ok: true, card };
  if (card.type !== contract.baseType) {
    return { ok: false, error: `${contract.name} requires structural base type ${contract.baseType}` };
  }

  if (contract.key === "structure") {
    if (card.spell || card.speed || card.equipment || card.sentinela) {
      return { ok: false, error: "Estrutura is a battlefield permanent and cannot carry Spell/Equipment/Sentinela structural payloads" };
    }
    return {
      ok: true,
      card: {
        ...card,
        archetypeName: contract.name,
        maxHealth: card.maxHealth ?? 3,
      },
    };
  }

  if (!card.spell) {
    return { ok: false, error: `${contract.name} requires an executable spell effect` };
  }

  if (contract.key === "ritual") {
    if (card.speed !== undefined) {
      return { ok: false, error: "Ritual cannot have Fast/Burst speed; it is main-phase only" };
    }
    if (card.collectible !== false && !ritualHasManaInteraction(card)) {
      return { ok: false, error: "Collectible Ritual must manipulate mana through a certified mana effect" };
    }
    return { ok: true, card: { ...card, archetypeName: contract.name, speed: undefined } };
  }

  if (card.speed !== "Fast" && card.speed !== "Burst") {
    return { ok: false, error: "Armadilha requires Fast or Burst speed so its legal reaction windows are explicit" };
  }
  return { ok: true, card: { ...card, archetypeName: contract.name } };
}
