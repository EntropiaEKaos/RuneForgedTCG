import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";

export interface FourPlayerCardInstance {
  instanceId: string;
  defId: string;
  ownerSeat: FourPlayerSeat;
}

export interface FourPlayerCardZoneState {
  hand: readonly FourPlayerCardInstance[];
  deck: readonly FourPlayerCardInstance[];
  graveyard: readonly FourPlayerCardInstance[];
}

export type FourPlayerCardZones = Record<FourPlayerSeat, FourPlayerCardZoneState>;

export function fourPlayerHandCounts(zones: FourPlayerCardZones): Record<FourPlayerSeat, number> {
  return Object.fromEntries(
    FOUR_PLAYER_SEATS.map((seat) => [seat, zones[seat].hand.length]),
  ) as Record<FourPlayerSeat, number>;
}

function createDeckInstances(seat: FourPlayerSeat, deck: readonly string[]): FourPlayerCardInstance[] {
  return deck.map((defId, index) => ({
    instanceId: `${seat}:card:${index + 1}`,
    defId,
    ownerSeat: seat,
  }));
}

export function createFourPlayerCardZones(
  decks: Record<FourPlayerSeat, readonly string[]>,
  openingHandSize = 0,
): FourPlayerCardZones {
  if (!Number.isInteger(openingHandSize) || openingHandSize < 0) {
    throw new Error("4P opening hand size must be a non-negative integer.");
  }
  return Object.fromEntries(FOUR_PLAYER_SEATS.map((seat) => {
    const deck = createDeckInstances(seat, decks[seat]);
    if (openingHandSize > deck.length) throw new Error(`Seat ${seat} cannot draw an opening hand larger than its deck.`);
    return [seat, { hand: deck.slice(0, openingHandSize), deck: deck.slice(openingHandSize), graveyard: [] }];
  })) as unknown as FourPlayerCardZones;
}

export interface FourPlayerDrawResult {
  zones: FourPlayerCardZones;
  drawnCard?: FourPlayerCardInstance;
  drawnDefId?: string;
  deckOut: boolean;
}

export function drawFourPlayerCard(zones: FourPlayerCardZones, seat: FourPlayerSeat): FourPlayerDrawResult {
  const source = zones[seat];
  if (source.deck.length === 0) return { zones, deckOut: true };
  const [drawnCard, ...deck] = source.deck;
  return {
    zones: {
      ...zones,
      [seat]: { ...source, hand: [...source.hand, drawnCard], deck },
    },
    drawnCard,
    drawnDefId: drawnCard.defId,
    deckOut: false,
  };
}

export function findFourPlayerHandCard(
  zones: FourPlayerCardZones,
  seat: FourPlayerSeat,
  instanceId: string,
): FourPlayerCardInstance {
  const id = String(instanceId || "").trim();
  const card = zones[seat].hand.find((entry) => entry.instanceId === id);
  if (!card) throw new Error(`Card instance ${id || "<empty>"} is not in ${seat}'s hand.`);
  if (card.ownerSeat !== seat) throw new Error(`Card instance ${card.instanceId} has invalid owner ${card.ownerSeat} for ${seat}'s hand.`);
  return card;
}

export function takeFourPlayerCardFromHand(
  zones: FourPlayerCardZones,
  seat: FourPlayerSeat,
  instanceId: string,
): { zones: FourPlayerCardZones; card: FourPlayerCardInstance } {
  const card = findFourPlayerHandCard(zones, seat, instanceId);
  const source = zones[seat];
  return {
    card,
    zones: {
      ...zones,
      [seat]: { ...source, hand: source.hand.filter((entry) => entry.instanceId !== card.instanceId) },
    },
  };
}

export function putFourPlayerCardInHand(
  zones: FourPlayerCardZones,
  card: FourPlayerCardInstance,
): FourPlayerCardZones {
  const source = zones[card.ownerSeat];
  if (source.hand.some((entry) => entry.instanceId === card.instanceId)) {
    throw new Error(`Card instance ${card.instanceId} is already in hand.`);
  }
  return {
    ...zones,
    [card.ownerSeat]: { ...source, hand: [...source.hand, card] },
  };
}

export function millFourPlayerCards(
  zones: FourPlayerCardZones,
  seat: FourPlayerSeat,
  amount: number,
): { zones: FourPlayerCardZones; milled: readonly FourPlayerCardInstance[] } {
  if (!Number.isInteger(amount) || amount < 0) throw new Error("4P mill amount must be a non-negative integer.");
  if (amount === 0) return { zones, milled: [] };
  const source = zones[seat];
  const milled = source.deck.slice(0, amount);
  return {
    milled,
    zones: {
      ...zones,
      [seat]: {
        ...source,
        deck: source.deck.slice(milled.length),
        graveyard: [...source.graveyard, ...milled],
      },
    },
  };
}

export function findFourPlayerGraveyardCard(
  zones: FourPlayerCardZones,
  seat: FourPlayerSeat,
  instanceId: string,
): FourPlayerCardInstance {
  const id = String(instanceId || "").trim();
  const card = zones[seat].graveyard.find((entry) => entry.instanceId === id);
  if (!card) throw new Error(`Card instance ${id || "<empty>"} is not in ${seat}'s graveyard.`);
  return card;
}

export function takeFourPlayerCardFromGraveyard(
  zones: FourPlayerCardZones,
  seat: FourPlayerSeat,
  instanceId: string,
): { zones: FourPlayerCardZones; card: FourPlayerCardInstance } | undefined {
  const id = String(instanceId || "").trim();
  const source = zones[seat];
  const card = source.graveyard.find((entry) => entry.instanceId === id);
  if (!card) return undefined;
  return {
    card,
    zones: {
      ...zones,
      [seat]: { ...source, graveyard: source.graveyard.filter((entry) => entry.instanceId !== id) },
    },
  };
}

export function putFourPlayerCardInGraveyard(
  zones: FourPlayerCardZones,
  card: FourPlayerCardInstance,
): FourPlayerCardZones {
  const source = zones[card.ownerSeat];
  if (source.graveyard.some((entry) => entry.instanceId === card.instanceId)) {
    throw new Error(`Card instance ${card.instanceId} is already in the graveyard.`);
  }
  return {
    ...zones,
    [card.ownerSeat]: { ...source, graveyard: [...source.graveyard, card] },
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

export interface FourPlayerTurnStartDrawResult {
  zones: FourPlayerCardZones;
  drew: boolean;
  drawnCard?: FourPlayerCardInstance;
  drawnDefId?: string;
  deckOut: boolean;
}

export function applyFourPlayerTurnStartDraw(
  zones: FourPlayerCardZones,
  seat: FourPlayerSeat,
  round: number,
  startingSeat: FourPlayerSeat,
): FourPlayerTurnStartDrawResult {
  if (!shouldDrawAtFourPlayerTurnStart(seat, round, startingSeat)) {
    return { zones, drew: false, deckOut: false };
  }
  const result = drawFourPlayerCard(zones, seat);
  return { ...result, drew: !result.deckOut };
}