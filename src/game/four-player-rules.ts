import type { CardDef } from "./types";

export const FOUR_PLAYER_RULESET_V0 = Object.freeze({
  id: "4p-general-v0",
  players: 4,
  mainDeckCards: 80,
  generals: 1,
  maxCopies: 2,
  startingLifeMultiplier: 1.5,
  generalRecastTax: 2,
  firstPlayerSkipsFirstDraw: true,
  defaultPriority: "smart" as const,
});

export type FourPlayerSeat = 0 | 1 | 2 | 3;
export type FourPlayerPriorityMode = "auto" | "smart" | "full";

export interface GeneralIdentity {
  races: string[];
  classes: string[];
  affinities: string[];
}

export interface FourPlayerDeckValidation {
  ok: boolean;
  errors: string[];
  identity: GeneralIdentity | null;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

export function generalIdentity(definition: CardDef): GeneralIdentity {
  return {
    races: unique([definition.race, ...(definition.secondaryRaces ?? [])]),
    classes: unique(definition.classes ?? []),
    affinities: unique(definition.doctrineAffinities ?? []),
  };
}

export function generalZoneCost(baseCost: number, priorZoneCasts: number): number {
  const base = Math.max(0, Math.trunc(Number(baseCost) || 0));
  const casts = Math.max(0, Math.trunc(Number(priorZoneCasts) || 0));
  return base + casts * FOUR_PLAYER_RULESET_V0.generalRecastTax;
}

export function startingFourPlayerLife(oneVsOneLife: number): number {
  return Math.max(1, Math.ceil(Math.max(1, Number(oneVsOneLife) || 1) * FOUR_PLAYER_RULESET_V0.startingLifeMultiplier));
}

export function aliveSeats(eliminated: Iterable<number>): FourPlayerSeat[] {
  const gone = new Set([...eliminated].map(Number));
  return ([0, 1, 2, 3] as FourPlayerSeat[]).filter((seat) => !gone.has(seat));
}

export function nextAliveSeat(current: FourPlayerSeat, eliminated: Iterable<number>): FourPlayerSeat {
  const alive = aliveSeats(eliminated);
  if (!alive.length) return current;
  for (let offset = 1; offset <= FOUR_PLAYER_RULESET_V0.players; offset++) {
    const candidate = ((current + offset) % FOUR_PLAYER_RULESET_V0.players) as FourPlayerSeat;
    if (alive.includes(candidate)) return candidate;
  }
  return current;
}

export interface PriorityPassState {
  seat: FourPlayerSeat;
  consecutivePasses: number;
  resolved: boolean;
}

/**
 * Passing rotates through living seats. A game action must reset the
 * consecutivePasses counter to zero before priority is granted again.
 */
export function passPriority(
  current: FourPlayerSeat,
  consecutivePasses: number,
  eliminated: Iterable<number>,
): PriorityPassState {
  const alive = aliveSeats(eliminated);
  const passes = Math.max(0, Math.trunc(consecutivePasses)) + 1;
  if (alive.length <= 1 || passes >= alive.length) {
    return { seat: nextAliveSeat(current, eliminated), consecutivePasses: 0, resolved: true };
  }
  return { seat: nextAliveSeat(current, eliminated), consecutivePasses: passes, resolved: false };
}

function overlaps(left: string[], right: string[]): boolean {
  if (!left.length || !right.length) return false;
  const set = new Set(left.map((value) => value.toLowerCase()));
  return right.some((value) => set.has(value.toLowerCase()));
}

export function cardMatchesGeneralIdentity(card: CardDef, identity: GeneralIdentity): boolean {
  const cardIdentity = generalIdentity(card);
  return overlaps(identity.races, cardIdentity.races)
    || overlaps(identity.classes, cardIdentity.classes)
    || overlaps(identity.affinities, cardIdentity.affinities);
}

export function validateFourPlayerDeck(
  cards: string[],
  generalDefId: string,
  lookupCard: (defId: string) => CardDef | undefined,
): FourPlayerDeckValidation {
  const errors: string[] = [];
  if (cards.length !== FOUR_PLAYER_RULESET_V0.mainDeckCards) {
    errors.push(`O deck 4P precisa ter exatamente ${FOUR_PLAYER_RULESET_V0.mainDeckCards} cartas no deck principal.`);
  }

  const counts = new Map<string, number>();
  for (const rawId of cards) {
    const defId = String(rawId || "").trim();
    counts.set(defId, (counts.get(defId) ?? 0) + 1);
  }
  for (const [defId, count] of counts) {
    if (!defId || !lookupCard(defId)) errors.push(`Carta desconhecida no deck 4P: ${defId || "(vazia)"}.`);
    if (count > FOUR_PLAYER_RULESET_V0.maxCopies) errors.push(`${defId}: máximo de ${FOUR_PLAYER_RULESET_V0.maxCopies} cópias no ruleset 4P v0.`);
  }

  const general = lookupCard(String(generalDefId || "").trim());
  if (!general) return { ok: false, errors: [...errors, "General inválido ou inexistente."], identity: null };
  if (counts.has(general.defId)) errors.push("O General fica fora das 80 cartas do deck principal.");
  if (general.collectible === false) errors.push("O General precisa ser uma carta colecionável.");
  const identity = generalIdentity(general);
  if (!identity.races.length && !identity.classes.length && !identity.affinities.length) {
    errors.push("O General precisa declarar identidade de raça, classe e/ou afinidade.");
  } else {
    for (const defId of counts.keys()) {
      const card = lookupCard(defId);
      if (card && !cardMatchesGeneralIdentity(card, identity)) {
        errors.push(`${card.name}: não compartilha raça, classe ou afinidade com o General.`);
      }
    }
  }

  return { ok: errors.length === 0, errors, identity };
}
