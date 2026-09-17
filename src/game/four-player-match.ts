import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";
import { createFourPlayerCombatState, type FourPlayerCombatState } from "./four-player-combat";
import { createFourPlayerResolutionFlow, type FourPlayerResolutionFlow } from "./four-player-flow";
import {
  advanceFourPlayerTurn,
  createFourPlayerTurnState,
  eliminateSeat,
  type FourPlayerTurnState,
} from "./four-player-turn-manager";

export interface FourPlayerMatchSeatState {
  seat: FourPlayerSeat;
  eliminated: boolean;
  generalCastsFromZone: number;
}

export interface FourPlayerMatchState {
  seats: Record<FourPlayerSeat, FourPlayerMatchSeatState>;
  turn: FourPlayerTurnState;
  resolution: FourPlayerResolutionFlow;
  combat: FourPlayerCombatState;
}

export function createFourPlayerMatchState(startingSeat: FourPlayerSeat = "p1"): FourPlayerMatchState {
  const seats = Object.fromEntries(
    FOUR_PLAYER_SEATS.map((seat) => [seat, { seat, eliminated: false, generalCastsFromZone: 0 }]),
  ) as Record<FourPlayerSeat, FourPlayerMatchSeatState>;
  return {
    seats,
    turn: createFourPlayerTurnState(startingSeat),
    resolution: createFourPlayerResolutionFlow(startingSeat),
    combat: createFourPlayerCombatState(startingSeat),
  };
}

export function eliminateFourPlayerMatchSeat(
  state: FourPlayerMatchState,
  seat: FourPlayerSeat,
): FourPlayerMatchState {
  const turn = eliminateSeat(state.turn, seat);
  const eliminatedSeats = turn.eliminatedSeats;
  return {
    ...state,
    seats: { ...state.seats, [seat]: { ...state.seats[seat], eliminated: true } },
    turn,
    resolution: createFourPlayerResolutionFlow(state.resolution.priority.holder, eliminatedSeats, state.resolution.priority.mode),
    combat: { ...state.combat, eliminatedSeats },
  };
}

export function advanceFourPlayerMatchTurn(state: FourPlayerMatchState): FourPlayerMatchState {
  const turn = advanceFourPlayerTurn(state.turn);
  return {
    ...state,
    turn,
    resolution: createFourPlayerResolutionFlow(turn.activeSeat, turn.eliminatedSeats, state.resolution.priority.mode),
    combat: createFourPlayerCombatState(turn.activeSeat, turn.eliminatedSeats),
  };
}
