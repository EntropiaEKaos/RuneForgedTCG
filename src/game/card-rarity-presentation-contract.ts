import type { Rarity } from "./types";
import { rarityPresentationClassNames, resolveCardRarityPresentation } from "./card-rarity-presentation";

export interface CardRarityPresentationContract {
  classes: string[];
  attributes: {
    "data-card-rarity": string;
    "data-card-rarity-rank": number;
    "data-card-rarity-fx": string;
  };
}

/** A small renderer boundary so Studio previews and live cards can share rarity semantics. */
export function cardRarityPresentationContract(rarity: Rarity | null | undefined): CardRarityPresentationContract {
  const presentation = resolveCardRarityPresentation(rarity);
  return {
    classes: rarityPresentationClassNames(rarity),
    attributes: {
      "data-card-rarity": presentation.id,
      "data-card-rarity-rank": presentation.rank,
      "data-card-rarity-fx": presentation.premiumFx,
    },
  };
}
