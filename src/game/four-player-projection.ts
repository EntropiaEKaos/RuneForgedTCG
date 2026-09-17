import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";

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

export interface FourPlayerSeatProjection {
  viewer: FourPlayerSeat;
  seats: Record<FourPlayerSeat, FourPlayerProjectedSeatState>;
}

/**
 * Security boundary for clients. A viewer receives identities for its current hand only.
 * Future deck identities/order remain server-only for every seat, including the owner.
 */
export function projectFourPlayerStateForSeat(
  states: Record<FourPlayerSeat, FourPlayerPrivateSeatState>,
  viewer: FourPlayerSeat,
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
  return { viewer, seats: projected };
}
