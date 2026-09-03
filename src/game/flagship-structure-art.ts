export const FLAGSHIP_STRUCTURE_ART = {
  rfalpha_ember_structure_forge_bastion: "/art/cards/flagship/emberhold/rfalpha_ember_structure_forge_bastion.webp",
  rfalpha_tide_structure_silent_beacon: "/art/cards/flagship/tidecall/rfalpha_tide_structure_silent_beacon.webp",
  rfalpha_wood_structure_root_circle: "/art/cards/flagship/ironwood/rfalpha_wood_structure_root_circle.webp",
  rfalpha_void_structure_hollow_obelisk: "/art/cards/flagship/voidborn/rfalpha_void_structure_hollow_obelisk.webp",
  rfalpha_forest_structure_ancestral_den: "/art/cards/flagship/florestia/rfalpha_forest_structure_ancestral_den.webp",
  rfalpha_storm_structure_first_thunder: "/art/cards/flagship/tempestade/rfalpha_storm_structure_first_thunder.webp",
} as const;

export function flagshipStructureArtUrl(defId: string): string | undefined {
  return FLAGSHIP_STRUCTURE_ART[defId as keyof typeof FLAGSHIP_STRUCTURE_ART];
}
