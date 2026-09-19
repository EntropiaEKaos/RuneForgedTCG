import { drawFourPlayerCard, millFourPlayerCards, putFourPlayerCardInHand, type FourPlayerCardZones } from "./four-player-card-zones";
import type { FourPlayerEffectZoneAction } from "./four-player-effect-resolution";
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


export interface FourPlayerEffectZoneSettlement extends FourPlayerEffectDrawSettlement {
  milledCounts: Partial<Record<FourPlayerSeat, number>>;
  returnedToHandCounts: Partial<Record<FourPlayerSeat, number>>;
}

export function settleFourPlayerEffectZoneActions(
  match: FourPlayerMatchState,
  zones: FourPlayerCardZones,
  actions: readonly FourPlayerEffectZoneAction[],
): FourPlayerEffectZoneSettlement {
  let currentMatch = match;
  let currentZones = zones;
  const drawnCounts: Partial<Record<FourPlayerSeat, number>> = {};
  const milledCounts: Partial<Record<FourPlayerSeat, number>> = {};
  const returnedToHandCounts: Partial<Record<FourPlayerSeat, number>> = {};
  const deckOutSeats: FourPlayerSeat[] = [];

  for (const action of actions) {
    if (currentMatch.status === "completed") break;
    if (action.kind === "return_to_hand") {
      currentZones = putFourPlayerCardInHand(currentZones, action.card);
      returnedToHandCounts[action.card.ownerSeat] = (returnedToHandCounts[action.card.ownerSeat] ?? 0) + 1;
      continue;
    }
    if (action.kind === "mill") {
      if (currentMatch.seats[action.seat].eliminated) continue;
      const milled = millFourPlayerCards(currentZones, action.seat, action.amount);
      currentZones = milled.zones;
      milledCounts[action.seat] = (milledCounts[action.seat] ?? 0) + milled.milled.length;
      continue;
    }

    const drawRequest: Partial<Record<FourPlayerSeat, number>> = { [action.seat]: action.amount };
    const settled = settleFourPlayerEffectDraws(currentMatch, currentZones, drawRequest);
    currentMatch = settled.match;
    currentZones = settled.zones;
    drawnCounts[action.seat] = (drawnCounts[action.seat] ?? 0) + (settled.drawnCounts[action.seat] ?? 0);
    deckOutSeats.push(...settled.deckOutSeats);
  }

  return { match: currentMatch, zones: currentZones, drawnCounts, milledCounts, returnedToHandCounts, deckOutSeats };
}
