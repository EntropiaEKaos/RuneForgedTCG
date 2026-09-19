import type { FourPlayerSeat } from "./four-player-general";

export interface FourPlayerAttacker {
  unitId: string;
  controller: FourPlayerSeat;
  defendingSeat: FourPlayerSeat;
}

export interface FourPlayerBlocker {
  unitId: string;
  controller: FourPlayerSeat;
  attackerId: string;
}

export interface FourPlayerCombatState {
  attackingSeat: FourPlayerSeat;
  attackers: readonly FourPlayerAttacker[];
  blockers: readonly FourPlayerBlocker[];
  eliminatedSeats: readonly FourPlayerSeat[];
}

export function createFourPlayerCombatState(
  attackingSeat: FourPlayerSeat,
  eliminatedSeats: readonly FourPlayerSeat[] = [],
): FourPlayerCombatState {
  return { attackingSeat, attackers: [], blockers: [], eliminatedSeats };
}

export function declareFourPlayerAttacker(
  state: FourPlayerCombatState,
  unitId: string,
  defendingSeat: FourPlayerSeat,
): FourPlayerCombatState {
  if (defendingSeat === state.attackingSeat) throw new Error("A seat cannot attack itself.");
  if (state.eliminatedSeats.includes(defendingSeat)) throw new Error(`Cannot attack eliminated seat ${defendingSeat}.`);
  if (state.attackers.some((attacker) => attacker.unitId === unitId)) throw new Error(`Unit ${unitId} is already attacking.`);
  return { ...state, attackers: [...state.attackers, { unitId, controller: state.attackingSeat, defendingSeat }] };
}

export function declareFourPlayerBlocker(
  state: FourPlayerCombatState,
  blockerSeat: FourPlayerSeat,
  unitId: string,
  attackerId: string,
): FourPlayerCombatState {
  if (state.eliminatedSeats.includes(blockerSeat)) throw new Error(`Eliminated seat ${blockerSeat} cannot block.`);
  const attacker = state.attackers.find((entry) => entry.unitId === attackerId);
  if (!attacker) throw new Error(`Unknown attacker ${attackerId}.`);
  if (attacker.defendingSeat !== blockerSeat) throw new Error(`Seat ${blockerSeat} cannot block an attacker assigned to ${attacker.defendingSeat}.`);
  if (state.blockers.some((blocker) => blocker.unitId === unitId)) throw new Error(`Unit ${unitId} is already blocking.`);
  if (state.blockers.some((blocker) => blocker.attackerId === attackerId)) {
    throw new Error(`Attacker ${attackerId} is already blocked; multi-block ordering is not enabled yet.`);
  }
  return { ...state, blockers: [...state.blockers, { unitId, controller: blockerSeat, attackerId }] };
}

export function cleanupFourPlayerCombatForElimination(
  state: FourPlayerCombatState,
  seat: FourPlayerSeat,
): FourPlayerCombatState {
  const eliminatedSeats = state.eliminatedSeats.includes(seat) ? state.eliminatedSeats : [...state.eliminatedSeats, seat];
  const attackers = state.attackers.filter((attacker) => attacker.controller !== seat && attacker.defendingSeat !== seat);
  const attackerIds = new Set(attackers.map((attacker) => attacker.unitId));
  const blockers = state.blockers.filter((blocker) => blocker.controller !== seat && attackerIds.has(blocker.attackerId));
  return { ...state, attackers, blockers, eliminatedSeats };
}

export function attackersForDefender(state: FourPlayerCombatState, seat: FourPlayerSeat): FourPlayerAttacker[] {
  return state.attackers.filter((attacker) => attacker.defendingSeat === seat);
}
