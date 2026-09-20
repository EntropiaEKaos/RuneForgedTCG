export const FOUR_PLAYER_RESOLVER_EFFECT_KINDS = [
  "damageUnit",
  "damageNexus",
  "healUnit",
  "healNexus",
  "buffUnit",
  "buffAllies",
  "buffRace",
  "buffClass",
  "manaRefund",
  "aoeEnemy",
  "grantBarrier",
  "grantKeyword",
  "poison",
  "draw",
  "summonToken",
  "frostbite",
  "stun",
  "killUnit",
  "recall",
  "damagePermanent",
  "destroyPermanent",
  "mill",
  "selfMill",
  "returnGraveyardToHand",
  "reanimateUnit",
  "banishGraveyardCard",
  "attachEquipment",
] as const;

export const FOUR_PLAYER_SUPPORTED_SPELL_EFFECT_KINDS = [
  ...FOUR_PLAYER_RESOLVER_EFFECT_KINDS,
  "negateSpell",
] as const;

export type FourPlayerSupportedSpellEffectKind = (typeof FOUR_PLAYER_SUPPORTED_SPELL_EFFECT_KINDS)[number];

export interface FourPlayerSpellEffectLike {
  kind: string;
  also?: FourPlayerSpellEffectLike;
}

const SUPPORTED = new Set<string>(FOUR_PLAYER_SUPPORTED_SPELL_EFFECT_KINDS);

/** Shared client/server guard so Commander never advertises a spell the authority cannot execute. */
export function isFourPlayerSpellChainSupported(effect: FourPlayerSpellEffectLike | undefined): boolean {
  let cursor = effect;
  for (let guard = 0; cursor && guard < 32; guard += 1) {
    if (!SUPPORTED.has(cursor.kind)) return false;
    cursor = cursor.also;
  }
  return !cursor;
}