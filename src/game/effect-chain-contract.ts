export const EFFECT_CHAIN_MAX_SUPPORTED_DEPTH = 12 as const;
export const EFFECT_CHAIN_MAX_EFFECTS = EFFECT_CHAIN_MAX_SUPPORTED_DEPTH + 1;

/**
 * CardEffect.also is a linear, sequential chain. Depth starts at zero, so a
 * max depth of 12 permits 13 effects total. This contract is shared by the
 * sanitizer and Studio to prevent authoring/runtime drift.
 */
export const EFFECT_CHAIN_AUTHORING_CONTRACT = {
  support: "supported",
  execution: "sequential",
  maxDepth: EFFECT_CHAIN_MAX_SUPPORTED_DEPTH,
  maxEffects: EFFECT_CHAIN_MAX_EFFECTS,
} as const;

export function effectChainDepthSupported(depth: number): boolean {
  return Number.isInteger(depth) && depth >= 0 && depth <= EFFECT_CHAIN_MAX_SUPPORTED_DEPTH;
}

export function effectCanAddFollowUp(depth: number): boolean {
  return Number.isInteger(depth) && depth >= 0 && depth < EFFECT_CHAIN_MAX_SUPPORTED_DEPTH;
}
