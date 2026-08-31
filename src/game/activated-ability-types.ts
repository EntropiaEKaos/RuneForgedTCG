import type { ReactionActionKind } from "./counter-rules";
import type { CardEffect } from "./types";

/**
 * Costs that are paid when an activated ability resolves.
 *
 * `mana` always uses regular mana.
 * `spellMana` spends only banked spell mana and never falls back to regular mana.
 * `nexusHealth` cannot be paid if it would reduce the Nexus to zero.
 * `discardFromHand` requires the activating player to explicitly select exactly
 * that many controlled hand-card instance ids in the action payload.
 * `exhaustSelf` consumes a unit's attack readiness for the current round;
 * permanents/Sentinelas remember the exhausted round explicitly.
 * `consumeBarrier` requires an active Barrier on a Unit source and consumes that
 * protection before the effect resolves.
 * `sacrificeSelf` removes the source as a cost before the effect resolves.
 * `loyaltyDelta` is reserved for Sentinelas and preserves the existing
 * Planeswalker-style convention: positive values gain loyalty, negatives pay it.
 */
export interface ActivatedAbilityCost {
  mana?: number;
  spellMana?: number;
  nexusHealth?: number;
  discardFromHand?: number;
  exhaustSelf?: boolean;
  consumeBarrier?: boolean;
  sacrificeSelf?: boolean;
  loyaltyDelta?: number;
}

/** One deterministic choice inside a modal activated ability. */
export interface ActivatedAbilityMode {
  /** Stable replay/wire identifier. Runtime never derives this from display text. */
  id: string;
  description: string;
  effect: CardEffect;
}

/**
 * Generic player-activated ability for battlefield entities.
 *
 * A classic ability owns one `effect`. A modal ability owns one or more
 * `modes` instead; runtime validation rejects ambiguous/malformed definitions
 * and requires an explicit mode id before any cost can be paid.
 *
 * By default an ability may be used once per round. Set maxUsesPerRound to
 * `null` for an unlimited ability. A positive integer allows that many uses.
 * Modal choices share the same cost and per-round usage budget.
 */
export interface ActivatedAbility {
  description: string;
  effect?: CardEffect;
  modes?: ActivatedAbilityMode[];
  cost?: ActivatedAbilityCost;
  maxUsesPerRound?: number | null;
}

/**
 * Battlefield activation that is legal only as a response to an action already
 * committed to the authoritative reaction stack. Keeping reaction abilities in
 * a separate CardDef collection prevents timing data from leaking into the
 * historical main-phase activated ability path.
 */
export interface ReactionActivatedAbility extends ActivatedAbility {
  /** Action families that are allowed to open this reaction opportunity. */
  respondsTo: ReactionActionKind[];
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
    reactionActivatedAbilities?: ReactionActivatedAbility[];
  }

  interface UnitInstance {
    activatedAbilityUses?: Record<string, ActivatedAbilityUsage>;
    exhaustedRound?: number;
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

/**
 * CardAction remains the versioned 2.97 transport shape. Modal ids, selected
 * costs and reaction response identity are additive and optional, so historic
 * actions deserialize unchanged.
 */
declare module "./engine/reactions" {
  interface CardAction {
    modeId?: string;
    costDiscardInstanceIds?: string[];
    /** Present only when a stack frame comes from a battlefield activation. */
    responseKind?: "activatedAbility";
  }
}
