import type { ActivatedAbility, ActivatedAbilityCost } from "./activated-ability-types";
import {
  CARD_EFFECT_KINDS,
  CARD_KEYWORDS,
  CARD_TARGETS,
  CARD_TRIGGERS,
  MECHANIC_CONDITION_KINDS,
} from "./card-authoring";
import type {
  CardDef,
  CardEffect,
  CardMechanic,
  Keyword,
  LevelUpDef,
  MechanicCondition,
  SentinelaAbility,
  TargetKind,
  TriggerWhen,
} from "./types";

/**
 * Ability System 2.0 is a compatibility grammar, not a new execution engine.
 * It gives authoring, Studio and future runtime work one vocabulary while the
 * existing 2.97 execution paths remain authoritative and replay-compatible.
 */
export const ABILITY_GRAMMAR_VERSION = 2 as const;

export type AbilityKind =
  | "keyword"
  | "static"
  | "triggered"
  | "activated"
  | "reaction"
  | "replacement"
  | "delayed"
  | "modal"
  | "transformation"
  | "aura"
  | "linked";

export type AbilityFeature =
  | "conditional"
  | "chained"
  | "repeatable"
  | "targeted";

export type AbilityTiming =
  | "static"
  | "automatic"
  | "mainPhase"
  | "combat"
  | "reaction"
  | "priority";

export type AbilityRuntimeSupport = "supported" | "partial" | "planned";

export type AbilityOrigin =
  | "keyword"
  | "legacyTrigger"
  | "mechanic"
  | "activated"
  | "sentinela"
  | "levelUp";

export type AbilityCostKind =
  | "mana"
  | "nexusHealth"
  | "exhaustSelf"
  | "sacrificeSelf"
  | "loyalty";

export type AbilityCostNode =
  | { kind: "mana"; amount: number }
  | { kind: "nexusHealth"; amount: number }
  | { kind: "exhaustSelf" }
  | { kind: "sacrificeSelf" }
  | { kind: "loyalty"; delta: number };

export interface AbilityBlueprint {
  version: typeof ABILITY_GRAMMAR_VERSION;
  origin: AbilityOrigin;
  kind: AbilityKind;
  features: AbilityFeature[];
  timing: AbilityTiming;
  description?: string;
  keyword?: Keyword;
  trigger?: TriggerWhen;
  condition: MechanicCondition;
  costs: AbilityCostNode[];
  target?: TargetKind;
  effect?: CardEffect;
  maxUsesPerRound?: number | null;
  progression?: LevelUpDef;
}

const ALWAYS: MechanicCondition = { kind: "always" };

export const ABILITY_KINDS = [
  "keyword",
  "static",
  "triggered",
  "activated",
  "reaction",
  "replacement",
  "delayed",
  "modal",
  "transformation",
  "aura",
  "linked",
] as const satisfies readonly AbilityKind[];

export const ABILITY_FEATURES = [
  "conditional",
  "chained",
  "repeatable",
  "targeted",
] as const satisfies readonly AbilityFeature[];

export const ABILITY_TIMINGS = [
  "static",
  "automatic",
  "mainPhase",
  "combat",
  "reaction",
  "priority",
] as const satisfies readonly AbilityTiming[];

export const ABILITY_COST_KINDS = [
  "mana",
  "nexusHealth",
  "exhaustSelf",
  "sacrificeSelf",
  "loyalty",
] as const satisfies readonly AbilityCostKind[];

/**
 * Explicit capability matrix. "Partial" means RuneForge has a concrete
 * mechanic in this family, but not yet the generic authoring/runtime contract
 * required to expose the whole family safely in Studio.
 */
export const ABILITY_KIND_SUPPORT = {
  keyword: "supported",
  static: "partial",
  triggered: "supported",
  activated: "supported",
  reaction: "partial",
  replacement: "planned",
  delayed: "planned",
  modal: "planned",
  transformation: "supported",
  aura: "partial",
  linked: "partial",
} as const satisfies Record<AbilityKind, AbilityRuntimeSupport>;

export const ABILITY_TIMING_SUPPORT = {
  static: "supported",
  automatic: "supported",
  mainPhase: "supported",
  combat: "partial",
  reaction: "partial",
  priority: "planned",
} as const satisfies Record<AbilityTiming, AbilityRuntimeSupport>;

export const ABILITY_GRAMMAR_CATALOG = {
  version: ABILITY_GRAMMAR_VERSION,
  kinds: ABILITY_KINDS,
  features: ABILITY_FEATURES,
  timings: ABILITY_TIMINGS,
  costs: ABILITY_COST_KINDS,
  kindSupport: ABILITY_KIND_SUPPORT,
  timingSupport: ABILITY_TIMING_SUPPORT,
  effects: CARD_EFFECT_KINDS,
  targets: CARD_TARGETS,
  triggers: CARD_TRIGGERS,
  conditions: MECHANIC_CONDITION_KINDS,
  keywords: CARD_KEYWORDS,
} as const;

function effectFeatures(effect: CardEffect | undefined): AbilityFeature[] {
  if (!effect) return [];
  const features: AbilityFeature[] = [];
  if (effect.target !== "none" && effect.target !== "self") features.push("targeted");
  if (effect.also) features.push("chained");
  return features;
}

function conditionFeatures(condition: MechanicCondition): AbilityFeature[] {
  return condition.kind === "always" ? [] : ["conditional"];
}

function uniqueFeatures(...groups: AbilityFeature[][]): AbilityFeature[] {
  return [...new Set(groups.flat())];
}

export function abilityCostsFromActivatedCost(cost: ActivatedAbilityCost | undefined): AbilityCostNode[] {
  if (!cost) return [];
  const nodes: AbilityCostNode[] = [];
  if ((cost.mana ?? 0) > 0) nodes.push({ kind: "mana", amount: cost.mana! });
  if ((cost.nexusHealth ?? 0) > 0) nodes.push({ kind: "nexusHealth", amount: cost.nexusHealth! });
  if (cost.exhaustSelf) nodes.push({ kind: "exhaustSelf" });
  if (cost.sacrificeSelf) nodes.push({ kind: "sacrificeSelf" });
  if (cost.loyaltyDelta !== undefined) nodes.push({ kind: "loyalty", delta: cost.loyaltyDelta });
  return nodes;
}

export function blueprintFromActivatedAbility(ability: ActivatedAbility): AbilityBlueprint {
  const repeatable = ability.maxUsesPerRound === null || (ability.maxUsesPerRound ?? 1) > 1;
  return {
    version: ABILITY_GRAMMAR_VERSION,
    origin: "activated",
    kind: "activated",
    features: uniqueFeatures(effectFeatures(ability.effect), repeatable ? ["repeatable"] : []),
    timing: "mainPhase",
    description: ability.description,
    condition: ALWAYS,
    costs: abilityCostsFromActivatedCost(ability.cost),
    target: ability.effect.target,
    effect: ability.effect,
    ...(ability.maxUsesPerRound !== undefined ? { maxUsesPerRound: ability.maxUsesPerRound } : {}),
  };
}

export function blueprintFromMechanic(mechanic: CardMechanic): AbilityBlueprint {
  const condition = mechanic.condition ?? ALWAYS;
  return {
    version: ABILITY_GRAMMAR_VERSION,
    origin: "mechanic",
    kind: "triggered",
    features: uniqueFeatures(conditionFeatures(condition), effectFeatures(mechanic.effect)),
    timing: "automatic",
    description: mechanic.name,
    trigger: mechanic.trigger,
    condition,
    costs: [],
    target: mechanic.effect.target,
    effect: mechanic.effect,
  };
}

export function blueprintFromLegacyTrigger(trigger: NonNullable<CardDef["trigger"]>): AbilityBlueprint {
  return {
    version: ABILITY_GRAMMAR_VERSION,
    origin: "legacyTrigger",
    kind: "triggered",
    features: effectFeatures(trigger.effect),
    timing: "automatic",
    trigger: trigger.when,
    condition: ALWAYS,
    costs: [],
    target: trigger.effect.target,
    effect: trigger.effect,
  };
}

export function blueprintFromSentinelaAbility(ability: SentinelaAbility): AbilityBlueprint {
  return {
    version: ABILITY_GRAMMAR_VERSION,
    origin: "sentinela",
    kind: "activated",
    features: effectFeatures(ability.effect),
    timing: "mainPhase",
    description: ability.description,
    condition: ALWAYS,
    costs: [{ kind: "loyalty", delta: ability.cost }],
    target: ability.effect.target,
    effect: ability.effect,
    maxUsesPerRound: 1,
  };
}

export function blueprintFromLevelUp(levelUp: LevelUpDef): AbilityBlueprint {
  return {
    version: ABILITY_GRAMMAR_VERSION,
    origin: "levelUp",
    kind: "transformation",
    features: ["conditional"],
    timing: "automatic",
    description: levelUp.hint,
    condition: ALWAYS,
    costs: [],
    progression: levelUp,
  };
}

export function blueprintFromKeyword(keyword: Keyword): AbilityBlueprint {
  return {
    version: ABILITY_GRAMMAR_VERSION,
    origin: "keyword",
    kind: "keyword",
    features: [],
    timing: "static",
    keyword,
    condition: ALWAYS,
    costs: [],
  };
}

/**
 * Read-only compatibility projection used by audits, Studio previews and
 * migration work. It never mutates CardDef and therefore cannot change current
 * authoritative gameplay or serialized replay behavior.
 */
export function abilityBlueprintsForCard(card: CardDef): AbilityBlueprint[] {
  const blueprints: AbilityBlueprint[] = [];
  for (const keyword of card.keywords ?? []) blueprints.push(blueprintFromKeyword(keyword));
  if (card.trigger) blueprints.push(blueprintFromLegacyTrigger(card.trigger));
  for (const mechanic of card.mechanics ?? []) blueprints.push(blueprintFromMechanic(mechanic));
  for (const ability of card.activatedAbilities ?? []) blueprints.push(blueprintFromActivatedAbility(ability));
  for (const ability of card.sentinela?.abilities ?? []) blueprints.push(blueprintFromSentinelaAbility(ability));
  if (card.levelUp) blueprints.push(blueprintFromLevelUp(card.levelUp));
  return blueprints;
}
