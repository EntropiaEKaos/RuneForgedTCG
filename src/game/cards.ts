import type { CardDef } from "./types";
import { EMBERHOLD_CARDS } from "./cards/base/emberhold";
import { FLORESTIA_CARDS } from "./cards/base/florestia";
import { IRONWOOD_CARDS } from "./cards/base/ironwood";
import { TEMPESTADE_CARDS } from "./cards/base/tempestade";
import { TIDECALL_CARDS } from "./cards/base/tidecall";
import { VOIDBORN_CARDS } from "./cards/base/voidborn";
import { VANILLA_ADDITIONAL_CARDS } from "./cards/vanilla";
import { RELEASE_296_CARDS } from "./cards/release-2.96";

export const CARDS: Record<string, CardDef> = {
  ...EMBERHOLD_CARDS,
  ...FLORESTIA_CARDS,
  ...IRONWOOD_CARDS,
  ...TEMPESTADE_CARDS,
  ...TIDECALL_CARDS,
  ...VOIDBORN_CARDS,
  ...VANILLA_ADDITIONAL_CARDS,
  ...RELEASE_296_CARDS,
};

import { getCustomCard, getCustomCardsMap } from "./catalog";
import { getRegisteredCustomCard, getRegisteredCustomMap } from "./custom-registry";
import { getCardArt } from "./card-art";

function withRuntimeArt(card: CardDef): CardDef {
  const assignment = getCardArt(card.defId);
  return assignment?.url ? { ...card, art: assignment.url } : card;
}

function mergedCards(): Record<string, CardDef> {
  // Server cache + browser registry + base, then dynamic editorial art overlay.
  const merged = { ...CARDS, ...getCustomCardsMap(), ...getRegisteredCustomMap() };
  return Object.fromEntries(Object.entries(merged).map(([defId, card]) => [defId, withRuntimeArt(card)]));
}

export function getCard(defId: string): CardDef {
  const c =
    getRegisteredCustomCard(defId) ??
    getCustomCard(defId) ??
    CARDS[defId];
  if (!c) throw new Error(`Unknown card: ${defId}`);
  return withRuntimeArt(c);
}

export function collectibleCards(): CardDef[] {
  return Object.values(mergedCards()).filter((c) => c.collectible !== false);
}

export function allCards(): CardDef[] {
  return Object.values(mergedCards());
}

export function baseCardsOnly(): CardDef[] {
  return Object.values(CARDS);
}

export function isBaseCard(defId: string): boolean {
  return Boolean(CARDS[defId]);
}
