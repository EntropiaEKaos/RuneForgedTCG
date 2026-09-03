export const FLAGSHIP_RITUAL_ART = {
  rfalpha_ember_ritual_red_rite: "/art/cards/flagship/emberhold/rfalpha_ember_ritual_red_rite.webp",
  rfalpha_tide_ritual_memory_tide: "/art/cards/flagship/tidecall/rfalpha_tide_ritual_memory_tide.webp",
  rfalpha_wood_ritual_ancient_roots: "/art/cards/flagship/ironwood/rfalpha_wood_ritual_ancient_roots.webp",
  rfalpha_void_ritual_emptiness: "/art/cards/flagship/voidborn/rfalpha_void_ritual_emptiness.webp",
  rfalpha_forest_ritual_green_moon: "/art/cards/flagship/florestia/rfalpha_forest_ritual_green_moon.webp",
  rfalpha_storm_ritual_eye_of_storm: "/art/cards/flagship/tempestade/rfalpha_storm_ritual_eye_of_storm.webp",
} as const;

export function flagshipRitualArtUrl(defId: string): string | undefined {
  return (FLAGSHIP_RITUAL_ART as Readonly<Record<string, string>>)[defId];
}
