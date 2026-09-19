import { getCard } from "./cards";
import { cannotBeCountered, counterActionKinds, type ReactionActionKind } from "./counter-rules";
import type { FourPlayerStackItem } from "./four-player-stack";
import type { CardDef } from "./types";

function stackPayload(item: FourPlayerStackItem): Record<string, unknown> {
  return item.payload && typeof item.payload === "object" && !Array.isArray(item.payload)
    ? item.payload as Record<string, unknown>
    : {};
}

/**
 * Adapts the isolated 4P stack to the mature 1v1 reaction taxonomy without
 * coupling either reducer. The existing catalog has unit/spell/sentinela
 * counter filters; non-Sentinela physical casts share the unit action bucket.
 */
export function fourPlayerStackActionKind(item: FourPlayerStackItem): ReactionActionKind | undefined {
  if (item.kind === "spell_cast") return "spell";
  if (item.kind === "general_cast") return "unit";
  if (item.kind !== "card_cast") return undefined;
  return stackPayload(item).cardType === "Sentinela" ? "sentinela" : "unit";
}

export function fourPlayerStackDefId(item: FourPlayerStackItem): string | undefined {
  const value = stackPayload(item).defId;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function fourPlayerStackItemIsUncounterable(item: FourPlayerStackItem): boolean {
  const defId = fourPlayerStackDefId(item);
  return Boolean(defId && cannotBeCountered(getCard(defId)));
}

/**
 * Certified speed contract carried into 4P:
 * - Fast and Burst may answer a non-spell stack action.
 * - Only Burst may answer a spell stack action.
 * Priority ownership and resources are enforced by the 4P authority separately.
 */
export function canFourPlayerReactWithCard(
  definition: CardDef,
  pending: FourPlayerStackItem,
): boolean {
  if (definition.type !== "Spell" || !definition.spell || !definition.speed) return false;
  const actionKind = fourPlayerStackActionKind(pending);
  if (!actionKind) return false;
  if (actionKind === "spell" && definition.speed !== "Burst") return false;
  return true;
}

/**
 * Counter legality reuses the catalog's existing counter filters and
 * uncounterable rule key. This is intentionally pure: removing the target from
 * the stack remains the responsibility of the 4P resolver.
 */
export function canFourPlayerCounterStackItem(
  counterCard: CardDef,
  pending: FourPlayerStackItem,
): boolean {
  if (counterCard.type !== "Spell" || counterCard.spell?.kind !== "negateSpell") return false;
  const actionKind = fourPlayerStackActionKind(pending);
  if (!actionKind || !counterActionKinds(counterCard).includes(actionKind)) return false;
  if (fourPlayerStackItemIsUncounterable(pending)) return false;
  return true;
}
