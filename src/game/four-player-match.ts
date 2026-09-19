import { getCard } from "./cards";
import {
  cleanupFourPlayerBattlefieldForElimination,
  createFourPlayerBattlefieldState,
  resetFourPlayerBattlefieldForTurn,
  type FourPlayerBattlefieldState,
} from "./four-player-battlefield";
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

export const FOUR_PLAYER_PHASES = ["beginning", "main_1", "combat", "main_2", "ending"] as const;
export type FourPlayerPhase = (typeof FOUR_PLAYER_PHASES)[number];

export interface FourPlayerMatchSeatState {
  seat: FourPlayerSeat;
  eliminated: boolean;
  generalCastsFromZone: number;
  mana: number;
  maxMana: number;
  life: number;
  generalDamageReceived: Partial<Record<FourPlayerSeat, number>>;
}

export type FourPlayerGeneralSelection = Record<FourPlayerSeat, string>;
export type FourPlayerGeneralPrintedCosts = Record<FourPlayerSeat, number>;
export type FourPlayerMatchStatus = "active" | "completed";
export const FOUR_PLAYER_MAX_MANA = 10;
export const FOUR_PLAYER_STARTING_LIFE = 30;

export interface FourPlayerMatchState {
  seats: Record<FourPlayerSeat, FourPlayerMatchSeatState>;
  generals: Record<FourPlayerSeat, FourPlayerGeneralZoneState>;
  generalPrintedCosts: FourPlayerGeneralPrintedCosts;
  turn: FourPlayerTurnState;
  phase: FourPlayerPhase;
  resolution: FourPlayerResolutionFlow;
  combat: FourPlayerCombatState;
  battlefield?: FourPlayerBattlefieldState;
  status: FourPlayerMatchStatus;
  winner?: FourPlayerSeat;
}

const DEFAULT_GENERAL_SELECTION: FourPlayerGeneralSelection = {
  p1: "general-p1", p2: "general-p2", p3: "general-p3", p4: "general-p4",
};
const DEFAULT_GENERAL_PRINTED_COSTS: FourPlayerGeneralPrintedCosts = { p1: 0, p2: 0, p3: 0, p4: 0 };

export function createFourPlayerMatchState(
  startingSeat: FourPlayerSeat = "p1",
  generalSelection: FourPlayerGeneralSelection = DEFAULT_GENERAL_SELECTION,
  startingMana = 0,
  generalPrintedCosts: FourPlayerGeneralPrintedCosts = DEFAULT_GENERAL_PRINTED_COSTS,
): FourPlayerMatchState {
  if (!Number.isFinite(startingMana) || startingMana < 0) throw new Error("4P starting mana must be a non-negative finite number.");
  for (const seat of FOUR_PLAYER_SEATS) {
    const cost = generalPrintedCosts[seat];
    if (!Number.isFinite(cost) || cost < 0) throw new Error(`General printed cost for ${seat} must be a non-negative finite number.`);
  }
  const seats = Object.fromEntries(FOUR_PLAYER_SEATS.map((seat) => {
    const isStartingSeat = seat === startingSeat;
    const maxMana = isStartingSeat ? Math.min(FOUR_PLAYER_MAX_MANA, startingMana + 1) : startingMana;
    return [seat, { seat, eliminated: false, generalCastsFromZone: 0, mana: maxMana, maxMana, life: FOUR_PLAYER_STARTING_LIFE, generalDamageReceived: {} }];
  })) as Record<FourPlayerSeat, FourPlayerMatchSeatState>;
  const generals = Object.fromEntries(FOUR_PLAYER_SEATS.map((seat) => [seat, createGeneralZoneState(seat, generalSelection[seat])])) as Record<FourPlayerSeat, FourPlayerGeneralZoneState>;
  return { seats, generals, generalPrintedCosts: { ...generalPrintedCosts }, turn: createFourPlayerTurnState(startingSeat), phase: "beginning", resolution: createFourPlayerResolutionFlow(startingSeat), combat: createFourPlayerCombatState(startingSeat), battlefield: createFourPlayerBattlefieldState(), status: "active" };
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
  let battlefield = cleanupFourPlayerBattlefieldForElimination(
    state.battlefield ?? createFourPlayerBattlefieldState(),
    seat,
  ).state;
  if (wasActiveSeat && living.length > 1) {
    battlefield = resetFourPlayerBattlefieldForTurn(battlefield, turn.activeSeat);
  }
  return {
    ...state,
    seats: { ...state.seats, [seat]: { ...state.seats[seat], eliminated: true } },
    turn,
    phase: wasActiveSeat && living.length > 1 ? "beginning" : state.phase,
    resolution: { stack, priority },
    combat,
    battlefield,
    status: winner ? "completed" : "active",
    winner,
  };
}

export function advanceFourPlayerMatchTurn(state: FourPlayerMatchState): FourPlayerMatchState {
  if (state.status === "completed") return state;
  const turn = advanceFourPlayerTurn(state.turn);
  const incoming = state.seats[turn.activeSeat];
  const nextMaxMana = Math.min(FOUR_PLAYER_MAX_MANA, incoming.maxMana + 1);
  const seats = {
    ...state.seats,
    [turn.activeSeat]: { ...incoming, maxMana: nextMaxMana, mana: nextMaxMana },
  };
  const battlefield = resetFourPlayerBattlefieldForTurn(
    state.battlefield ?? createFourPlayerBattlefieldState(),
    turn.activeSeat,
  );
  return { ...state, seats, turn, phase: "beginning", resolution: createFourPlayerResolutionFlow(turn.activeSeat, turn.eliminatedSeats, state.resolution.priority.mode), combat: createFourPlayerCombatState(turn.activeSeat, turn.eliminatedSeats), battlefield };
}

export function applyFourPlayerDamage(
  state: FourPlayerMatchState,
  target: FourPlayerSeat,
  amount: number,
  sourceGeneral?: FourPlayerSeat,
): FourPlayerMatchState {
  if (state.status === "completed") return state;
  if (state.seats[target].eliminated) throw new Error(`Cannot damage eliminated seat ${target}.`);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("4P damage must be a non-negative finite number.");
  const current = state.seats[target];
  const life = Math.max(0, current.life - amount);
  const generalDamageReceived = sourceGeneral
    ? { ...current.generalDamageReceived, [sourceGeneral]: (current.generalDamageReceived[sourceGeneral] ?? 0) + amount }
    : current.generalDamageReceived;
  const damaged: FourPlayerMatchState = {
    ...state,
    seats: { ...state.seats, [target]: { ...current, life, generalDamageReceived } },
  };
  return life === 0 ? eliminateFourPlayerMatchSeat(damaged, target) : damaged;
}

/** Production-safe factory: General printed costs are resolved from the authoritative card catalog. */
export function createFourPlayerMatchStateFromCatalog(
  startingSeat: FourPlayerSeat = "p1",
  generalSelection: FourPlayerGeneralSelection,
  startingMana = 0,
): FourPlayerMatchState {
  const generalPrintedCosts = Object.fromEntries(FOUR_PLAYER_SEATS.map((seat) => {
    const card = getCard(generalSelection[seat]);
    if (!Number.isFinite(card.cost) || card.cost < 0) throw new Error(`General printed cost for ${seat} must be a non-negative finite number.`);
    return [seat, card.cost];
  })) as FourPlayerGeneralPrintedCosts;
  return createFourPlayerMatchState(startingSeat, generalSelection, startingMana, generalPrintedCosts);
}
