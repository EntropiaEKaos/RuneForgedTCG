import { applyFourPlayerTurnStartDraw, type FourPlayerCardZones } from "./four-player-card-zones";
import { eliminateFourPlayerMatchSeat, type FourPlayerMatchState } from "./four-player-match";
import type { FourPlayerSeat } from "./four-player-general";

export interface FourPlayerTurnStartResult {
  match: FourPlayerMatchState;
  zones: FourPlayerCardZones;
  drew: boolean;
  drawnDefId?: string;
  deckOut: boolean;
  eliminatedSeat?: FourPlayerSeat;
}

/**
 * Settles the mandatory normal draw at the beginning of an authoritative 4P turn.
 * The initial starting seat skips its round-one draw. A required draw from an
 * empty deck immediately eliminates that seat through the normal match
 * elimination path, preserving priority/stack/combat cleanup and winner logic.
 */
export function settleFourPlayerTurnStart(
  match: FourPlayerMatchState,
  zones: FourPlayerCardZones,
  startingSeat: FourPlayerSeat,
): FourPlayerTurnStartResult {
  if (match.status === "completed") {
    return { match, zones, drew: false, deckOut: false };
  }

  const seat = match.turn.activeSeat;
  if (match.seats[seat].eliminated) {
    throw new Error("4P turn start cannot settle for an eliminated active seat.");
  }

  const draw = applyFourPlayerTurnStartDraw(zones, seat, match.turn.round, startingSeat);
  if (!draw.deckOut) {
    return {
      match,
      zones: draw.zones,
      drew: draw.drew,
      drawnDefId: draw.drawnDefId,
      deckOut: false,
    };
  }

  return {
    match: eliminateFourPlayerMatchSeat(match, seat),
    zones: draw.zones,
    drew: false,
    deckOut: true,
    eliminatedSeat: seat,
  };
}
