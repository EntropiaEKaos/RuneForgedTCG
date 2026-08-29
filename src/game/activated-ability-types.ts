import type { CardEffect } from "./types";

/**
 * Costs that are paid when an activated ability resolves.
 *
 * `mana` always uses regular mana (never spell mana).
 * `nexusHealth` cannot be paid if it would reduce the Nexus to zero.
 * `exhaustSelf` consumes a unit's attack readiness for the current round;
 * permanents/Sentinelas remember the exhausted round explicitly.
 * `sacrificeSelf` removes the source as a cost before the effect resolves.
 * `loyaltyDelta` is reserved for Sentinelas and preserves the existing
 * Planeswalker-style convention: positive values gain loyalty, negatives pay it.
 */
export interface ActivatedAbilityCost {
  mana?: number;
  nexusHealth?: number;
  exhaustSelf?: boolean;
  sacrificeSelf?: boolean;
  loyaltyDelta?: number;
}

/**
 * Generic player-activated ability for battlefield entities.
 *
 * By default an ability may be used once per round. Set maxUsesPerRound to
 * `null` for an unlimited ability. A positive integer allows that many uses.
 */
export interface ActivatedAbility {
  description: string;
  effect: CardEffect;
  cost?: ActivatedAbilityCost;
  maxUsesPerRound?: number | null;
}

export interface ActivatedAbilityUsage {
  round: number;
  count: number;
}

/**
 * Extend the core card/entity contracts without breaking serialized 2.97 game
 * states. Every runtime field is optional, so existing replays remain valid.
 */
declare module "./types" {
  interface CardDef {
    activatedAbilities?: ActivatedAbility[];
  }

  interface UnitInstance {
    activatedAbilityUses?: Record<string, ActivatedAbilityUsage>;
  }

  interface PermanentInstance {
    activatedAbilityUses?: Record<string, ActivatedAbilityUsage>;
    exhaustedRound?: number;
  }

  interface SentinelaInstance {
    activatedAbilityUses?: Record<string, ActivatedAbilityUsage>;
    exhaustedRound?: number;
  }
}
