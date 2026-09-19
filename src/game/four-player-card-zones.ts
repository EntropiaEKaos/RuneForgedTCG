import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";

export interface FourPlayerCardZoneState {
  hand: readonly string[];
  deck: readonly string[];
}

export type FourPlayerCardZones = Record<FourPlayerSeat, FourPlayerCardZoneState>;

export function createFourPlayerCardZones(
  decks: Record<FourPlayerSeat, readonly string[]>,
  openingHandSize = 0,
): FourPlayerCardZones {
  if (!Number.isInteger(openingHandSize) || openingHandSize < 0) {
    throw new Error("4P opening hand size must be a non-negative integer.");
  }
  return Object.fromEntries(FOUR_PLAYER_SEATS.map((seat) => {
    const deck = [...decks[seat]];
    if (openingHandSize > deck.length) throw new Error(`Seat ${seat} cannot draw an opening hand larger than its deck.`);
    return [seat, { hand: deck.slice(0, openingHandSize), deck: deck.slice(openingHandSize) }];
  })) as unknown as FourPlayerCardZones;
}

export interface FourPlayerDrawResult {
  zones: FourPlayerCardZones;
  drawnDefId?: string;
  deckOut: boolean;
}

export function drawFourPlayerCard(zones: FourPlayerCardZones, seat: FourPlayerSeat): FourPlayerDrawResult {
  const source = zones[seat];
  if (source.deck.length === 0) return { zones, deckOut: true };
  const [drawnDefId, ...deck] = source.deck;
  return {
    zones: {
      ...zones,
      [seat]: { hand: [...source.hand, drawnDefId], deck },
    },
    drawnDefId,
    deckOut: false,
  };
}

export function shouldDrawAtFourPlayerTurnStart(
  seat: FourPlayerSeat,
  round: number,
  startingSeat: FourPlayerSeat,
): boolean {
  if (!Number.isInteger(round) || round < 1) throw new Error("4P round must be a positive integer.");
  return !(round === 1 && seat === startingSeat);
}
