export const FLAGSHIP_CHAMPION_BASE_ART = {
  ember_champion: "/art/cards/flagship/emberhold/ember_champion.webp",
  tide_champion: "/art/cards/flagship/tidecall/tide_champion.webp",
  wood_champion: "/art/cards/flagship/ironwood/wood_champion.webp",
  void_champion: "/art/cards/flagship/voidborn/void_champion.webp",
  forest_champion: "/art/cards/flagship/florestia/forest_champion.webp",
  storm_champion: "/art/cards/flagship/tempestade/storm_champion.webp",
} as const;

export const FLAGSHIP_CHAMPION_ART: Readonly<Record<string, string>> = {
  ember_champion: FLAGSHIP_CHAMPION_BASE_ART.ember_champion,
  ember_champion_2: FLAGSHIP_CHAMPION_BASE_ART.ember_champion,
  ember_champion_3: FLAGSHIP_CHAMPION_BASE_ART.ember_champion,
  tide_champion: FLAGSHIP_CHAMPION_BASE_ART.tide_champion,
  tide_champion_2: FLAGSHIP_CHAMPION_BASE_ART.tide_champion,
  wood_champion: FLAGSHIP_CHAMPION_BASE_ART.wood_champion,
  wood_champion_2: FLAGSHIP_CHAMPION_BASE_ART.wood_champion,
  void_champion: FLAGSHIP_CHAMPION_BASE_ART.void_champion,
  void_champion_2: FLAGSHIP_CHAMPION_BASE_ART.void_champion,
  forest_champion: FLAGSHIP_CHAMPION_BASE_ART.forest_champion,
  forest_champion_2: FLAGSHIP_CHAMPION_BASE_ART.forest_champion,
  storm_champion: FLAGSHIP_CHAMPION_BASE_ART.storm_champion,
  storm_champion_2: FLAGSHIP_CHAMPION_BASE_ART.storm_champion,
};

export function flagshipChampionArtUrl(defId: string): string | undefined {
  return FLAGSHIP_CHAMPION_ART[defId];
}
