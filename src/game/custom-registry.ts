import type { CardDef } from "./types";

/** Browser-side registry for custom cards fetched from /api/catalog. */
const registry: Record<string, CardDef> = {};

export function registerCustomCards(cards: CardDef[]): void {
  for (const c of cards) {
    if (c?.defId) registry[c.defId] = c;
  }
}

/** Replace the browser catalog atomically so archived cards cannot linger in memory. */
export function replaceRegisteredCustomCards(cards: CardDef[]): void {
  clearRegisteredCustomCards();
  registerCustomCards(cards);
}

export function getRegisteredCustomCard(defId: string): CardDef | undefined {
  return registry[defId];
}

export function getRegisteredCustomMap(): Record<string, CardDef> {
  return registry;
}

export function clearRegisteredCustomCards(): void {
  for (const k of Object.keys(registry)) delete registry[k];
}

/** Run synchronous replay code against an immutable card-definition snapshot, then restore the process registry. */
export function withRegisteredCardSnapshot<T>(cards: CardDef[], fn: () => T): T {
  const previous = { ...registry };
  try { clearRegisteredCustomCards(); registerCustomCards(cards); return fn(); }
  finally { clearRegisteredCustomCards(); registerCustomCards(Object.values(previous)); }
}
