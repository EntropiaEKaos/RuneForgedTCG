import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";
import type { FourPlayerMatchState, FourPlayerMatchStatus, FourPlayerPhase } from "./four-player-match";

export interface FourPlayerPrivateSeatState {
  seat: FourPlayerSeat;
  hand: readonly string[];
  deck: readonly string[];
  graveyard: readonly string[];
  publicBoard: readonly string[];
  nexusHealth: number;
  eliminated: boolean;
}

export interface FourPlayerProjectedSeatState {
  seat: FourPlayerSeat;
  handCount: number;
  deckCount: number;
  graveyard: readonly string[];
  publicBoard: readonly string[];
  nexusHealth: number;
  eliminated: boolean;
  hand?: readonly string[];
}

export interface FourPlayerPublicMatchFlow {
  activeSeat: FourPlayerSeat;
  round: number;
  phase: FourPlayerPhase;
  priorityHolder: FourPlayerSeat;
  status: FourPlayerMatchStatus;
  winner?: FourPlayerSeat;
}

export interface FourPlayerSeatProjection {
  viewer: FourPlayerSeat;
  seats: Record<FourPlayerSeat, FourPlayerProjectedSeatState>;
  match?: FourPlayerPublicMatchFlow;
}

/**
 * Security boundary for clients. A viewer receives identities for its current hand only.
 * Future deck identities/order remain server-only for every seat, including the owner.
 * Match flow contains public authoritative metadata only and is safe for reconnect snapshots.
 */
export function projectFourPlayerStateForSeat(
  states: Record<FourPlayerSeat, FourPlayerPrivateSeatState>,
  viewer: FourPlayerSeat,
  match?: FourPlayerMatchState,
): FourPlayerSeatProjection {
  const projected = Object.fromEntries(FOUR_PLAYER_SEATS.map((seat) => {
    const source = states[seat];
    const own = seat === viewer;
    const value: FourPlayerProjectedSeatState = {
      seat,
      handCount: source.hand.length,
      deckCount: source.deck.length,
      graveyard: [...source.graveyard],
      publicBoard: [...source.publicBoard],
      nexusHealth: source.nexusHealth,
      eliminated: source.eliminated,
      ...(own ? { hand: [...source.hand] } : {}),
    };
    return [seat, value];
  })) as Record<FourPlayerSeat, FourPlayerProjectedSeatState>;

  const publicMatch: FourPlayerPublicMatchFlow | undefined = match ? {
    activeSeat: match.turn.activeSeat,
    round: match.turn.round,
    phase: match.phase,
    priorityHolder: match.resolution.priority.holder,
    status: match.status,
    ...(match.winner ? { winner: match.winner } : {}),
  } : undefined;

  return { viewer, seats: projected, ...(publicMatch ? { match: publicMatch } : {}) };
}
