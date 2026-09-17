import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";
import { nextLivingSeat } from "./four-player-turn-manager";

export type FourPlayerPriorityMode = "auto_pass" | "smart_priority" | "full_control";

export interface FourPlayerPriorityState {
  holder: FourPlayerSeat;
  anchorSeat: FourPlayerSeat;
  passedSeats: readonly FourPlayerSeat[];
  eliminatedSeats: readonly FourPlayerSeat[];
  mode: FourPlayerPriorityMode;
}

export function createFourPlayerPriorityState(
  anchorSeat: FourPlayerSeat,
  eliminatedSeats: readonly FourPlayerSeat[] = [],
  mode: FourPlayerPriorityMode = "smart_priority",
): FourPlayerPriorityState {
  return { holder: anchorSeat, anchorSeat, passedSeats: [], eliminatedSeats, mode };
}

export function livingSeatCount(eliminatedSeats: readonly FourPlayerSeat[]): number {
  const eliminated = new Set(eliminatedSeats);
  return FOUR_PLAYER_SEATS.filter((seat) => !eliminated.has(seat)).length;
}

export function passPriority(state: FourPlayerPriorityState): FourPlayerPriorityState {
  const passedSeats = state.passedSeats.includes(state.holder)
    ? state.passedSeats
    : [...state.passedSeats, state.holder];
  return { ...state, holder: nextLivingSeat(state.holder, state.eliminatedSeats), passedSeats };
}

/** Any action restarts the consecutive-pass cycle with priority moving clockwise. */
export function actionTaken(state: FourPlayerPriorityState, actor: FourPlayerSeat = state.holder): FourPlayerPriorityState {
  return {
    ...state,
    anchorSeat: actor,
    holder: nextLivingSeat(actor, state.eliminatedSeats),
    passedSeats: [],
  };
}

export function allLivingPlayersPassed(state: FourPlayerPriorityState): boolean {
  const eliminated = new Set(state.eliminatedSeats);
  const passed = new Set(state.passedSeats);
  return FOUR_PLAYER_SEATS.every((seat) => eliminated.has(seat) || passed.has(seat));
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
