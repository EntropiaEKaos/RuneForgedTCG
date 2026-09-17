import type { Rarity } from "./types";

export type CardRarityPresentationId = "common" | "rare" | "epic" | "legend";

export interface CardRarityPresentation {
  id: CardRarityPresentationId;
  rarity: Rarity;
  label: string;
  shortLabel: string;
  rank: number;
  shellClass: string;
  ornamentClass: string;
  premiumFx: "none" | "subtle" | "standard" | "cinematic";
}

/**
 * Presentation-only rarity identity. Gameplay rarity remains authoritative on
 * CardDef and cosmetic frame/finish selection remains a separate concern.
 */
export const CARD_RARITY_PRESENTATION: Record<Rarity, CardRarityPresentation> = {
  Common: { id: "common", rarity: "Common", label: "Comum", shortLabel: "COMUM", rank: 0, shellClass: "card-tier-common", ornamentClass: "card-rarity-ornament-common", premiumFx: "none" },
  Rare: { id: "rare", rarity: "Rare", label: "Rara", shortLabel: "RARA", rank: 1, shellClass: "card-tier-rare", ornamentClass: "card-rarity-ornament-rare", premiumFx: "subtle" },
  Epic: { id: "epic", rarity: "Epic", label: "Épica", shortLabel: "ÉPICA", rank: 2, shellClass: "card-tier-epic", ornamentClass: "card-rarity-ornament-epic", premiumFx: "standard" },
  Legend: { id: "legend", rarity: "Legend", label: "Lendária", shortLabel: "LENDÁRIA", rank: 3, shellClass: "card-tier-legend", ornamentClass: "card-rarity-ornament-legend", premiumFx: "cinematic" },
};

export function resolveCardRarityPresentation(rarity: Rarity | null | undefined): CardRarityPresentation {
  return CARD_RARITY_PRESENTATION[rarity || "Common"];
}

export function rarityPresentationClassNames(rarity: Rarity | null | undefined): string[] {
  const presentation = resolveCardRarityPresentation(rarity);
  return [presentation.shellClass, presentation.ornamentClass];
}
