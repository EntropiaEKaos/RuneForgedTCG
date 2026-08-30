import type { CardDef } from "./types";
import {
  COUNTER_ACTION_KINDS,
  COUNTER_FILTER_KEYS,
  UNCOUNTERABLE_RULE_KEY,
  cannotBeCountered,
  counterActionKinds,
  type ReactionActionKind,
} from "./reaction-contract";

const COUNTER_KIND_LABEL: Record<ReactionActionKind, string> = {
  unit: "Unidade",
  spell: "Magia",
  sentinela: "Sentinela",
};

const RESERVED_REACTION_RULE_KEYS = new Set<string>([
  UNCOUNTERABLE_RULE_KEY,
  ...Object.values(COUNTER_FILTER_KEYS),
]);

function naturalJoin(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} ou ${values[1]}`;
  return `${values.slice(0, -1).join(", ")} ou ${values.at(-1)}`;
}

/**
 * Internal reaction metadata is authored through `customKeywords` for schema
 * compatibility, but reserved engine keys are never player-facing keywords.
 */
export function playerVisibleCustomKeywords(card: CardDef): string[] {
  return (card.customKeywords ?? []).filter((keyword) => !RESERVED_REACTION_RULE_KEYS.has(keyword));
}

/** Canonical rules text for counters, derived from the executable contract. */
export function counterRuleText(card: CardDef): string | null {
  if (card.type !== "Spell" || card.spell?.kind !== "negateSpell") return null;
  const kinds = counterActionKinds(card);
  if (!kinds.length) return null;
  const labels = kinds.map((kind) => COUNTER_KIND_LABEL[kind]);
  if (kinds.length === COUNTER_ACTION_KINDS.length) {
    return `Anule uma ação inimiga pendente (${naturalJoin(labels)}).`;
  }
  return `Anule uma ação inimiga pendente se ela for ${naturalJoin(labels)}.`;
}

/**
 * Mechanical descriptions win over stale authored prose for contracts whose
 * runtime semantics are fully data-driven. Other cards keep their authored text.
 */
export function cardRulesDescription(card: CardDef): string {
  return counterRuleText(card) ?? card.description;
}

export function counterProtectionText(card: CardDef): string | null {
  return cannotBeCountered(card) ? "Esta carta não pode ser anulada enquanto estiver pendente." : null;
}

export function reactionSpeedRuleText(card: CardDef): string | null {
  if (card.speed === "Burst") return "pode responder a Magias, Unidades ou Sentinelas inimigas.";
  if (card.speed === "Fast") return "pode responder a Unidades ou Sentinelas inimigas.";
  return null;
}
