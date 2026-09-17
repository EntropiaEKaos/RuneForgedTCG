import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";
import { projectFourPlayerStateForSeat, type FourPlayerPrivateSeatState, type FourPlayerSeatProjection } from "./four-player-projection";

export interface FourPlayerSeatBroadcast {
  seat: FourPlayerSeat;
  matchId: string;
  revision: number;
  projection: FourPlayerSeatProjection;
}

/** Produces four distinct payloads from one authoritative revision. */
export function createFourPlayerBroadcasts(
  matchId: string,
  revision: number,
  privateStates: Record<FourPlayerSeat, FourPlayerPrivateSeatState>,
): Record<FourPlayerSeat, FourPlayerSeatBroadcast> {
  if (revision < 0) throw new Error("Revision cannot be negative.");
  return Object.fromEntries(FOUR_PLAYER_SEATS.map((seat) => [seat, {
    seat,
    matchId,
    revision,
    projection: projectFourPlayerStateForSeat(privateStates, seat),
  }])) as Record<FourPlayerSeat, FourPlayerSeatBroadcast>;
}
