import type { CardDef, Region } from "@/game/types";

export const COMMANDER_ALPHA_RULES = Object.freeze({
  modeId: "commander-alpha",
  players: 4,
  deckSize: 60,
  generalCount: 1,
  maxCopiesPerCard: 3,
  startingNexus: 30,
  turnOrder: "clockwise-seats" as const,
  victory: "last-player-active" as const,
});

export type CommanderLoadoutValidation =
  | { ok: true; deck: string[]; general: CardDef; regions: Region[] }
  | { ok: false; error: string };

function cardRegions(card: CardDef): Region[] {
  return card.regions?.length ? [...card.regions] : [card.region];
}

export function commanderGeneralEligible(card: CardDef) {
  return card.collectible !== false && (card.isChampion === true || card.isLegend === true || card.type === "Sentinela");
}

export function validateCommanderLoadout(deckInput: unknown, generalDefIdInput: unknown, catalog: CardDef[]): CommanderLoadoutValidation {
  if (!Array.isArray(deckInput) || deckInput.length !== COMMANDER_ALPHA_RULES.deckSize) {
    return { ok:false, error:`Commander Alpha requires exactly ${COMMANDER_ALPHA_RULES.deckSize} cards plus one General` };
  }
  const deck = deckInput.map((value) => String(value || "").trim()).filter(Boolean);
  if (deck.length !== COMMANDER_ALPHA_RULES.deckSize) return { ok:false, error:"Commander deck contains an invalid card id" };
  const generalDefId = String(generalDefIdInput || "").trim();
  const byId = new Map(catalog.map((card) => [card.defId, card]));
  const general = byId.get(generalDefId);
  if (!general || !commanderGeneralEligible(general)) return { ok:false, error:"General must be a collectible Champion, Legend or Sentinela" };
  if (deck.includes(general.defId)) return { ok:false, error:"The General is the +1 card and cannot also occupy one of the 60 deck slots" };

  const identity = new Set(cardRegions(general));
  const copies = new Map<string, number>();
  for (const defId of deck) {
    const card = byId.get(defId);
    if (!card || card.collectible === false) return { ok:false, error:`Unknown or non-collectible card: ${defId}` };
    if (cardRegions(card).some((region) => !identity.has(region))) {
      return { ok:false, error:`${card.name} is outside the General's region identity` };
    }
    const count = (copies.get(defId) ?? 0) + 1;
    if (count > COMMANDER_ALPHA_RULES.maxCopiesPerCard) {
      return { ok:false, error:`${card.name} exceeds the ${COMMANDER_ALPHA_RULES.maxCopiesPerCard}-copy Commander limit` };
    }
    copies.set(defId, count);
  }
  return { ok:true, deck, general, regions:[...identity] };
}

export function nextCommanderSeat(currentSeat: number, activeSeats: number[]) {
  const active = [...new Set(activeSeats)].filter((seat) => Number.isInteger(seat) && seat >= 1 && seat <= 4).sort((a,b) => a-b);
  if (!active.length) return null;
  for (let offset=1; offset<=4; offset++) {
    const candidate = ((currentSeat - 1 + offset) % 4) + 1;
    if (active.includes(candidate)) return candidate;
  }
  return active[0] ?? null;
}

export function commanderRoundAfterPass(currentSeat: number, nextSeat: number) {
  return nextSeat <= currentSeat ? 1 : 0;
}
