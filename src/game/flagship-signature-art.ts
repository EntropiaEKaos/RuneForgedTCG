export const FLAGSHIP_SIGNATURE_ART = {
  ember_ashguard: "/art/cards/flagship/emberhold/ember_ashguard.webp",
  tide_cloudpiercer: "/art/cards/flagship/tidecall/tide_cloudpiercer.webp",
  wood_canopy_bastion: "/art/cards/flagship/ironwood/wood_canopy_bastion.webp",
  void_gloom_warden: "/art/cards/flagship/voidborn/void_gloom_warden.webp",
  forest_dawn_alpha: "/art/cards/flagship/florestia/forest_dawn_alpha.webp",
  storm_static_adept: "/art/cards/flagship/tempestade/storm_static_adept.webp",
} as const;

export function flagshipSignatureArtUrl(defId: string): string | undefined {
  return (FLAGSHIP_SIGNATURE_ART as Readonly<Record<string, string>>)[defId];
}
