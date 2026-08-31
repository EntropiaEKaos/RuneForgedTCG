import type { CardDef, CardType, TriggerWhen } from "./types";

/**
 * Trigger Source Contract 2.0
 *
 * This table describes the legacy automatic trigger events the authoritative
 * runtime actually dispatches for each structural card type today. Authoring
 * and Studio consume the same table so unsupported combinations fail closed
 * instead of being publishable-but-inert.
 *
 * `CardMechanic`/custom keyword behaviors remain Unit-only until their source
 * semantics are deliberately generalized; that restriction is enforced by
 * card-authoring.ts separately.
 */
export const TRIGGER_EVENTS_BY_CARD_TYPE = {
  Unit: [
    "onSummon",
    "onStrike",
    "onNexusStrike",
    "onRoundStart",
    "onLevelUp",
    "onKill",
    "onAttack",
    "onBlock",
    "onAllyDeath",
    "onDeath",
  ],
  Spell: [],
  Enchantment: ["onRoundStart", "onPermanentSummon"],
  Artifact: ["onRoundStart", "onPermanentSummon"],
  Equipment: ["onStrike", "onNexusStrike", "onKill", "onAllyDeath"],
  Sentinela: [],
} as const satisfies Record<CardType, readonly TriggerWhen[]>;

/**
 * Semantic timing is deliberately narrower than the full AbilityTiming model.
 * These are automatic triggers; the distinction records whether the runtime
 * dispatches them inside the authoritative combat sequence or outside it.
 */
export type TriggerSemanticTiming = "automatic" | "combat";

export const COMBAT_TRIGGER_EVENTS = [
  "onAttack",
  "onBlock",
  "onStrike",
  "onNexusStrike",
] as const satisfies readonly TriggerWhen[];

export const TRIGGER_TIMING_BY_EVENT = {
  onSummon: "automatic",
  onStrike: "combat",
  onNexusStrike: "combat",
  onRoundStart: "automatic",
  onLevelUp: "automatic",
  onKill: "automatic",
  onPermanentSummon: "automatic",
  onAttack: "combat",
  onBlock: "combat",
  onAllyDeath: "automatic",
  onDeath: "automatic",
} as const satisfies Record<TriggerWhen, TriggerSemanticTiming>;

export type TriggerSourceSupport = "supported" | "unsupported";

export function supportedTriggerEvents(cardType: CardType): readonly TriggerWhen[] {
  return TRIGGER_EVENTS_BY_CARD_TYPE[cardType];
}

export function isTriggerSupported(cardType: CardType, when: TriggerWhen): boolean {
  return (TRIGGER_EVENTS_BY_CARD_TYPE[cardType] as readonly TriggerWhen[]).includes(when);
}

export function triggerSourceSupport(cardType: CardType, when: TriggerWhen): TriggerSourceSupport {
  return isTriggerSupported(cardType, when) ? "supported" : "unsupported";
}

export function triggerTiming(when: TriggerWhen): TriggerSemanticTiming {
  return TRIGGER_TIMING_BY_EVENT[when];
}

export function triggerContractError(cardType: CardType, when: TriggerWhen): string | null {
  if (isTriggerSupported(cardType, when)) return null;
  const supported = supportedTriggerEvents(cardType);
  if (!supported.length) {
    return `${cardType} cards do not currently support automatic Trigger Contract events; use their native structural ability contract instead.`;
  }
  return `${when} is not an executable Trigger Contract event for ${cardType}. Supported: ${supported.join(", ")}.`;
}

/** True when an authored legacy trigger is executable by the current runtime. */
export function cardTriggerIsExecutable(card: Pick<CardDef, "type" | "trigger">): boolean {
  return !card.trigger || isTriggerSupported(card.type, card.trigger.when);
}
