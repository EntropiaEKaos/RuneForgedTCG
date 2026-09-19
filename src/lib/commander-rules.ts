import { getCard } from "@/game/cards";
import type { Region } from "@/game/types";

export const COMMANDER_ALPHA_RULES = {
  playerCount: 4,
  deckSize: 60,
  startingNexus: 30,
  startingHand: 5,
  maxCopiesPerCard: 3,
  turnOrder: "clockwise" as const,
  generalZone: "command" as const,
} as const;

export type CommanderSeatIndex = 0 | 1 | 2 | 3;

export function nextCommanderSeat(seat: CommanderSeatIndex): CommanderSeatIndex {
  return ((seat + 1) % COMMANDER_ALPHA_RULES.playerCount) as CommanderSeatIndex;
}

export function validateCommanderDeck(cards: string[], generalDefId: string) {
  const errors: string[] = [];
  if (cards.length !== COMMANDER_ALPHA_RULES.deckSize) {
    errors.push(`O deck Commander deve ter exatamente ${COMMANDER_ALPHA_RULES.deckSize} cartas.`);
  }

  if (cards.includes(generalDefId)) errors.push("O General fica fora das 60 cartas do deck.");

  const counts = new Map<string, number>();
  const regions = new Set<Region>();
  for (const defId of cards) {
    let card;
    try { card = getCard(defId); } catch { errors.push(`Carta desconhecida: ${defId}.`); continue; }
    if (card.collectible === false) errors.push(`${card.name} não é colecionável.`);
    counts.set(defId, (counts.get(defId) ?? 0) + 1);
    regions.add(card.region);
  }
  for (const [defId, count] of counts) {
    if (count > COMMANDER_ALPHA_RULES.maxCopiesPerCard) {
      errors.push(`${defId} excede o limite de ${COMMANDER_ALPHA_RULES.maxCopiesPerCard} cópias.`);
    }
  }

  try {
    const general = getCard(generalDefId);
    if (general.collectible === false) errors.push("O General deve ser colecionável.");
    if (!general.isChampion && !general.isLegend) errors.push("O General deve ser Champion ou Legend.");
    if (regions.size > 0 && !regions.has(general.region)) errors.push("O General deve compartilhar ao menos uma região com o deck.");
  } catch {
    errors.push("General desconhecido.");
  }

  return { ok: errors.length === 0, errors, regions: [...regions] };
}

export function commanderInitialState(seats: Array<{ seat: CommanderSeatIndex; playerId: number; playerName: string; generalDefId: string }>) {
  return {
    version: 1,
    round: 1,
    activeSeat: 0 as CommanderSeatIndex,
    prioritySeat: 0 as CommanderSeatIndex,
    turnOrder: seats.map((seat) => seat.seat),
    players: seats.map((seat) => ({
      ...seat,
      nexusHealth: COMMANDER_ALPHA_RULES.startingNexus,
      eliminated: false,
      commanderTax: 0,
    })),
  };
}
