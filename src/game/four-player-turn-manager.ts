import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";

export interface FourPlayerTurnState {
  activeSeat: FourPlayerSeat;
  round: number;
  turn: number;
  eliminatedSeats: readonly FourPlayerSeat[];
}

export function createFourPlayerTurnState(startingSeat: FourPlayerSeat = "p1"): FourPlayerTurnState {
  return { activeSeat: startingSeat, round: 1, turn: 1, eliminatedSeats: [] };
}

export function livingSeats(eliminatedSeats: readonly FourPlayerSeat[] = []): FourPlayerSeat[] {
  const eliminated = new Set(eliminatedSeats);
  return FOUR_PLAYER_SEATS.filter((seat) => !eliminated.has(seat));
}

export function nextLivingSeat(
  activeSeat: FourPlayerSeat,
  eliminatedSeats: readonly FourPlayerSeat[] = [],
): FourPlayerSeat {
  const eliminated = new Set(eliminatedSeats);
  const living = livingSeats(eliminatedSeats);
  if (living.length === 0) return activeSeat;
  if (living.length === 1) return living[0];

  const start = FOUR_PLAYER_SEATS.indexOf(activeSeat);
  for (let offset = 1; offset <= FOUR_PLAYER_SEATS.length; offset += 1) {
    const candidate = FOUR_PLAYER_SEATS[(start + offset) % FOUR_PLAYER_SEATS.length];
    if (!eliminated.has(candidate)) return candidate;
  }
  return living[0];
}

export function advanceFourPlayerTurn(state: FourPlayerTurnState): FourPlayerTurnState {
  const activeSeat = nextLivingSeat(state.activeSeat, state.eliminatedSeats);
  const wrapped = FOUR_PLAYER_SEATS.indexOf(activeSeat) <= FOUR_PLAYER_SEATS.indexOf(state.activeSeat);
  return {
    ...state,
    activeSeat,
    turn: state.turn + 1,
    round: state.round + (wrapped ? 1 : 0),
  };
}

export function eliminateSeat(state: FourPlayerTurnState, seat: FourPlayerSeat): FourPlayerTurnState {
  if (state.eliminatedSeats.includes(seat)) return state;
  return { ...state, eliminatedSeats: [...state.eliminatedSeats, seat] };
}
