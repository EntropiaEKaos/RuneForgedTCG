export const FLAGSHIP_TRAP_ART = {
  rfalpha_ember_trap_ash_snare: "/art/cards/flagship/emberhold/rfalpha_ember_trap_ash_snare.webp",
  rfalpha_tide_trap_countercurrent: "/art/cards/flagship/tidecall/rfalpha_tide_trap_countercurrent.webp",
  rfalpha_wood_trap_emergency_bark: "/art/cards/flagship/ironwood/rfalpha_wood_trap_emergency_bark.webp",
  rfalpha_void_trap_early_eclipse: "/art/cards/flagship/voidborn/rfalpha_void_trap_early_eclipse.webp",
  rfalpha_forest_trap_pack_ambush: "/art/cards/flagship/florestia/rfalpha_forest_trap_pack_ambush.webp",
  rfalpha_storm_trap_crosswind: "/art/cards/flagship/tempestade/rfalpha_storm_trap_crosswind.webp",
} as const;

export function flagshipTrapArtUrl(defId: string): string | undefined {
  return (FLAGSHIP_TRAP_ART as Readonly<Record<string, string>>)[defId];
}
