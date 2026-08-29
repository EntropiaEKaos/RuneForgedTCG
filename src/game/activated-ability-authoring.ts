import type { ActivatedAbility, ActivatedAbilityCost } from "./activated-ability-types";
import { validateAuthorableCard } from "./card-authoring";
import type { CardDef, CardEffect } from "./types";

const ACTIVATED_SOURCE_TYPES = new Set<CardDef["type"]>([
  "Unit",
  "Enchantment",
  "Artifact",
  "Sentinela",
]);

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
  if (supplied.length > 4) return { ok: false, error: "A card may define at most 4 generic activated abilities" };

  const abilities: ActivatedAbility[] = [];
  for (const [index, rawAbility] of supplied.entries()) {
    if (!rawAbility || typeof rawAbility !== "object" || Array.isArray(rawAbility)) {
      return { ok: false, error: `Activated ability ${index + 1} must be an object` };
    }
    const input = rawAbility as unknown as Record<string, unknown>;
    const description = typeof input.description === "string" ? input.description.trim().slice(0, 200) : "";
    if (!description) return { ok: false, error: `Activated ability ${index + 1} requires a description` };

    const effectResult = sanitizeEffect(input.effect, base.card.region);
    if (!effectResult.ok) return { ok: false, error: `Activated ability ${index + 1}: ${effectResult.error}` };
    if (effectResult.effect.target === "spellOnStack") {
      return { ok: false, error: "Activated abilities targeting the spell stack are disabled until the authoritative reaction protocol supports them" };
    }
    if (effectResult.effect.target === "self" && base.card.type !== "Unit") {
      return { ok: false, error: "Generic self-target activated effects currently require a Unit source" };
    }

    const costResult = sanitizeCost(input.cost, base.card.type);
    if (!costResult.ok) return { ok: false, error: `Activated ability ${index + 1}: ${costResult.error}` };
    if (costResult.cost?.sacrificeSelf && effectResult.effect.target === "self") {
      return { ok: false, error: "A sacrificed source cannot also be the activated effect's self target" };
    }

    let maxUsesPerRound: number | null | undefined;
    if (input.maxUsesPerRound === null) {
      maxUsesPerRound = null;
    } else if (input.maxUsesPerRound !== undefined) {
      const value = finiteInteger(input.maxUsesPerRound, 1, 10);
      if (value === null) return { ok: false, error: "maxUsesPerRound must be null or an integer from 1 to 10" };
      maxUsesPerRound = value;
    }

    abilities.push({
      description,
      effect: effectResult.effect,
      ...(costResult.cost ? { cost: costResult.cost } : {}),
      ...(maxUsesPerRound !== undefined ? { maxUsesPerRound } : {}),
    });
  }

  return { ok: true, card: { ...base.card, activatedAbilities: abilities } };
}
