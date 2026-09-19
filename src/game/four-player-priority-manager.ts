import type { FourPlayerSeat } from "./four-player-general";
import { livingSeats, nextLivingSeat } from "./four-player-turn-manager";

export type FourPlayerPriorityMode = "auto_pass" | "smart_priority" | "full_control";

export interface FourPlayerPriorityState {
  holder: FourPlayerSeat;
  anchorSeat: FourPlayerSeat;
  consecutivePasses: number;
  eliminatedSeats: readonly FourPlayerSeat[];
  mode: FourPlayerPriorityMode;
}

export function createFourPlayerPriorityState(
  anchorSeat: FourPlayerSeat,
  eliminatedSeats: readonly FourPlayerSeat[] = [],
  mode: FourPlayerPriorityMode = "smart_priority",
): FourPlayerPriorityState {
  const living = livingSeats(eliminatedSeats);
  const holder = living.includes(anchorSeat) ? anchorSeat : (living[0] ?? anchorSeat);
  return { holder, anchorSeat: holder, consecutivePasses: 0, eliminatedSeats, mode };
}

export function livingSeatCount(eliminatedSeats: readonly FourPlayerSeat[]): number {
  return livingSeats(eliminatedSeats).length;
}

export function passPriority(state: FourPlayerPriorityState): FourPlayerPriorityState {
  const living = livingSeatCount(state.eliminatedSeats);
  return {
    ...state,
    holder: nextLivingSeat(state.holder, state.eliminatedSeats),
    consecutivePasses: Math.min(living, state.consecutivePasses + 1),
  };
}

/** Any action restarts the consecutive-pass cycle with priority moving clockwise. */
export function actionTaken(state: FourPlayerPriorityState, actor: FourPlayerSeat = state.holder): FourPlayerPriorityState {
  return {
    ...state,
    anchorSeat: actor,
    holder: nextLivingSeat(actor, state.eliminatedSeats),
    consecutivePasses: 0,
  };
}

export function allLivingPlayersPassed(state: FourPlayerPriorityState): boolean {
  const living = livingSeatCount(state.eliminatedSeats);
  return living > 0 && state.consecutivePasses >= living;
}

/**
 * Client hint only. Server legality remains authoritative.
 * Smart Priority pauses only when the current seat has a meaningful legal response.
 */
export function shouldPauseForPriority(
  mode: FourPlayerPriorityMode,
  hasLegalResponse: boolean,
  hasMeaningfulResponse: boolean = hasLegalResponse,
): boolean {
  if (mode === "full_control") return true;
  if (mode === "auto_pass") return hasLegalResponse;
  return hasLegalResponse && hasMeaningfulResponse;
}
