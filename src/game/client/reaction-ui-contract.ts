import type { CardAction } from "../engine/reactions";
import type { GameAction } from "../reducer";

/**
 * Typed browser handoff between the reaction-stack picker and the match
 * lifecycle. The authoritative engine still revalidates this payload before
 * costs/effects resolve; this event only keeps UI state out of GameClient.
 */
export const REACTION_ACTIVATED_SUBMIT_EVENT = "runeforge:reaction-activated-submit";

export interface ReactionActivatedSubmitDetail {
  action: CardAction;
  logAction: Extract<GameAction, { type: "react" }>;
}