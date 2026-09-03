import { getCard } from "./cards";
import type { CardEffect, GameState, PlayerId } from "./types";

function effectChainHasOwnGraveyardRecursion(effect: CardEffect | undefined): boolean {
  let cursor = effect;
  while (cursor) {
    if (cursor.kind === "reanimateUnit" || cursor.kind === "returnGraveyardToHand") return true;
    cursor = cursor.also;
  }
  return false;
}

function defHasOwnGraveyardRecursion(defId: string): boolean {
  try {
    const def = getCard(defId);
    return effectChainHasOwnGraveyardRecursion(def.spell);
  } catch {
    return false;
  }
}

export function hasOwnGraveyardResourcePlan(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  return player.hand.some((card) => defHasOwnGraveyardRecursion(card.defId))
    || player.deck.some((defId) => defHasOwnGraveyardRecursion(defId));
}

/**
 * Conservative self-mill valuation shared by main-phase and activated-ability AI.
 * It refuses generic self-mill without a known recursion plan and preserves a
 * small deck buffer so late-game AI does not compulsively deck itself.
 */
export function selfMillAiValue(
  state: GameState,
  playerId: PlayerId,
  amount: number,
): number {
  const player = state.players[playerId];
  if (!Number.isFinite(amount) || amount <= 0) return -1000;
  if (player.deck.length <= Math.max(2, amount)) return -1000;
  if (!hasOwnGraveyardResourcePlan(state, playerId)) return -1000;

  const hasReanimationReady = player.hand.some((card) => {
    try { return getCard(card.defId).spell?.kind === "reanimateUnit"; }
    catch { return false; }
  });
  const hasRecoveryReady = player.hand.some((card) => {
    try { return getCard(card.defId).spell?.kind === "returnGraveyardToHand"; }
    catch { return false; }
  });

  return 12 + Math.min(amount, player.deck.length) * 4
    + (hasReanimationReady ? 16 : 0)
    + (hasRecoveryReady ? 6 : 0);
}
