import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";
import { cleanupFourPlayerCombatForElimination, createFourPlayerCombatState, type FourPlayerCombatState } from "./four-player-combat";
import { createFourPlayerResolutionFlow, type FourPlayerResolutionFlow } from "./four-player-flow";
import { createGeneralZoneState, type FourPlayerGeneralZoneState } from "./four-player-general-zone";
import { createFourPlayerPriorityState } from "./four-player-priority-manager";
import { removeFourPlayerStackItemsByController } from "./four-player-stack";
import {
  advanceFourPlayerTurn,
  createFourPlayerTurnState,
  eliminateSeat,
  livingSeats,
  type FourPlayerTurnState,
} from "./four-player-turn-manager";

export interface FourPlayerMatchSeatState {
  seat: FourPlayerSeat;
  eliminated: boolean;
  generalCastsFromZone: number;
}

export type FourPlayerGeneralSelection = Record<FourPlayerSeat, string>;
export type FourPlayerMatchStatus = "active" | "completed";

export interface FourPlayerMatchState {
  seats: Record<FourPlayerSeat, FourPlayerMatchSeatState>;
  generals: Record<FourPlayerSeat, FourPlayerGeneralZoneState>;
  turn: FourPlayerTurnState;
  resolution: FourPlayerResolutionFlow;
  combat: FourPlayerCombatState;
  status: FourPlayerMatchStatus;
  winner?: FourPlayerSeat;
}

const DEFAULT_GENERAL_SELECTION: FourPlayerGeneralSelection = {
  p1: "general-p1", p2: "general-p2", p3: "general-p3", p4: "general-p4",
};

export function createFourPlayerMatchState(
  startingSeat: FourPlayerSeat = "p1",
  generalSelection: FourPlayerGeneralSelection = DEFAULT_GENERAL_SELECTION,
): FourPlayerMatchState {
  const seats = Object.fromEntries(FOUR_PLAYER_SEATS.map((seat) => [seat, { seat, eliminated: false, generalCastsFromZone: 0 }])) as Record<FourPlayerSeat, FourPlayerMatchSeatState>;
  const generals = Object.fromEntries(FOUR_PLAYER_SEATS.map((seat) => [seat, createGeneralZoneState(seat, generalSelection[seat])])) as Record<FourPlayerSeat, FourPlayerGeneralZoneState>;
  return { seats, generals, turn: createFourPlayerTurnState(startingSeat), resolution: createFourPlayerResolutionFlow(startingSeat), combat: createFourPlayerCombatState(startingSeat), status: "active" };
}

export function updateMatchGeneral(state: FourPlayerMatchState, seat: FourPlayerSeat, general: FourPlayerGeneralZoneState): FourPlayerMatchState {
  if (general.owner !== seat) throw new Error(`General owner ${general.owner} does not match seat ${seat}.`);
  return { ...state, generals: { ...state.generals, [seat]: general }, seats: { ...state.seats, [seat]: { ...state.seats[seat], generalCastsFromZone: general.castsFromGeneralZone } } };
}

export function eliminateFourPlayerMatchSeat(state: FourPlayerMatchState, seat: FourPlayerSeat): FourPlayerMatchState {
  if (state.status === "completed" || state.seats[seat].eliminated) return state;
  const wasActiveSeat = state.turn.activeSeat === seat;
  let turn = eliminateSeat(state.turn, seat);
  const eliminatedSeats = turn.eliminatedSeats;
  const living = livingSeats(eliminatedSeats);
  const winner = living.length === 1 ? living[0] : undefined;

  if (wasActiveSeat && living.length > 1) {
    turn = advanceFourPlayerTurn(turn);
  } else if (winner) {
    turn = { ...turn, activeSeat: winner };
  }

  const stack = removeFourPlayerStackItemsByController(state.resolution.stack, seat);
  const priority = createFourPlayerPriorityState(state.resolution.priority.holder, eliminatedSeats, state.resolution.priority.mode);
  const combat = cleanupFourPlayerCombatForElimination(state.combat, seat);
  return {
    ...state,
    seats: { ...state.seats, [seat]: { ...state.seats[seat], eliminated: true } },
    turn,
    resolution: { stack, priority },
    combat,
    status: winner ? "completed" : "active",
    winner,
  };
}

export function advanceFourPlayerMatchTurn(state: FourPlayerMatchState): FourPlayerMatchState {
  if (state.status === "completed") return state;
  const turn = advanceFourPlayerTurn(state.turn);
  return { ...state, turn, resolution: createFourPlayerResolutionFlow(turn.activeSeat, turn.eliminatedSeats, state.resolution.priority.mode), combat: createFourPlayerCombatState(turn.activeSeat, turn.eliminatedSeats) };
}
