import "./aura-2-types";
import type { ActivatedAbility, ActivatedAbilityCost } from "./activated-ability-types";
import { CONDITIONAL_AURA_CONTRACT } from "./aura-condition-contract";
import {
  CARD_EFFECT_KINDS,
  CARD_KEYWORDS,
  CARD_TARGETS,
  CARD_TRIGGERS,
  COST_REDUCTION_CONTRACTS,
  COST_REDUCTION_KINDS,
  MECHANIC_CONDITION_KINDS,
} from "./card-authoring";
import { CONDITION_AUTHORING_CONTRACT, CONDITION_RUNTIME_SUPPORT } from "./condition-contract";
import { KEYWORD_INFO, type KeywordRuntimeDomain } from "./keywords";
import {
  PERMANENT_ENEMY_STAT_AURA_CONTRACT,
  PERMANENT_KEYWORD_AURA_CONTRACT,
  PERMANENT_KEYWORD_SUPPRESSION_AURA_CONTRACT,
  PERMANENT_STAT_AURA_CONTRACT,
  SENTINELA_SOURCE_AURA_CONTRACT,
  UNIT_SOURCE_AURA_CONTRACT,
} from "./permanent-aura-contract";
import { TRIGGER_TIMING_BY_EVENT, triggerTiming } from "./trigger-contract";
import type {
  CardDef,
  CardEffect,
  CardMechanic,
  CostReduction,
  EquipmentEffect,
  Keyword,
  LevelUpDef,
  MechanicCondition,
  PermanentStatAura,
  SentinelaAbility,
  TargetKind,
  TriggerWhen,
} from "./types";

/**
 * Ability System 2.0 is a compatibility grammar, not a new execution engine.
 * It gives authoring, Studio and runtime work one vocabulary while the
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
  | "costReduction"
  | "equipment"
  | "aura"
  | "legacyTrigger"
  | "mechanic"
  | "spell"
  | "activated"
  | "sentinela"
  | "levelUp";

export type AbilityCostKind =
  | "mana"
  | "spellMana"
  | "nexusHealth"
  | "discardFromHand"
  | "exhaustSelf"
  | "consumeBarrier"
  | "sacrificeSelf"
  | "loyalty";

export type AbilityCostNode =
  | { kind: "mana"; amount: number }
  | { kind: "spellMana"; amount: number }
  | { kind: "nexusHealth"; amount: number }
  | { kind: "discardFromHand"; amount: number; selection: "explicitInstanceIds" }
  | { kind: "exhaustSelf" }
  | { kind: "consumeBarrier" }
  | { kind: "sacrificeSelf" }
  | { kind: "loyalty"; delta: number };

/**
 * Persistent/static rules are not CardEffects: they are continuously consumed
 * by authoritative engine paths such as effectiveCost(), Equipment stat
 * recomputation and source-bound Aura derivation.
 */
export type AbilityRuleKind = "costReduction" | "equipmentAttachment" | "permanentStatAura";

export type AbilityRule =
  | { kind: "costReduction"; costReduction: CostReduction }
  | { kind: "equipmentAttachment"; equipment: EquipmentEffect }
  | { kind: "permanentStatAura"; aura: PermanentStatAura };

/** Read-only semantic mirror of the authoritative keyword runtime contract. */
export interface KeywordAbilityContract {
  support: "supported";
  runtimeDomains: KeywordRuntimeDomain[];
  grantable: boolean;
  requiresTrigger?: TriggerWhen;
}

export interface AbilityModeBlueprint {
  id: string;
  description: string;
  target: TargetKind;
  effect: CardEffect;
}

export interface AbilityBlueprint {
  version: typeof ABILITY_GRAMMAR_VERSION;
  origin: AbilityOrigin;
  kind: AbilityKind;
  features: AbilityFeature[];
  timing: AbilityTiming;
  description?: string;
  keyword?: Keyword;
  keywordContract?: KeywordAbilityContract;
  trigger?: TriggerWhen;
  condition: MechanicCondition;
  costs: AbilityCostNode[];
  target?: TargetKind;
  effect?: CardEffect;
  modes?: AbilityModeBlueprint[];
  rule?: AbilityRule;
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
  "spellMana",
  "nexusHealth",
  "discardFromHand",
  "exhaustSelf",
  "consumeBarrier",
  "sacrificeSelf",
  "loyalty",
] as const satisfies readonly AbilityCostKind[];

export const ABILITY_RULE_KINDS = [
  "costReduction",
  "equipmentAttachment",
  "permanentStatAura",
] as const satisfies readonly AbilityRuleKind[];

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
  reaction: "supported",
  replacement: "planned",
  delayed: "planned",
  modal: "partial",
  transformation: "supported",
  aura: "partial",
  linked: "partial",
} as const satisfies Record<AbilityKind, AbilityRuntimeSupport>;

export const ABILITY_FEATURE_SUPPORT = {
  conditional: "supported",
  chained: "supported",
  repeatable: "supported",
  targeted: "supported",
} as const satisfies Record<AbilityFeature, AbilityRuntimeSupport>;

export const ABILITY_TIMING_SUPPORT = {
  static: "supported",
  automatic: "supported",
  mainPhase: "supported",
  combat: "partial",
  reaction: "supported",
  priority: "planned",
} as const satisfies Record<AbilityTiming, AbilityRuntimeSupport>;

export const ABILITY_GRAMMAR_CATALOG = {
  version: ABILITY_GRAMMAR_VERSION,
  kinds: ABILITY_KINDS,
  features: ABILITY_FEATURES,
  timings: ABILITY_TIMINGS,
  costs: ABILITY_COST_KINDS,
  rules: ABILITY_RULE_KINDS,
  kindSupport: ABILITY_KIND_SUPPORT,
  featureSupport: ABILITY_FEATURE_SUPPORT,
  timingSupport: ABILITY_TIMING_SUPPORT,
  effects: CARD_EFFECT_KINDS,
  targets: CARD_TARGETS,
  triggers: CARD_TRIGGERS,
  triggerTiming: TRIGGER_TIMING_BY_EVENT,
  conditions: MECHANIC_CONDITION_KINDS,
  conditionContracts: CONDITION_RUNTIME_SUPPORT,
  conditionAuthoring: CONDITION_AUTHORING_CONTRACT,
  costReductionKinds: COST_REDUCTION_KINDS,
  costReductionContracts: COST_REDUCTION_CONTRACTS,
  permanentStatAuraContract: PERMANENT_STAT_AURA_CONTRACT,
  permanentEnemyStatAuraContract: PERMANENT_ENEMY_STAT_AURA_CONTRACT,
  permanentKeywordAuraContract: PERMANENT_KEYWORD_AURA_CONTRACT,
  permanentKeywordSuppressionAuraContract: PERMANENT_KEYWORD_SUPPRESSION_AURA_CONTRACT,
  unitSourceAuraContract: UNIT_SOURCE_AURA_CONTRACT,
  sentinelaSourceAuraContract: SENTINELA_SOURCE_AURA_CONTRACT,
  conditionalAuraContract: CONDITIONAL_AURA_CONTRACT,
  keywords: CARD_KEYWORDS,
  keywordContracts: KEYWORD_INFO,
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
  if ((cost.spellMana ?? 0) > 0) nodes.push({ kind: "spellMana", amount: cost.spellMana! });
  if ((cost.nexusHealth ?? 0) > 0) nodes.push({ kind: "nexusHealth", amount: cost.nexusHealth! });
  if ((cost.discardFromHand ?? 0) > 0) nodes.push({ kind: "discardFromHand", amount: cost.discardFromHand!, selection: "explicitInstanceIds" });
  if (cost.exhaustSelf) nodes.push({ kind: "exhaustSelf" });
  if (cost.consumeBarrier) nodes.push({ kind: "consumeBarrier" });
  if (cost.sacrificeSelf) nodes.push({ kind: "sacrificeSelf" });
  if (cost.loyaltyDelta !== undefined) nodes.push({ kind: "loyalty", delta: cost.loyaltyDelta });
  return nodes;
}

export function blueprintFromActivatedAbility(ability: ActivatedAbility): AbilityBlueprint {
  const repeatable = ability.maxUsesPerRound === null || (ability.maxUsesPerRound ?? 1) > 1;
  const common = {
    version: ABILITY_GRAMMAR_VERSION,
    origin: "activated" as const,
    timing: "mainPhase" as const,
    description: ability.description,
    condition: ALWAYS,
    costs: abilityCostsFromActivatedCost(ability.cost),
    ...(ability.maxUsesPerRound !== undefined ? { maxUsesPerRound: ability.maxUsesPerRound } : {}),
  };

  if (ability.modes !== undefined) {
    const modes = ability.modes.map((mode) => ({
      id: mode.id,
      description: mode.description,
      target: mode.effect.target,
      effect: mode.effect,
    }));
    return {
      ...common,
      kind: "modal",
      features: uniqueFeatures(
        ...modes.map((mode) => effectFeatures(mode.effect)),
        repeatable ? ["repeatable"] : [],
      ),
      modes,
    };
  }

  return {
    ...common,
    kind: "activated",
    features: uniqueFeatures(effectFeatures(ability.effect), repeatable ? ["repeatable"] : []),
    ...(ability.effect ? { target: ability.effect.target, effect: ability.effect } : {}),
  };
}

export function blueprintFromMechanic(mechanic: CardMechanic): AbilityBlueprint {
  const condition = mechanic.condition ?? ALWAYS;
  return {
    version: ABILITY_GRAMMAR_VERSION,
    origin: "mechanic",
    kind: "triggered",
    features: uniqueFeatures(conditionFeatures(condition), effectFeatures(mechanic.effect)),
    timing: triggerTiming(mechanic.trigger),
    description: mechanic.name,
    trigger: mechanic.trigger,
    condition,
    costs: [],
    target: mechanic.effect.target,
    effect: mechanic.effect,
  };
}

export function blueprintFromCostReduction(costReduction: CostReduction): AbilityBlueprint {
  return {
    version: ABILITY_GRAMMAR_VERSION,
    origin: "costReduction",
    kind: "static",
    features: ["conditional"],
    timing: "static",
    condition: ALWAYS,
    costs: [],
    rule: {
      kind: "costReduction",
      costReduction: { ...costReduction },
    },
  };
}

/**
 * Equipment is the concrete linked/persistent contract that exists today.
 * Attaching is handled by authoritative card-play code; once linked, stat and
 * keyword grants are recomputed from the attached Equipment CardDef.
 */
export function blueprintFromEquipment(card: CardDef): AbilityBlueprint | null {
  if (card.type !== "Equipment" || !card.equipment) return null;
  return {
    version: ABILITY_GRAMMAR_VERSION,
    origin: "equipment",
    kind: "linked",
    features: ["targeted"],
    timing: "static",
    description: card.description,
    condition: ALWAYS,
    costs: [],
    target: "allyUnit",
    rule: {
      kind: "equipmentAttachment",
      equipment: {
        buffPower: card.equipment.buffPower,
        buffHealth: card.equipment.buffHealth,
        keywords: [...(card.equipment.keywords ?? [])],
      },
    },
  };
}

/** Project the supported stat, grant, suppression and source-condition slices of any certified Aura. */
export function blueprintFromPermanentStatAura(card: CardDef): AbilityBlueprint | null {
  if ((card.type !== "Unit" && card.type !== "Sentinela" && card.type !== "Enchantment" && card.type !== "Artifact") || !card.aura) return null;
  const filtered = Boolean(card.aura.races?.length || card.aura.classes?.length);
  const enemyAura = card.aura.affects === "enemies";
  const condition = card.aura.condition ? structuredClone(card.aura.condition) : ALWAYS;
  return {
    version: ABILITY_GRAMMAR_VERSION,
    origin: "aura",
    kind: "aura",
    features: filtered || condition.kind !== "always" ? ["conditional"] : [],
    timing: "static",
    description: card.description,
    condition,
    costs: [],
    target: enemyAura ? "enemyUnit" : "allyUnit",
    rule: {
      kind: "permanentStatAura",
      aura: {
        buffPower: card.aura.buffPower,
        buffHealth: card.aura.buffHealth,
        ...(enemyAura ? { affects: "enemies" as const } : {}),
        ...(card.aura.keywords?.length ? { keywords: [...card.aura.keywords] } : {}),
        ...(card.aura.suppressKeywords?.length ? { suppressKeywords: [...card.aura.suppressKeywords] } : {}),
        ...(card.aura.races?.length ? { races: [...card.aura.races] } : {}),
        ...(card.aura.classes?.length ? { classes: [...card.aura.classes] } : {}),
        ...(card.aura.condition ? { condition: structuredClone(card.aura.condition) } : {}),
      },
    },
  };
}

export function blueprintFromLegacyTrigger(trigger: NonNullable<CardDef["trigger"]>): AbilityBlueprint {
  return {
    version: ABILITY_GRAMMAR_VERSION,
    origin: "legacyTrigger",
    kind: "triggered",
    features: effectFeatures(trigger.effect),
    timing: triggerTiming(trigger.when),
    trigger: trigger.when,
    condition: ALWAYS,
    costs: [],
    target: trigger.effect.target,
    effect: trigger.effect,
  };
}

/**
 * Fast/Burst spell rules are the current authorable reaction surface. Their
 * actual eligibility is enforced by reaction-contract.ts at runtime; this
 * adapter makes the same surface visible to Ability Grammar 2.0 and Studio.
 */
export function blueprintFromReactionSpell(card: CardDef): AbilityBlueprint | null {
  if (card.type !== "Spell" || !card.speed || !card.spell) return null;
  return {
    version: ABILITY_GRAMMAR_VERSION,
    origin: "spell",
    kind: "reaction",
    features: effectFeatures(card.spell),
    timing: "reaction",
    description: card.description,
    condition: ALWAYS,
    costs: card.cost > 0 ? [{ kind: "mana", amount: card.cost }] : [],
    target: card.spell.target,
    effect: card.spell,
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
  const contract = KEYWORD_INFO[keyword];
  return {
    version: ABILITY_GRAMMAR_VERSION,
    origin: "keyword",
    kind: "keyword",
    features: [],
    timing: "static",
    description: contract.desc,
    keyword,
    keywordContract: {
      support: contract.support,
      runtimeDomains: [...contract.runtimeDomains],
      grantable: contract.grantable,
      ...(contract.requiresTrigger ? { requiresTrigger: contract.requiresTrigger } : {}),
    },
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
  if (card.costReduction) blueprints.push(blueprintFromCostReduction(card.costReduction));
  const equipment = blueprintFromEquipment(card);
  if (equipment) blueprints.push(equipment);
  const aura = blueprintFromPermanentStatAura(card);
  if (aura) blueprints.push(aura);
  if (card.trigger) blueprints.push(blueprintFromLegacyTrigger(card.trigger));
  for (const mechanic of card.mechanics ?? []) blueprints.push(blueprintFromMechanic(mechanic));
  const reaction = blueprintFromReactionSpell(card);
  if (reaction) blueprints.push(reaction);
  for (const ability of card.activatedAbilities ?? []) blueprints.push(blueprintFromActivatedAbility(ability));
  for (const ability of card.sentinela?.abilities ?? []) blueprints.push(blueprintFromSentinelaAbility(ability));
  if (card.levelUp) blueprints.push(blueprintFromLevelUp(card.levelUp));
  return blueprints;
}
