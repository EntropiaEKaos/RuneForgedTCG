import { CARD_TYPES } from "@/game/card-authoring";
import {
  CERTIFIED_SEMANTIC_CARD_TYPES,
  type CertifiedSemanticCardTypeContract,
} from "@/game/semantic-card-types";
import type { CardType } from "@/game/types";
import type { PublicCardDto } from "@/lib/public-card-catalog";

export type PublicCardRuleContract = {
  key: string;
  name: string;
  kind: "structural" | "semantic";
  baseType: CardType;
  icon: string;
  zone: "battlefield" | "stack" | "equipment";
  timing: "battlefield" | "main-only" | "reaction-only" | "speed-based";
  mana: "regular" | "spell";
  persistent: boolean;
  countsAsSpellCast: boolean;
  description: string;
  cardCount: number;
};

const STRUCTURAL_INFO: Record<CardType, Omit<PublicCardRuleContract, "key" | "name" | "kind" | "baseType" | "cardCount">> = {
  Unit: {
    icon: "⚔️",
    zone: "battlefield",
    timing: "battlefield",
    mana: "regular",
    persistent: true,
    countsAsSpellCast: false,
    description: "Unidade de combate persistente. Entra no campo, pode atacar e bloquear conforme as regras de combate.",
  },
  Spell: {
    icon: "✦",
    zone: "stack",
    timing: "speed-based",
    mana: "spell",
    persistent: false,
    countsAsSpellCast: true,
    description: "Feitiço resolvido pela stack. Sua velocidade define as janelas legais de uso e reação.",
  },
  Enchantment: {
    icon: "🔮",
    zone: "battlefield",
    timing: "battlefield",
    mana: "spell",
    persistent: true,
    countsAsSpellCast: true,
    description: "Permanente mágico que permanece no campo e pode aplicar efeitos contínuos.",
  },
  Artifact: {
    icon: "⚙️",
    zone: "battlefield",
    timing: "battlefield",
    mana: "spell",
    persistent: true,
    countsAsSpellCast: true,
    description: "Permanente de campo com identidade de artefato. Pode carregar efeitos contínuos ou habilidades.",
  },
  Equipment: {
    icon: "🗡️",
    zone: "equipment",
    timing: "battlefield",
    mana: "spell",
    persistent: true,
    countsAsSpellCast: true,
    description: "Permanente anexável a uma unidade, preservando vínculo e bônus enquanto permanecer equipado.",
  },
  Sentinela: {
    icon: "♜",
    zone: "battlefield",
    timing: "battlefield",
    mana: "regular",
    persistent: true,
    countsAsSpellCast: false,
    description: "Permanente de comando com lealdade e habilidades próprias; não é conjurado como feitiço comum.",
  },
};

function countByDisplayType(cards: PublicCardDto[]) {
  const counts = new Map<string, number>();
  for (const card of cards) {
    counts.set(card.type, (counts.get(card.type) ?? 0) + 1);
  }
  return counts;
}

export function publicStructuralCardTypeContracts(cards: PublicCardDto[]): PublicCardRuleContract[] {
  const displayCounts = countByDisplayType(cards);
  return CARD_TYPES.map((type) => ({
    key: type,
    name: type,
    kind: "structural" as const,
    baseType: type,
    ...STRUCTURAL_INFO[type],
    cardCount: cards.filter((card) => card.structuralType === type && card.type === type).length,
  }));
}

function semanticZone(contract: CertifiedSemanticCardTypeContract): PublicCardRuleContract["zone"] {
  return contract.key === "structure" ? "battlefield" : "stack";
}

export function publicSemanticCardTypeContracts(cards: PublicCardDto[]): PublicCardRuleContract[] {
  const displayCounts = countByDisplayType(cards);
  return CERTIFIED_SEMANTIC_CARD_TYPES.map((contract) => ({
    key: contract.key,
    name: contract.name,
    kind: "semantic" as const,
    baseType: contract.baseType,
    icon: contract.icon,
    zone: semanticZone(contract),
    timing: contract.timing,
    mana: contract.mana,
    persistent: contract.key === "structure",
    countsAsSpellCast: contract.key !== "structure",
    description: contract.description,
    cardCount: displayCounts.get(contract.name) ?? 0,
  }));
}

export function buildPublicRulesContracts(cards: PublicCardDto[]) {
  const structural = publicStructuralCardTypeContracts(cards);
  const semantic = publicSemanticCardTypeContracts(cards);
  return {
    version: 1 as const,
    structural,
    semantic,
    all: [...structural, ...semantic],
  };
}
