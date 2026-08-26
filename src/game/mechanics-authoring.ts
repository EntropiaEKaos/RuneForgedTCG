import type { CardDef, CardEffect, CardMechanic, CardType, MechanicCondition, TriggerWhen } from "./types";
import { CARD_TRIGGERS, CARD_TYPES, sanitizeCardEffect, sanitizeMechanicCondition } from "./card-authoring";

export type KeywordBehaviorDefinition = {
  version: 1;
  trigger: TriggerWhen;
  condition: MechanicCondition;
  effect: CardEffect;
};

export type CompositeEffectDefinition = {
  version: 1;
  effect: CardEffect;
};

export type CardArchetypeDefinition = {
  version: 1;
  baseType: CardType;
  zone: "unit" | "stack" | "permanent" | "equipment" | "sentinela";
  defaults?: {
    collectible?: boolean;
    maxHealth?: number;
    speed?: "Fast" | "Burst";
  };
  capabilities: {
    attacks: boolean;
    blocks: boolean;
    targeted: boolean;
    persistent: boolean;
  };
};

const zones: Record<CardType, CardArchetypeDefinition["zone"]> = {
  Unit: "unit",
  Spell: "stack",
  Enchantment: "permanent",
  Artifact: "permanent",
  Equipment: "equipment",
  Sentinela: "sentinela",
};

const capabilities: Record<CardType, CardArchetypeDefinition["capabilities"]> = {
  Unit: { attacks: true, blocks: true, targeted: true, persistent: true },
  Spell: { attacks: false, blocks: false, targeted: false, persistent: false },
  Enchantment: { attacks: false, blocks: false, targeted: true, persistent: true },
  Artifact: { attacks: false, blocks: false, targeted: true, persistent: true },
  Equipment: { attacks: false, blocks: false, targeted: false, persistent: true },
  Sentinela: { attacks: false, blocks: false, targeted: true, persistent: true },
};

const keyOk = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9][a-z0-9_-]{1,63}$/.test(value);

export function sanitizeKeywordBehavior(raw: unknown): KeywordBehaviorDefinition | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.version !== undefined && Number(value.version) !== 1) return null;
  const trigger = String(value.trigger || "") as TriggerWhen;
  if (!(CARD_TRIGGERS as readonly string[]).includes(trigger)) return null;
  const condition = sanitizeMechanicCondition(value.condition ?? { kind: "always" });
  const effect = sanitizeCardEffect(value.effect);
  if (!condition || !effect) return null;
  return { version: 1, trigger, condition, effect };
}

export function sanitizeCompositeEffectDefinition(raw: unknown): CompositeEffectDefinition | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const effect = sanitizeCardEffect(value.effect ?? value.composition);
  if (!effect) return null;
  return { version: 1, effect };
}

export function sanitizeArchetypeDefinition(raw: unknown, baseTypeInput?: unknown): CardArchetypeDefinition | null {
  if (!raw || typeof raw !== "object") raw = {};
  const value = raw as Record<string, unknown>;
  const baseType = String(baseTypeInput || value.baseType || "") as CardType;
  if (!(CARD_TYPES as readonly string[]).includes(baseType)) return null;
  const defaultsRaw = value.defaults && typeof value.defaults === "object" ? value.defaults as Record<string, unknown> : {};
  const defaults: CardArchetypeDefinition["defaults"] = {};
  if (typeof defaultsRaw.collectible === "boolean") defaults.collectible = defaultsRaw.collectible;
  if (defaultsRaw.maxHealth !== undefined) {
    const n = Number(defaultsRaw.maxHealth);
    if (!Number.isFinite(n) || n < 1 || n > 99) return null;
    defaults.maxHealth = Math.trunc(n);
  }
  if (defaultsRaw.speed === "Fast" || defaultsRaw.speed === "Burst") defaults.speed = defaultsRaw.speed;
  return { version: 1, baseType, zone: zones[baseType], defaults, capabilities: capabilities[baseType] };
}

export function mechanicFromKeyword(key: string, name: string, behavior: unknown): CardMechanic | null {
  if (!keyOk(key)) return null;
  const parsed = sanitizeKeywordBehavior(behavior);
  if (!parsed) return null;
  return { key, name: String(name || key).slice(0, 80), trigger: parsed.trigger, condition: parsed.condition, effect: parsed.effect };
}

export function applyArchetype(card: CardDef, key: string, name: string, definition: unknown, baseType?: unknown): CardDef | null {
  if (!keyOk(key)) return null;
  const parsed = sanitizeArchetypeDefinition(definition, baseType);
  if (!parsed) return null;
  const next: CardDef = { ...card, type: parsed.baseType, archetypeKey: key, archetypeName: String(name || key).slice(0, 80) };
  if (parsed.defaults?.collectible !== undefined) next.collectible = parsed.defaults.collectible;
  if (parsed.defaults?.maxHealth !== undefined) next.maxHealth = parsed.defaults.maxHealth;
  if (parsed.defaults?.speed !== undefined) next.speed = parsed.defaults.speed;
  return next;
}
