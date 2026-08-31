import type { ActivatedAbility, ActivatedAbilityCost, ActivatedAbilityMode } from "./activated-ability-types";
import { validateAuthorableCard } from "./card-authoring";
import type { CardDef, CardEffect } from "./types";

const ACTIVATED_SOURCE_TYPES = new Set<CardDef["type"]>([
  "Unit",
  "Enchantment",
  "Artifact",
  "Sentinela",
]);
const MAX_ACTIVATED_ABILITIES = 4;
const MAX_ACTIVATED_MODES = 4;
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
  if (input.nexusHealth !== undefined) {
    const value = finiteInteger(input.nexusHealth, 0, 20);
    if (value === null) return { ok: false, error: "Activated ability Nexus health cost must be an integer from 0 to 20" };
    if (value > 0) cost.nexusHealth = value;
  }
  if (input.exhaustSelf !== undefined && typeof input.exhaustSelf !== "boolean") {
    return { ok: false, error: "Activated ability exhaustSelf cost must be boolean" };
  }
  if (input.exhaustSelf === true) cost.exhaustSelf = true;
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
    (cost?.nexusHealth ?? 0) > 0 ||
    cost?.exhaustSelf ||
    cost?.sacrificeSelf ||
    (cost?.loyaltyDelta ?? 0) < 0
  );
}

/**
 * Reuse the canonical CardEffect sanitizer without exporting another parallel
 * rules validator. A zero-cost throwaway Spell exercises exactly the same
 * effect contract as normal card authoring, then we keep only its sanitized
 * spell effect.
 */
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
): { ok: true; effect: CardEffect } | { ok: false; error: string } {
  const effectResult = sanitizeEffect(raw, region);
  if (!effectResult.ok) return { ok: false, error: `${context}: ${effectResult.error}` };
  if (effectResult.effect.target === "spellOnStack") {
    return { ok: false, error: "Activated abilities targeting the spell stack are disabled until the authoritative reaction protocol supports them" };
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
): { ok: true; modes: ActivatedAbilityMode[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: `Activated ability ${abilityIndex + 1} modes must be an array` };
  if (raw.length === 0) return { ok: false, error: `Activated ability ${abilityIndex + 1} modal contract requires at least one mode` };
  if (raw.length > MAX_ACTIVATED_MODES) return { ok: false, error: `Activated ability ${abilityIndex + 1} may define at most ${MAX_ACTIVATED_MODES} modes` };

  const ids = new Set<string>();
  const modes: ActivatedAbilityMode[] = [];
  for (const [modeIndex, rawMode] of raw.entries()) {
    if (!rawMode || typeof rawMode !== "object" || Array.isArray(rawMode)) {
      return { ok: false, error: `Activated ability ${abilityIndex + 1} mode ${modeIndex + 1} must be an object` };
    }
    const input = rawMode as Record<string, unknown>;
    if (input.cost !== undefined || input.maxUsesPerRound !== undefined) {
      return { ok: false, error: "Modal choices cannot override cost or usage limits; those remain shared by the base activated ability" };
    }
    const id = typeof input.id === "string" ? input.id.trim() : "";
    if (!MODE_ID_PATTERN.test(id)) {
      return { ok: false, error: `Activated ability ${abilityIndex + 1} mode ${modeIndex + 1} requires a stable id (1-64 safe identifier characters)` };
    }
    if (ids.has(id)) return { ok: false, error: `Activated ability ${abilityIndex + 1} contains duplicate mode id "${id}"` };
    ids.add(id);

    const description = typeof input.description === "string" ? input.description.trim().slice(0, 200) : "";
    if (!description) return { ok: false, error: `Activated ability ${abilityIndex + 1} mode ${modeIndex + 1} requires a description` };

    const effectResult = sanitizeAuthorableEffect(
      input.effect,
      region,
      sourceType,
      `Activated ability ${abilityIndex + 1} mode ${modeIndex + 1}`,
    );
    if (!effectResult.ok) return effectResult;
    modes.push({ id, description, effect: effectResult.effect });
  }

  return { ok: true, modes };
}

export type ActivatedAuthoringResult =
  | { ok: true; card: CardDef }
  | { ok: false; error: string };

/**
 * Canonical Card Creator validation plus the generic activated-ability
 * extension. Existing card sanitization stays untouched; this layer only adds
 * a bounded, data-driven contract that the authoritative engine understands.
 */
export function validateAuthorableCardWithActivatedAbilities(raw: Partial<CardDef> & Record<string, unknown>): ActivatedAuthoringResult {
  const base = validateAuthorableCard(raw);
  if (!base.ok) return base;

  const supplied = raw.activatedAbilities;
  if (supplied === undefined) return base;
  if (!Array.isArray(supplied)) return { ok: false, error: "activatedAbilities must be an array" };
  if (supplied.length === 0) return base;
  if (!ACTIVATED_SOURCE_TYPES.has(base.card.type)) {
    return { ok: false, error: "Activated abilities require a persistent battlefield source: Unit, Enchantment, Artifact or Sentinela" };
  }
  if (supplied.length > MAX_ACTIVATED_ABILITIES) return { ok: false, error: `A card may define at most ${MAX_ACTIVATED_ABILITIES} generic activated abilities` };

  const abilities: ActivatedAbility[] = [];
  for (const [index, rawAbility] of supplied.entries()) {
    if (!rawAbility || typeof rawAbility !== "object" || Array.isArray(rawAbility)) {
      return { ok: false, error: `Activated ability ${index + 1} must be an object` };
    }
    const input = rawAbility as unknown as Record<string, unknown>;
    const description = typeof input.description === "string" ? input.description.trim().slice(0, 200) : "";
    if (!description) return { ok: false, error: `Activated ability ${index + 1} requires a description` };

    const isModal = input.modes !== undefined;
    if (isModal && input.effect !== undefined) {
      return { ok: false, error: `Activated ability ${index + 1} cannot define both effect and modes` };
    }

    let effect: CardEffect | undefined;
    let modes: ActivatedAbilityMode[] | undefined;
    if (isModal) {
      const modesResult = sanitizeModes(input.modes, base.card.region, base.card.type, index);
      if (!modesResult.ok) return modesResult;
      modes = modesResult.modes;
    } else {
      const effectResult = sanitizeAuthorableEffect(input.effect, base.card.region, base.card.type, `Activated ability ${index + 1}`);
      if (!effectResult.ok) return effectResult;
      effect = effectResult.effect;
    }

    const costResult = sanitizeCost(input.cost, base.card.type);
    if (!costResult.ok) return { ok: false, error: `Activated ability ${index + 1}: ${costResult.error}` };
    if (costResult.cost?.sacrificeSelf) {
      const selfTargeted = effect?.target === "self" || modes?.some((mode) => mode.effect.target === "self");
      if (selfTargeted) return { ok: false, error: "A sacrificed source cannot also be the activated effect's self target" };
    }

    let maxUsesPerRound: number | null | undefined;
    if (input.maxUsesPerRound === null) {
      maxUsesPerRound = null;
    } else if (input.maxUsesPerRound !== undefined) {
      const value = finiteInteger(input.maxUsesPerRound, 1, 10);
      if (value === null) return { ok: false, error: "maxUsesPerRound must be null or an integer from 1 to 10" };
      maxUsesPerRound = value;
    }

    if (maxUsesPerRound === null && !hasConsumingCost(costResult.cost)) {
      return { ok: false, error: "Unlimited activated abilities require a consuming cost (mana, Nexus health, exhaust, sacrifice or negative loyalty)" };
    }
    if (base.card.type === "Sentinela" && maxUsesPerRound !== undefined && maxUsesPerRound !== 1) {
      return { ok: false, error: "Sentinelas share one activation per round across all legacy and generic abilities" };
    }

    abilities.push({
      description,
      ...(effect ? { effect } : {}),
      ...(modes ? { modes } : {}),
      ...(costResult.cost ? { cost: costResult.cost } : {}),
      ...(maxUsesPerRound !== undefined ? { maxUsesPerRound } : {}),
    });
  }

  return { ok: true, card: { ...base.card, activatedAbilities: abilities } };
}
