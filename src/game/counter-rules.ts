import type { CardDef } from "./types";

export type ReactionActionKind = "unit" | "spell" | "sentinela";

export const UNCOUNTERABLE_RULE_KEY = "uncounterable" as const;
export const COUNTER_FILTER_KEYS = {
  unit: "counter_unit",
  spell: "counter_spell",
  sentinela: "counter_sentinela",
} as const satisfies Record<ReactionActionKind, string>;
export const COUNTER_ACTION_KINDS = ["unit", "spell", "sentinela"] as const satisfies readonly ReactionActionKind[];

/** Reserved engine keyword authored through `customKeywords` until Keyword 2.0 migrates it. */
export function cannotBeCountered(card: CardDef): boolean {
  return (card.customKeywords ?? []).includes(UNCOUNTERABLE_RULE_KEY);
}

/**
 * Counter filters are opt-in. A counter card with no `counter_*` rule keys is
 * universal across every action kind currently supported by the stack.
 */
export function counterActionKinds(card: CardDef): ReactionActionKind[] {
  if (card.type !== "Spell" || card.spell?.kind !== "negateSpell") return [];
  const authored = new Set(card.customKeywords ?? []);
  const filtered = COUNTER_ACTION_KINDS.filter((kind) => authored.has(COUNTER_FILTER_KEYS[kind]));
  return filtered.length ? [...filtered] : [...COUNTER_ACTION_KINDS];
}
