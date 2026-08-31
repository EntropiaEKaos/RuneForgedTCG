import type { GameAction } from "../reducer";
import type { GameState } from "../types";
import type { PvpReactionPriorityState } from "@/lib/pvp-reaction-priority";

export const PVP_REACTION_STATE_EVENT = "runeforge:pvp-reaction-state";
export const PVP_REACTION_ACTION_EVENT = "runeforge:pvp-reaction-action";

export interface PvpReactionStateDetail {
  gameState: GameState;
  reactionState: PvpReactionPriorityState | null;
}

export interface PvpReactionActionDetail {
  action: GameAction;
}

export function publishPvpReactionState(detail: PvpReactionStateDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PvpReactionStateDetail>(PVP_REACTION_STATE_EVENT, { detail }));
}

export function requestPvpReactionAction(action: GameAction): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PvpReactionActionDetail>(PVP_REACTION_ACTION_EVENT, { detail: { action } }));
}
