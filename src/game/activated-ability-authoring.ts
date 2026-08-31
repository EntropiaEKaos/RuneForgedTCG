import type {
  ActivatedAbility,
  ActivatedAbilityCost,
  ActivatedAbilityMode,
  ReactionActivatedAbility,
} from "./activated-ability-types";
import type { ReactionActionKind } from "./counter-rules";
import { validateAuthorableCard } from "./card-authoring";
import type { CardDef, CardEffect } from "./types";

const ACTIVATED_SOURCE_TYPES = new Set<CardDef["type"]>([
  "Unit",
  "Enchantment",
  "Artifact",
  "Sentinela",
]);
const REACTION_ACTION_KINDS = new Set<ReactionActionKind>(["unit", "spell", "sentinela"]);
const MAX_ACTIVATED_ABILITIES = 4;
const MAX_ACTIVATED_MODES = 4;
const MAX_DISCARD_FROM_HAND_COST = 10;
const MODE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

function finiteInteger(value: unknown, min: number, max: number): number | null {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number) || number < min || number > max) return null;
  return number;
}

function sanitizeCost(raw: unknown, sourceType: CardDef["type"]): { ok: true; cost?: ActivatedAbilityCost } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true };
  if (typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Activated ability cost must be an object" };
  const input = raw as Record<string, unknown>;
  const cost: ActivatedAbilityCost = {};

  if (input.mana !== undefined) {
    const value = finiteInteger(input.mana, 0, 20);
    if (value === null) return { ok: false, error: "Activated ability mana cost must be an integer from 0 to 20" };
    if (value > 0) cost.mana = value;
  }
  if (input.spellMana !== undefined) {
    const value = finiteInteger(input.spellMana, 0, 20);
    if (value === null) return { ok: false, error: "Activated ability spell mana cost must be an integer from 0 to 20" };
    if (value > 0) cost.spellMana = value;
  }
  if (input.nexusHealth !== undefined) {
    const value = finiteInteger(input.nexusHealth, 0, 20);
    if (value === null) return { ok: false, error: "Activated ability Nexus health cost must be an integer from 0 to 20" };
    if (value > 0) cost.nexusHealth = value;
  }
  if (input.discardFromHand !== undefined) {
    const value = finiteInteger(input.discardFromHand, 0, MAX_DISCARD_FROM_HAND_COST);
    if (value === null) return { ok: false, error: `Activated ability discardFromHand cost must be an integer from 0 to ${MAX_DISCARD_FROM_HAND_COST}` };
    if (value > 0) cost.discardFromHand = value;
  }
  if (input.exhaustSelf !== undefined && typeof input.exhaustSelf !== "boolean") {
    return { ok: false, error: "Activated ability exhaustSelf cost must be boolean" };
  }
  if (input.exhaustSelf === true) cost.exhaustSelf = true;
  if (input.consumeBarrier !== undefined && typeof input.consumeBarrier !== "boolean") {
    return { ok: false, error: "Activated ability consumeBarrier cost must be boolean" };
  }
  if (input.consumeBarrier === true) {
    if (sourceType !== "Unit") return { ok: false, error: "Only Unit sources may consume Barrier as an activated ability cost" };
    cost.consumeBarrier = true;
  }
  if (input.sacrificeSelf !== undefined && typeof input.sacrificeSelf !== "boolean") {
    return { ok: false, error: "Activated ability sacrificeSelf cost must be boolean" };
  }
  if (input.sacrificeSelf === true) cost.sacrificeSelf = true;

  if (input.loyaltyDelta !== undefined) {
    if (sourceType !== "Sentinela") return { ok: false, error: "Only Sentinelas may use loyaltyDelta as an activated ability cost" };
    const value = finiteInteger(input.loyaltyDelta, -20, 20);
    if (value === null) return { ok: false, error: "Activated ability loyaltyDelta must be an integer from -20 to 20" };
    cost.loyaltyDelta = value;
  }

  return Object.keys(cost).length ? { ok: true, cost } : { ok: true };
}

function hasConsumingCost(cost: ActivatedAbilityCost | undefined): boolean {
  return Boolean(
    (cost?.mana ?? 0) > 0 ||
    (cost?.spellMana ?? 0) > 0 ||
    (cost?.nexusHealth ?? 0) > 0 ||
    (cost?.discardFromHand ?? 0) > 0 ||
    cost?.exhaustSelf ||
    cost?.consumeBarrier ||
    cost?.sacrificeSelf ||
    (cost?.loyaltyDelta ?? 0) < 0
  );
}

/** Reuse the canonical CardEffect sanitizer through a zero-cost probe Spell. */
function sanitizeEffect(raw: unknown, region: CardDef["region"]): { ok: true; effect: CardEffect } | { ok: false; error: string } {
  const probe = validateAuthorableCard({
    defId: "activated_effect_probe",
    name: "Activated Effect Probe",
    region,
    type: "Spell",
    cost: 0,
    description: "Authoring validation probe.",
    rarity: "Common",
    emoji: "✦",
    spell: raw as CardEffect,
  });
  if (!probe.ok || !probe.card.spell) return { ok: false, error: probe.ok ? "Invalid activated ability effect" : probe.error };
  return { ok: true, effect: probe.card.spell };
}

function sanitizeAuthorableEffect(
  raw: unknown,
  region: CardDef["region"],
  sourceType: CardDef["type"],
  context: string,
  allowStackTarget: boolean,
): { ok: true; effect: CardEffect } | { ok: false; error: string } {
  const effectResult = sanitizeEffect(raw, region);
  if (!effectResult.ok) return { ok: false, error: `${context}: ${effectResult.error}` };
  if (effectResult.effect.target === "spellOnStack" && !allowStackTarget) {
    return { ok: false, error: "Main-phase activated abilities cannot target the reaction stack" };
  }
  if (effectResult.effect.target === "self" && sourceType !== "Unit") {
    return { ok: false, error: "Generic self-target activated effects currently require a Unit source" };
  }
  return effectResult;
}

function sanitizeModes(
  raw: unknown,
  region: CardDef["region"],
  sourceType: CardDef["type"],
  abilityIndex: number,
  label: string,
  allowStackTarget: boolean,
): { ok: true; modes: ActivatedAbilityMode[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: `${label} ${abilityIndex + 1} modes must be an array` };
  if (raw.length === 0) return { ok: false, error: `${label} ${abilityIndex + 1} modal contract requires at least one mode` };
  if (raw.length > MAX_ACTIVATED_MODES) return { ok: false, error: `${label} ${abilityIndex + 1} may define at most ${MAX_ACTIVATED_MODES} modes` };

  const ids = new Set<string>();
  const modes: ActivatedAbilityMode[] = [];
  for (const [modeIndex, rawMode] of raw.entries()) {
    if (!rawMode || typeof rawMode !== "object" || Array.isArray(rawMode)) {
      return { ok: false, error: `${label} ${abilityIndex + 1} mode ${modeIndex + 1} must be an object` };
    }
    const input = rawMode as Record<string, unknown>;
    if (input.cost !== undefined || input.condition !== undefined || input.maxUsesPerRound !== undefined) {
      return { ok: false, error: "Modal choices cannot override cost, condition or usage limits; those remain shared at the base activated ability level" };
    }
    const id = typeof input.id === "string" ? input.id.trim() : "";
    if (!MODE_ID_PATTERN.test(id)) {
      return { ok: false, error: `${label} ${abilityIndex + 1} mode ${modeIndex + 1} requires a stable id (1-64 safe identifier characters)` };
    }
    if (ids.has(id)) return { ok: false, error: `${label} ${abilityIndex + 1} contains duplicate mode id "${id}"` };
    ids.add(id);

    const description = typeof input.description === "string" ? input.description.trim().slice(0, 200) : "";
    if (!description) return { ok: false, error: `${label} ${abilityIndex + 1} mode ${modeIndex + 1} requires a description` };

    const effectResult = sanitizeAuthorableEffect(
      input.effect,
      region,
      sourceType,
      `${label} ${abilityIndex + 1} mode ${modeIndex + 1}`,
      allowStackTarget,
    );
    if (!effectResult.ok) return effectResult;
    modes.push({ id, description, effect: effectResult.effect });
  }

  return { ok: true, modes };
}

function sanitizeAbilityCore(
  rawAbility: unknown,
  base: CardDef,
  index: number,
  label: string,
  allowStackTarget: boolean,
): { ok: true; ability: ActivatedAbility } | { ok: false; error: string } {
  if (!rawAbility || typeof rawAbility !== "object" || Array.isArray(rawAbility)) {
    return { ok: false, error: `${label} ${index + 1} must be an object` };
  }
  const input = rawAbility as Record<string, unknown>;
  const description = typeof input.description === "string" ? input.description.trim().slice(0, 200) : "";
  if (!description) return { ok: false, error: `${label} ${index + 1} requires a description` };

  const isModal = input.modes !== undefined;
  if (isModal && input.effect !== undefined) return { ok: false, error: `${label} ${index + 1} cannot define both effect and modes` };

  let effect: CardEffect | undefined;
  let modes: ActivatedAbilityMode[] | undefined;
  if (isModal) {
    const modesResult = sanitizeModes(input.modes, base.region, base.type, index, label, allowStackTarget);
    if (!modesResult.ok) return modesResult;
    modes = modesResult.modes;
  } else {
    const effectResult = sanitizeAuthorableEffect(input.effect, base.region, base.type, `${label} ${index + 1}`, allowStackTarget);
    if (!effectResult.ok) return effectResult;
    effect = effectResult.effect;
  }

  const costResult = sanitizeCost(input.cost, base.type);
  if (!costResult.ok) return { ok: false, error: `${label} ${index + 1}: ${costResult.error}` };
  if (costResult.cost?.sacrificeSelf) {
    const selfTargeted = effect?.target === "self" || modes?.some((mode) => mode.effect.target === "self");
    if (selfTargeted) return { ok: false, error: "A sacrificed source cannot also be the activated effect's self target" };
  }

  let maxUsesPerRound: number | null | undefined;
  if (input.maxUsesPerRound === null) maxUsesPerRound = null;
  else if (input.maxUsesPerRound !== undefined) {
    const value = finiteInteger(input.maxUsesPerRound, 1, 10);
    if (value === null) return { ok: false, error: "maxUsesPerRound must be null or an integer from 1 to 10" };
    maxUsesPerRound = value;
  }

  if (maxUsesPerRound === null && !hasConsumingCost(costResult.cost)) {
    return { ok: false, error: "Unlimited activated abilities require a consuming cost (regular mana, spell mana, Nexus health, selected hand discard, exhaust, Barrier, sacrifice or negative loyalty)" };
  }
  if (base.type === "Sentinela" && maxUsesPerRound !== undefined && maxUsesPerRound !== 1) {
    return { ok: false, error: "Sentinelas share one activation per round across all legacy and generic abilities" };
  }

  return {
    ok: true,
    ability: {
      description,
      ...(effect ? { effect } : {}),
      ...(modes ? { modes } : {}),
      ...(costResult.cost ? { cost: costResult.cost } : {}),
      ...(maxUsesPerRound !== undefined ? { maxUsesPerRound } : {}),
    },
  };
}

function sanitizeRespondsTo(raw: unknown, abilityIndex: number): { ok: true; respondsTo: ReactionActionKind[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > REACTION_ACTION_KINDS.size) {
    return { ok: false, error: `Reaction activated ability ${abilityIndex + 1} respondsTo must contain 1-3 action kinds` };
  }
  const result: ReactionActionKind[] = [];
  for (const value of raw) {
    if (typeof value !== "string" || !REACTION_ACTION_KINDS.has(value as ReactionActionKind)) {
      return { ok: false, error: `Reaction activated ability ${abilityIndex + 1} contains an unsupported respondsTo action kind` };
    }
    const kind = value as ReactionActionKind;
    if (result.includes(kind)) return { ok: false, error: `Reaction activated ability ${abilityIndex + 1} contains duplicate respondsTo action kinds` };
    result.push(kind);
  }
  return { ok: true, respondsTo: result };
}

export type ActivatedAuthoringResult =
  | { ok: true; card: CardDef }
  | { ok: false; error: string };

/**
 * Canonical Card Creator validation plus both activated-ability timing
 * collections. Main-phase and reaction activations share cost/mode semantics,
 * but reaction timing remains explicit and stack targeting is legal only in the
 * reaction collection.
 */
export function validateAuthorableCardWithActivatedAbilities(raw: Partial<CardDef> & Record<string, unknown>): ActivatedAuthoringResult {
  const suppliedMain = raw.activatedAbilities;
  const suppliedReaction = raw.reactionActivatedAbilities;
  const baseInput = { ...raw } as Partial<CardDef> & Record<string, unknown>;
  delete baseInput.activatedAbilities;
  delete baseInput.reactionActivatedAbilities;
  const baseResult = validateAuthorableCard(baseInput);
  if (!baseResult.ok) return baseResult;
  let card = baseResult.card;

  if (suppliedMain !== undefined) {
    if (!Array.isArray(suppliedMain)) return { ok: false, error: "activatedAbilities must be an array" };
    if (suppliedMain.length > MAX_ACTIVATED_ABILITIES) return { ok: false, error: `A card may define at most ${MAX_ACTIVATED_ABILITIES} generic activated abilities` };
    if (suppliedMain.length > 0 && !ACTIVATED_SOURCE_TYPES.has(card.type)) {
      return { ok: false, error: "Activated abilities require a persistent battlefield source: Unit, Enchantment, Artifact or Sentinela" };
    }
    const abilities: ActivatedAbility[] = [];
    for (const [index, rawAbility] of suppliedMain.entries()) {
      const result = sanitizeAbilityCore(rawAbility, card, index, "Activated ability", false);
      if (!result.ok) return result;
      abilities.push(result.ability);
    }
    if (abilities.length) card = { ...card, activatedAbilities: abilities };
  }

  if (suppliedReaction !== undefined) {
    if (!Array.isArray(suppliedReaction)) return { ok: false, error: "reactionActivatedAbilities must be an array" };
    if (suppliedReaction.length > MAX_ACTIVATED_ABILITIES) return { ok: false, error: `A card may define at most ${MAX_ACTIVATED_ABILITIES} reaction activated abilities` };
    if (suppliedReaction.length > 0 && !ACTIVATED_SOURCE_TYPES.has(card.type)) {
      return { ok: false, error: "Reaction activated abilities require a persistent battlefield source: Unit, Enchantment, Artifact or Sentinela" };
    }
    const abilities: ReactionActivatedAbility[] = [];
    for (const [index, rawAbility] of suppliedReaction.entries()) {
      const input = rawAbility as unknown as Record<string, unknown> | null;
      const timing = sanitizeRespondsTo(input?.respondsTo, index);
      if (!timing.ok) return timing;
      const core = sanitizeAbilityCore(rawAbility, card, index, "Reaction activated ability", true);
      if (!core.ok) return core;

      const choices = core.ability.modes?.map((mode) => mode.effect) ?? (core.ability.effect ? [core.ability.effect] : []);
      if (choices.length === 1 && choices[0]?.target === "spellOnStack" && timing.respondsTo.some((kind) => kind !== "spell")) {
        return { ok: false, error: `Reaction activated ability ${index + 1} targets the spell stack and therefore may respond only to spell actions` };
      }
      abilities.push({ ...core.ability, respondsTo: timing.respondsTo });
    }
    if (abilities.length) card = { ...card, reactionActivatedAbilities: abilities };
  }

  return { ok: true, card };
}