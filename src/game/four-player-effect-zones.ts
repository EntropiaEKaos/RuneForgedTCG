import { drawFourPlayerCard, type FourPlayerCardZones } from "./four-player-card-zones";
import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";
import { eliminateFourPlayerMatchSeat, type FourPlayerMatchState } from "./four-player-match";

export interface FourPlayerEffectDrawSettlement {
  match: FourPlayerMatchState;
  zones: FourPlayerCardZones;
  drawnCounts: Partial<Record<FourPlayerSeat, number>>;
  deckOutSeats: readonly FourPlayerSeat[];
}

export function settleFourPlayerEffectDraws(
  match: FourPlayerMatchState,
  zones: FourPlayerCardZones,
  draws: Partial<Record<FourPlayerSeat, number>>,
): FourPlayerEffectDrawSettlement {
  let currentMatch = match;
  let currentZones = zones;
  const drawnCounts: Partial<Record<FourPlayerSeat, number>> = {};
  const deckOutSeats: FourPlayerSeat[] = [];

  for (const seat of FOUR_PLAYER_SEATS) {
    const count = draws[seat] ?? 0;
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`4P effect draw count for ${seat} must be a non-negative integer.`);
    }
    if (count === 0 || currentMatch.seats[seat].eliminated) continue;

    for (let index = 0; index < count; index += 1) {
      const draw = drawFourPlayerCard(currentZones, seat);
      currentZones = draw.zones;
      if (draw.deckOut) {
        currentMatch = eliminateFourPlayerMatchSeat(currentMatch, seat);
        deckOutSeats.push(seat);
        break;
      }
      drawnCounts[seat] = (drawnCounts[seat] ?? 0) + 1;
    }
    if (currentMatch.status === "completed") break;
  }

  return { match: currentMatch, zones: currentZones, drawnCounts, deckOutSeats };
}
