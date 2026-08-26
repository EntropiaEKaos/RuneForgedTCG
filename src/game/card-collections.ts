import { isBaseCard } from "./cards";
import { getCustomCardCollectionCached } from "./catalog";

export interface CardCollectionIdentity {
  id?: number;
  key: string;
  code: string;
  name: string;
  symbol?: string | null;
}

export interface CardCollectionAssignment extends CardCollectionIdentity {
  defId: string;
}

/** First release set. Every code-authored card through the 2.96 Sentinelas & Convergência release belongs to Vanilla unless Studio metadata assigns another collection. */
export const VANILLA_COLLECTION: CardCollectionIdentity = {
  key: "vanilla",
  code: "VAN",
  name: "Vanilla",
  symbol: "/art/collections/vanilla-symbol.png",
};

/** Backwards-compatible aliases for older imports; both now resolve to Vanilla. */
export const CORE_COLLECTION = VANILLA_COLLECTION;
export const CONVERGENCE_COLLECTION = VANILLA_COLLECTION;

const registry: Record<string, CardCollectionIdentity> = {};

export function registerCardCollections(assignments: CardCollectionAssignment[]): void {
  for (const item of assignments) {
    if (!item?.defId || !item.code || !item.name) continue;
    registry[item.defId] = { id: item.id, key: item.key, code: item.code, name: item.name, symbol: item.symbol };
  }
}

/** Replace, rather than merge, so archived/reassigned cards disappear client-side without a full reload. */
export function replaceRegisteredCardCollections(assignments: CardCollectionAssignment[]): void {
  clearRegisteredCardCollections();
  registerCardCollections(assignments);
}

export function getCardCollection(defId: string): CardCollectionIdentity | null {
  return registry[defId] ?? getCustomCardCollectionCached(defId) ?? (isBaseCard(defId) ? VANILLA_COLLECTION : null);
}

export function clearRegisteredCardCollections(): void {
  for (const key of Object.keys(registry)) delete registry[key];
}
