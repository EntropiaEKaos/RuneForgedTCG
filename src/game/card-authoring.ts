import type {
  CardDef,
  CardEffect,
  CardType,
  CardMechanic,
  MechanicCondition,
  CostReduction,
  EffectKind,
  Keyword,
  LevelUpType,
  PermanentStatAura,
  Race,
  Rarity,
  Region,
  TargetKind,
  TriggerWhen,
  StrategicRole,
  RegionalPerk,
} from "./types";
import type { ActivatedAbility, ActivatedAbilityCost } from "./activated-ability-types";
import { CANONICAL_KEYWORDS, keywordCardContractError, keywordIsGrantable } from "./keywords";
import { isTriggerSupported, triggerContractError } from "./trigger-contract";
import { EFFECT_CHAIN_MAX_SUPPORTED_DEPTH } from "./effect-chain-contract";

/**
 * Canonical authoring catalog. Keep every closed engine vocabulary here so UI,
 * APIs and validation cannot drift apart. `satisfies` makes TypeScript fail when
 * a value is not part of the engine contract.
 */
export const CARD_REGIONS = ["Emberhold", "Tidecall", "Ironwood", "Voidborn", "Florestia", "Tempestade"] as const satisfies readonly Region[];
export const CARD_TYPES = ["Unit", "Spell", "Enchantment", "Artifact", "Equipment", "Sentinela"] as const satisfies readonly CardType[];
export const CARD_RARITIES = ["Common", "Rare", "Epic", "Legend"] as const satisfies readonly Rarity[];
export const CARD_RACES = ["Dragon", "Sprite", "Beast", "Voidling", "Warrior", "Elemental", "Spirit", "Besta", "Tempesteiro", "Anjo"] as const satisfies readonly Race[];
export const CARD_KEYWORDS = CANONICAL_KEYWORDS;
export const CARD_EFFECT_KINDS = [
  "damageUnit", "damageNexus", "healUnit", "healNexus", "buffUnit", "buffSelf",
  "buffAllies", "buffRace", "buffClass", "aoeEnemy", "draw", "grantBarrier", "grantKeyword",
  "summonToken", "attachEquipment", "manaRefund", "drawOnSummon", "destroyPermanent",
  "damagePermanent", "negateSpell", "frostbite", "stun", "recall", "killUnit", "poison", "mill", "selfMill",
  "returnGraveyardToHand", "reanimateUnit", "banishGraveyardCard",
] as const satisfies readonly EffectKind[];
export const CARD_TARGETS = [
  "enemyUnit", "allyUnit", "anyUnit", "enemyPermanent", "allyPermanent", "anyPermanent",
  "self", "none", "spellOnStack", "anyBoard", "enemySentinela", "allySentinela", "anySentinela",
  "allyGraveyardCard", "enemyGraveyardCard", "anyGraveyardCard", "allyGraveyardUnit",
] as const satisfies readonly TargetKind[];
export interface CardEffectContract {
  targets: readonly TargetKind[];
  amount: "any" | "nonNegative" | "positive";
  requires?: readonly ("keyword" | "tokenDefId" | "equipmentDefId" | "race" | "classKey" | "buff")[];
}

const UNIT_TARGETS = ["enemyUnit", "allyUnit", "anyUnit", "self"] as const satisfies readonly TargetKind[];
const PERMANENT_TARGETS = ["enemyPermanent", "allyPermanent", "anyPermanent"] as const satisfies readonly TargetKind[];
const GRAVEYARD_TARGETS = ["allyGraveyardCard", "enemyGraveyardCard", "anyGraveyardCard", "allyGraveyardUnit"] as const satisfies readonly TargetKind[];

/**
 * Canonical semantic contract shared by authoring validation and Studio UI.
 * This rejects combinations that are syntactically valid but cannot execute
 * meaningfully in the engine.
 */
export const CARD_EFFECT_CONTRACTS = {
  damageUnit: { targets: [...UNIT_TARGETS, "enemyPermanent", "allyPermanent", "anyPermanent", "enemySentinela", "allySentinela", "anySentinela", "anyBoard"], amount: "nonNegative" },
  damageNexus: { targets: ["none"], amount: "nonNegative" },
  healUnit: { targets: UNIT_TARGETS, amount: "nonNegative" },
  healNexus: { targets: ["none"], amount: "nonNegative" },
  buffUnit: { targets: UNIT_TARGETS, amount: "any", requires: ["buff"] },
  buffSelf: { targets: ["self"], amount: "any", requires: ["buff"] },
  buffAllies: { targets: ["none"], amount: "any", requires: ["buff"] },
  buffRace: { targets: ["none"], amount: "any", requires: ["buff", "race"] },
  buffClass: { targets: ["none"], amount: "any", requires: ["buff", "classKey"] },
  aoeEnemy: { targets: ["none"], amount: "nonNegative" },
  draw: { targets: ["none"], amount: "nonNegative" },
  grantBarrier: { targets: [...UNIT_TARGETS, "none"], amount: "any" },
  grantKeyword: { targets: [...UNIT_TARGETS, "none"], amount: "any", requires: ["keyword"] },
  summonToken: { targets: ["none"], amount: "any", requires: ["tokenDefId"] },
  attachEquipment: { targets: ["allyUnit", "anyUnit", "none"], amount: "any", requires: ["equipmentDefId"] },
  manaRefund: { targets: ["none"], amount: "nonNegative" },
  drawOnSummon: { targets: ["none"], amount: "nonNegative" },
  destroyPermanent: { targets: PERMANENT_TARGETS, amount: "any" },
  damagePermanent: { targets: PERMANENT_TARGETS, amount: "nonNegative" },
  negateSpell: { targets: ["spellOnStack"], amount: "any" },
  frostbite: { targets: [...UNIT_TARGETS, "none"], amount: "any" },
  stun: { targets: UNIT_TARGETS, amount: "any" },
  recall: { targets: UNIT_TARGETS, amount: "any" },
  killUnit: { targets: UNIT_TARGETS, amount: "any" },
  poison: { targets: ["none"], amount: "positive" },
  mill: { targets: ["none"], amount: "positive" },
  selfMill: { targets: ["none"], amount: "positive" },
  returnGraveyardToHand: { targets: ["allyGraveyardCard"], amount: "any" },
  reanimateUnit: { targets: ["allyGraveyardUnit"], amount: "any" },
  banishGraveyardCard: { targets: ["allyGraveyardCard", "enemyGraveyardCard", "anyGraveyardCard"], amount: "any" },
} as const satisfies Record<EffectKind, CardEffectContract>;

export const CARD_TRIGGERS = [
  "onSummon", "onStrike", "onNexusStrike", "onRoundStart", "onLevelUp", "onKill",
  "onPermanentSummon", "onAttack", "onBlock", "onAllyDeath", "onDeath",
] as const satisfies readonly TriggerWhen[];
export const CARD_LEVEL_UP_TYPES = ["nexusDamage", "spellsCast", "alliesSummoned", "nexusStrikes"] as const satisfies readonly LevelUpType[];
export const CARD_STRATEGIC_ROLES = ["finisher", "removal", "defense", "tempo", "engine", "utility"] as const satisfies readonly StrategicRole[];
export const CARD_REGIONAL_PERKS = ["convergence", "assault", "bulwark"] as const satisfies readonly RegionalPerk[];
export const CARD_DOCTRINES = [
  { id: "ember_aggro", name: "Fúria da Forja", region: "Emberhold", icon: "🔥" },
  { id: "tide_control", name: "Maré Inevitável", region: "Tidecall", icon: "🌊" },
  { id: "wood_midrange", name: "Coração Ancestral", region: "Ironwood", icon: "🌿" },
  { id: "void_shadow", name: "Predação do Vazio", region: "Voidborn", icon: "☠" },
  { id: "florestia_tribal", name: "Juramento da Matilha", region: "Florestia", icon: "🐺" },
  { id: "tempestade_rush", name: "Céu em Ruptura", region: "Tempestade", icon: "⚡" },
  { id: "convergence_dual", name: "Aliança da Forja do Trovão", region: "Emberhold", icon: "🔥⚡" },
  { id: "convergence_triad", name: "Memória do Abismo Vivo", region: "Tidecall", icon: "🌊🌿☠" },
  { id: "ecos_do_abismo", name: "Ecos do Abismo", region: "Voidborn", icon: "🌊☠️" },
] as const;

/**
 * Static cost-reduction rules consumed by effectiveCost(). `threshold` is only
 * meaningful for the power-gated family; creatures intentionally omits it so
 * Studio cannot persist a parameter the runtime would ignore.
 */
export const COST_REDUCTION_KINDS = ["creatures", "power"] as const satisfies readonly CostReduction["kind"][];
export const COST_REDUCTION_CONTRACTS = {
  creatures: {
    label: "Criaturas aliadas",
    fields: ["per", "max"] as const,
    defaults: { per: 1 } as const,
    description: "Reduz o custo para cada criatura aliada no bench.",
  },
  power: {
    label: "Aliadas por poder",
    fields: ["per", "threshold", "max"] as const,
    defaults: { per: 1, threshold: 4 } as const,
    description: "Reduz o custo para cada criatura aliada com poder igual ou maior que o limite.",
  },
} as const satisfies Record<CostReduction["kind"], {
  label: string;
  fields: readonly ("per" | "threshold" | "max")[];
  defaults: Readonly<Partial<CostReduction>>;
  description: string;
}>;

// Compile-time completeness gates: adding a new engine vocabulary value without
// exposing it to the authoring system is a build error, not a latent Studio bug.
type AssertNever<T extends never> = T;
type _MissingRegions = AssertNever<Exclude<Region, (typeof CARD_REGIONS)[number]>>;
type _MissingTypes = AssertNever<Exclude<CardType, (typeof CARD_TYPES)[number]>>;
type _MissingRarities = AssertNever<Exclude<Rarity, (typeof CARD_RARITIES)[number]>>;
type _MissingRaces = AssertNever<Exclude<Race, (typeof CARD_RACES)[number]>>;
type _MissingKeywords = AssertNever<Exclude<Keyword, (typeof CARD_KEYWORDS)[number]>>;
type _MissingEffects = AssertNever<Exclude<EffectKind, (typeof CARD_EFFECT_KINDS)[number]>>;
type _MissingTargets = AssertNever<Exclude<TargetKind, (typeof CARD_TARGETS)[number]>>;
type _MissingTriggers = AssertNever<Exclude<TriggerWhen, (typeof CARD_TRIGGERS)[number]>>;
type _MissingLevelUps = AssertNever<Exclude<LevelUpType, (typeof CARD_LEVEL_UP_TYPES)[number]>>;
type _MissingCostReductionKinds = AssertNever<Exclude<CostReduction["kind"], (typeof COST_REDUCTION_KINDS)[number]>>;

const has = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);
const finite = (value: unknown, fallback = 0): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const cleanClass = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value);
const cleanId = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  return /^[a-z0-9_]+$/.test(v) ? v : undefined;
};

export type CardValidationResult = { ok: true; card: CardDef } | { ok: false; error: string };

export function sanitizeCostReduction(raw: unknown): CostReduction | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (!has(COST_REDUCTION_KINDS, value.kind)) return null;
  if (value.kind === "creatures" && value.threshold !== undefined) return null;

  const optionalInteger = (input: unknown, minimum: number): number | undefined | null => {
    if (input === undefined) return undefined;
    const numeric = Number(input);
    if (!Number.isInteger(numeric) || numeric < minimum) return null;
    return numeric;
  };
  const per = optionalInteger(value.per, 1);
  const threshold = optionalInteger(value.threshold, 0);
  const max = optionalInteger(value.max, 0);
  if (per === null || threshold === null || max === null) return null;

  const result: CostReduction = { kind: value.kind };
  if (per !== undefined) result.per = per;
  if (value.kind === "power" && threshold !== undefined) result.threshold = threshold;
  if (max !== undefined) result.max = max;
  return result;
}

/** Fail-closed sanitizer for the supported stat-only Permanent Aura slice. */
export function sanitizePermanentStatAura(raw: unknown): PermanentStatAura | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const power = Number(value.buffPower ?? 0);
  const health = Number(value.buffHealth ?? 0);
  if (!Number.isInteger(power) || !Number.isInteger(health) || power < 0 || health < 0 || power > 20 || health > 20) return null;
  if (power === 0 && health === 0) return null;

  const aura: PermanentStatAura = { buffPower: power, buffHealth: health };
  if (value.races !== undefined) {
    if (!Array.isArray(value.races) || value.races.some((race) => !has(CARD_RACES, race))) return null;
    const races = [...new Set(value.races as Race[])];
    if (races.length) aura.races = races;
  }
  if (value.classes !== undefined) {
    if (!Array.isArray(value.classes) || value.classes.some((classKey) => !cleanClass(classKey))) return null;
    const classes = [...new Set(value.classes as string[])];
    if (classes.length) aura.classes = classes;
  }
  return aura;
}

export const MECHANIC_CONDITION_KINDS = ["always","selfDamaged","allyRace","allyClass","enemyRace","enemyClass","allyUnitsAtLeast","enemyUnitsAtLeast","allyPermanentsAtLeast","enemyPermanentsAtLeast","allySentinelasAtLeast","enemySentinelasAtLeast","nexusBelow","opponentNexusBelow","manaAtLeast","opponentManaAtLeast","spellManaAtLeast","opponentSpellManaAtLeast","spellsCastAtLeast","opponentSpellsCastAtLeast","alliesSummonedAtLeast","opponentAlliesSummonedAtLeast","nexusDamageDealtAtLeast","opponentNexusDamageDealtAtLeast","handAtLeast","opponentHandAtLeast","roundAtLeast","and","or","not"] as const;

export function sanitizeMechanicCondition(raw: unknown, depth = 0): MechanicCondition | null {
  if (depth > 6) return null;
  if (!raw || typeof raw !== "object") return { kind: "always" };
  const c = raw as Record<string, unknown>;
  const kind = String(c.kind || "always");
  if (kind === "always" || kind === "selfDamaged") return { kind } as MechanicCondition;
  if ((kind === "allyRace" || kind === "enemyRace") && has(CARD_RACES, c.race)) return { kind, race: c.race, min: Math.max(1, Math.min(6, Math.trunc(finite(c.min, 1)))) } as MechanicCondition;
  if ((kind === "allyClass" || kind === "enemyClass") && cleanClass(c.classKey)) return { kind, classKey: c.classKey, min: Math.max(1, Math.min(6, Math.trunc(finite(c.min, 1)))) } as MechanicCondition;
  if (kind === "allyUnitsAtLeast" || kind === "enemyUnitsAtLeast") return { kind, min: Math.max(1, Math.min(6, Math.trunc(finite(c.min, 1)))) } as MechanicCondition;
  if (kind === "allyPermanentsAtLeast" || kind === "enemyPermanentsAtLeast") return { kind, min: Math.max(1, Math.min(8, Math.trunc(finite(c.min, 1)))) } as MechanicCondition;
  if (kind === "allySentinelasAtLeast" || kind === "enemySentinelasAtLeast") return { kind, min: Math.max(1, Math.min(20, Math.trunc(finite(c.min, 1)))) } as MechanicCondition;
  if (kind === "nexusBelow" || kind === "opponentNexusBelow" || kind === "manaAtLeast" || kind === "opponentManaAtLeast" || kind === "handAtLeast" || kind === "opponentHandAtLeast") return { kind, amount: Math.max(0, Math.min(20, Math.trunc(finite(c.amount)))) } as MechanicCondition;
  if (kind === "spellManaAtLeast" || kind === "opponentSpellManaAtLeast") return { kind, amount: Math.max(0, Math.min(10, Math.trunc(finite(c.amount)))) } as MechanicCondition;
  if (kind === "spellsCastAtLeast" || kind === "opponentSpellsCastAtLeast" || kind === "alliesSummonedAtLeast" || kind === "opponentAlliesSummonedAtLeast" || kind === "nexusDamageDealtAtLeast" || kind === "opponentNexusDamageDealtAtLeast") return { kind, amount: Math.max(1, Math.min(2000, Math.trunc(finite(c.amount, 1)))) } as MechanicCondition;
  if (kind === "roundAtLeast") return { kind, amount: Math.max(1, Math.min(2000, Math.trunc(finite(c.amount, 1)))) } as MechanicCondition;
  if (kind === "and" || kind === "or") {
    if (!Array.isArray(c.children) || c.children.length < 1 || c.children.length > 8) return null;
    const children: MechanicCondition[] = [];
    for (const rawChild of c.children) { const child = sanitizeMechanicCondition(rawChild, depth + 1); if (!child) return null; children.push(child); }
    return { kind, children } as MechanicCondition;
  }
  if (kind === "not") {
    const child = sanitizeMechanicCondition(c.child, depth + 1);
    return child ? { kind: "not", child } : null;
  }
  return null;
}

export function sanitizeCardMechanic(raw: unknown): CardMechanic | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const key = typeof m.key === "string" && /^[a-z0-9][a-z0-9_-]{1,63}$/.test(m.key) ? m.key : "";
  if (!key || !has(CARD_TRIGGERS, m.trigger) || !isTriggerSupported("Unit", m.trigger)) return null;
  const condition = sanitizeMechanicCondition(m.condition);
  const effect = sanitizeCardEffect(m.effect);
  if (!condition || !effect) return null;
  return { key, name: typeof m.name === "string" ? m.name.slice(0,80) : undefined, trigger: m.trigger, condition, effect };
}

function effectContractSatisfied(effect: CardEffect): boolean {
  const contract: CardEffectContract = CARD_EFFECT_CONTRACTS[effect.kind];
  if (!(contract.targets as readonly TargetKind[]).includes(effect.target)) return false;
  if (contract.amount === "nonNegative" && effect.amount < 0) return false;
  if (contract.amount === "positive" && effect.amount <= 0) return false;
  for (const required of contract.requires ?? []) {
    if (required === "keyword" && !effect.keyword) return false;
    if (required === "tokenDefId" && !effect.tokenDefId) return false;
    if (required === "equipmentDefId" && !effect.equipmentDefId) return false;
    if (required === "race" && !effect.race && !(effect.races?.length)) return false;
    if (required === "classKey" && !effect.classKey && !(effect.classKeys?.length)) return false;
    if (required === "buff" && effect.buffPower === undefined && effect.buffHealth === undefined) return false;
  }
  return true;
}

export function cardEffectUsesGraveyardTarget(effect: CardEffect | undefined): boolean {
  let cursor = effect;
  while (cursor) {
    if ((GRAVEYARD_TARGETS as readonly TargetKind[]).includes(cursor.target)) return true;
    cursor = cursor.also;
  }
  return false;
}

export function sanitizeCardEffect(raw: unknown, depth = 0): CardEffect | null {
  if (!raw || typeof raw !== "object" || depth > EFFECT_CHAIN_MAX_SUPPORTED_DEPTH) return null;
  const e = raw as Record<string, unknown>;
  if (!has(CARD_EFFECT_KINDS, e.kind)) return null;
  if (!has(CARD_TARGETS, e.target)) return null;

  const effect: CardEffect = {
    kind: e.kind,
    amount: finite(e.amount),
    target: e.target,
  };
  if (e.buffPower !== undefined) effect.buffPower = finite(e.buffPower);
  if (e.buffHealth !== undefined) effect.buffHealth = finite(e.buffHealth);
  if (has(CARD_KEYWORDS, e.keyword)) effect.keyword = e.keyword;
  const tokenDefId = cleanId(e.tokenDefId);
  if (tokenDefId) effect.tokenDefId = tokenDefId;
  const equipmentDefId = cleanId(e.equipmentDefId);
  if (equipmentDefId) effect.equipmentDefId = equipmentDefId;
  if (has(CARD_RACES, e.race)) effect.race = e.race;
  if (Array.isArray(e.races)) effect.races = [...new Set(e.races.filter((r): r is Race => has(CARD_RACES, r)))];
  if (cleanClass(e.classKey)) effect.classKey = e.classKey;
  if (Array.isArray(e.classKeys)) effect.classKeys = [...new Set(e.classKeys.filter(cleanClass))];
  if (effect.kind === "grantKeyword" && effect.keyword && !keywordIsGrantable(effect.keyword)) return null;
  if (!effectContractSatisfied(effect)) return null;
  if (e.also !== undefined && e.also !== null) {
    const also = sanitizeCardEffect(e.also, depth + 1);
    if (!also) return null;
    effect.also = also;
  }
  return effect;
}

function nonNegativeInteger(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) return null;
  return numeric;
}

function sanitizeActivatedAbilityCost(raw: unknown): ActivatedAbilityCost | null | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const cost: ActivatedAbilityCost = {};

  const mana = nonNegativeInteger(value.mana);
  if (mana === null) return null;
  if (mana !== undefined) cost.mana = mana;

  const spellMana = nonNegativeInteger(value.spellMana);
  if (spellMana === null || (spellMana !== undefined && spellMana > 20)) return null;
  if (spellMana !== undefined) cost.spellMana = spellMana;

  const nexusHealth = nonNegativeInteger(value.nexusHealth);
  if (nexusHealth === null) return null;
  if (nexusHealth !== undefined) cost.nexusHealth = nexusHealth;

  const discardFromHand = nonNegativeInteger(value.discardFromHand);
  if (discardFromHand === null || (discardFromHand !== undefined && discardFromHand > 10)) return null;
  if (discardFromHand !== undefined) cost.discardFromHand = discardFromHand;

  if (value.exhaustSelf !== undefined) {
    if (typeof value.exhaustSelf !== "boolean") return null;
    if (value.exhaustSelf) cost.exhaustSelf = true;
  }
  if (value.consumeBarrier !== undefined) {
    if (typeof value.consumeBarrier !== "boolean") return null;
    if (value.consumeBarrier) cost.consumeBarrier = true;
  }
  if (value.sacrificeSelf !== undefined) {
    if (typeof value.sacrificeSelf !== "boolean") return null;
    if (value.sacrificeSelf) cost.sacrificeSelf = true;
  }
  if (value.loyaltyDelta !== undefined) {
    const loyaltyDelta = Number(value.loyaltyDelta);
    if (!Number.isInteger(loyaltyDelta)) return null;
    cost.loyaltyDelta = loyaltyDelta;
  }

  return cost;
}

export function sanitizeActivatedAbility(raw: unknown): ActivatedAbility | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const description = typeof value.description === "string" ? value.description.trim().slice(0, 200) : "";
  if (!description) return null;

  const effect = sanitizeCardEffect(value.effect);
  if (!effect || cardEffectUsesGraveyardTarget(effect)) return null;

  const cost = sanitizeActivatedAbilityCost(value.cost);
  if (cost === null) return null;

  let maxUsesPerRound: number | null | undefined;
  if (value.maxUsesPerRound === null) {
    maxUsesPerRound = null;
  } else if (value.maxUsesPerRound !== undefined) {
    const numeric = Number(value.maxUsesPerRound);
    if (!Number.isInteger(numeric) || numeric <= 0) return null;
    maxUsesPerRound = numeric;
  }

  // Mirror the authoritative engine's fail-closed rule: unlimited abilities
  // must consume a finite resource or the source itself, otherwise authored
  // content could create an infinite zero-cost activation loop.
  if (maxUsesPerRound === null) {
    const consumes = Boolean(
      (cost?.mana ?? 0) > 0 ||
      (cost?.spellMana ?? 0) > 0 ||
      (cost?.nexusHealth ?? 0) > 0 ||
      (cost?.discardFromHand ?? 0) > 0 ||
      cost?.exhaustSelf ||
      cost?.consumeBarrier ||
      cost?.sacrificeSelf ||
      (cost?.loyaltyDelta ?? 0) < 0,
    );
    if (!consumes) return null;
  }

  if (cost?.sacrificeSelf && effect.target === "self") return null;

  const ability: ActivatedAbility = { description, effect };
  if (cost && Object.keys(cost).length > 0) ability.cost = cost;
  if (maxUsesPerRound !== undefined) ability.maxUsesPerRound = maxUsesPerRound;
  return ability;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || `card_${Date.now()}`;
}

export function validateAuthorableCard(raw: Partial<CardDef>): CardValidationResult {
  if (!raw.name || String(raw.name).trim().length < 1) return { ok: false, error: "Name is required" };
  if (!has(CARD_REGIONS, raw.region)) return { ok: false, error: "Invalid region" };
  const rawRegions = raw.regions === undefined ? [] : raw.regions;
  if (!Array.isArray(rawRegions) || rawRegions.some((region) => !has(CARD_REGIONS, region))) {
    return { ok: false, error: "Regions must contain only canonical regions" };
  }
  const regions = [...new Set([raw.region, ...rawRegions])] as Region[];
  if (regions.length > 3) return { ok: false, error: "A card can belong to at most three regions" };
  if (!has(CARD_TYPES, raw.type)) return { ok: false, error: "Invalid type" };
  if (!has(CARD_RARITIES, raw.rarity)) return { ok: false, error: "Invalid rarity" };
  if (typeof raw.cost !== "number" || !Number.isFinite(raw.cost) || raw.cost < 0 || raw.cost > 20) return { ok: false, error: "Cost must be 0-20" };
  if (!raw.emoji) return { ok: false, error: "Emoji is required" };
  if (!raw.description) return { ok: false, error: "Description is required" };

  const defId = raw.defId?.trim() || `custom_${slugify(raw.name)}`;
  if (!/^[a-z0-9_]+$/.test(defId)) return { ok: false, error: "defId must be lowercase alphanumeric + underscore" };

  const card: CardDef = {
    defId,
    name: String(raw.name).slice(0, 60),
    region: raw.region,
    type: raw.type,
    cost: Math.floor(raw.cost),
    description: String(raw.description).slice(0, 300),
    rarity: raw.rarity,
    emoji: String(raw.emoji).slice(0, 16),
    collectible: raw.collectible !== false,
  };
  if (regions.length > 1) {
    card.regions = regions as CardDef["regions"];
    card.regionalPerk = has(CARD_REGIONAL_PERKS, raw.regionalPerk) ? raw.regionalPerk : "convergence";
  }

  if (raw.power !== undefined) card.power = Math.max(0, Math.min(99, Math.trunc(finite(raw.power))));
  if (raw.health !== undefined) card.health = Math.max(0, Math.min(99, Math.trunc(finite(raw.health))));
  if (raw.maxHealth !== undefined) card.maxHealth = Math.max(1, Math.min(99, Math.trunc(finite(raw.maxHealth, 1))));
  if (has(CARD_RACES, raw.race)) card.race = raw.race;
  if (Array.isArray(raw.secondaryRaces)) card.secondaryRaces = [...new Set(raw.secondaryRaces.filter((r): r is Race => has(CARD_RACES, r)))];
  if (Array.isArray(raw.classes)) card.classes = [...new Set(raw.classes.filter(cleanClass))];
  if (Array.isArray(raw.keywords)) card.keywords = [...new Set(raw.keywords.filter((k): k is Keyword => has(CARD_KEYWORDS, k)))];
  if (raw.isLegend) card.isLegend = true;
  if (raw.isChampion) card.isChampion = true;
  if (raw.speed === "Fast" || raw.speed === "Burst") card.speed = raw.speed;
  if (raw.art) card.art = String(raw.art).slice(0, 500);
  if (raw.flavor) card.flavor = String(raw.flavor).trim().slice(0, 280);
  if (typeof raw.archetypeKey === "string" && /^[a-z0-9][a-z0-9_-]{1,63}$/.test(raw.archetypeKey)) card.archetypeKey = raw.archetypeKey;
  if (typeof raw.archetypeName === "string" && raw.archetypeName.trim()) card.archetypeName = raw.archetypeName.trim().slice(0,80);
  if (has(CARD_STRATEGIC_ROLES, raw.strategicRole)) card.strategicRole = raw.strategicRole;
  if (Array.isArray(raw.doctrineAffinities)) {
    const doctrineIds = new Set(CARD_DOCTRINES.map((item) => item.id as string));
    card.doctrineAffinities = [...new Set(raw.doctrineAffinities.filter((id): id is string => typeof id === "string" && doctrineIds.has(id)))].slice(0, CARD_DOCTRINES.length);
  }
  if (Array.isArray(raw.customKeywords)) card.customKeywords = [...new Set(raw.customKeywords.filter((x): x is string => typeof x === "string" && /^[a-z0-9][a-z0-9_-]{1,63}$/.test(x)))].slice(0,8);
  if (Array.isArray(raw.mechanics)) {
    const mechanics: CardMechanic[] = [];
    for (const rawMechanic of raw.mechanics.slice(0,8)) {
      const mechanic = sanitizeCardMechanic(rawMechanic);
      if (!mechanic) return { ok: false, error: "Invalid custom mechanic" };
      if (cardEffectUsesGraveyardTarget(mechanic.effect)) return { ok: false, error: "Graveyard-targeted effects are main-phase Spell effects in Graveyard Effects 1.0" };
      if (!mechanics.some((m) => m.key === mechanic.key)) mechanics.push(mechanic);
    }
    card.mechanics = mechanics;
  }
  if ((card.mechanics?.length || card.customKeywords?.length) && card.type !== "Unit") return { ok: false, error: "Mechanics Studio keywords currently execute on Unit cards only; use effect macros/triggers for other structural card types." };
  if (card.customKeywords?.some((key) => !card.mechanics?.some((m) => m.key === key))) return { ok: false, error: "Every custom keyword must embed its compiled mechanic contract." };

  if (raw.costReduction !== undefined) {
    const costReduction = sanitizeCostReduction(raw.costReduction);
    if (!costReduction) return { ok: false, error: "Invalid cost reduction contract" };
    card.costReduction = costReduction;
  }

  if (raw.aura !== undefined) {
    if (card.type !== "Enchantment" && card.type !== "Artifact") return { ok: false, error: "Continuous stat Aura is supported only on Enchantment or Artifact cards" };
    const aura = sanitizePermanentStatAura(raw.aura);
    if (!aura) return { ok: false, error: "Invalid permanent stat Aura contract" };
    card.aura = aura;
  }

  if (raw.spell !== undefined) {
    const spell = sanitizeCardEffect(raw.spell);
    if (!spell) return { ok: false, error: "Invalid spell effect" };
    if (cardEffectUsesGraveyardTarget(spell)) {
      if (card.type !== "Spell") return { ok: false, error: "Graveyard-targeted effects require a Spell card" };
      if (card.speed) return { ok: false, error: "Graveyard-targeted Spells are main-phase only in Graveyard Effects 1.0" };
    }
    card.spell = spell;
  }

  if (raw.trigger !== undefined) {
    if (!raw.trigger || !has(CARD_TRIGGERS, raw.trigger.when)) return { ok: false, error: "Invalid trigger when" };
    const triggerError = triggerContractError(card.type, raw.trigger.when);
    if (triggerError) return { ok: false, error: triggerError };
    const effect = sanitizeCardEffect(raw.trigger.effect);
    if (!effect) return { ok: false, error: "Invalid trigger effect" };
    if (cardEffectUsesGraveyardTarget(effect)) return { ok: false, error: "Graveyard-targeted trigger effects are not supported in Graveyard Effects 1.0" };
    card.trigger = { when: raw.trigger.when, effect };
  }

  if (raw.activatedAbilities !== undefined) {
    if (!Array.isArray(raw.activatedAbilities) || raw.activatedAbilities.length > 8) {
      return { ok: false, error: "Activated abilities must be an array with at most 8 entries" };
    }
    const activatedAbilities: ActivatedAbility[] = [];
    for (const rawAbility of raw.activatedAbilities) {
      const ability = sanitizeActivatedAbility(rawAbility);
      if (!ability) return { ok: false, error: "Invalid activated ability" };
      activatedAbilities.push(ability);
    }
    if (activatedAbilities.length > 0) card.activatedAbilities = activatedAbilities;
  }

  if (raw.equipment !== undefined) {
    if (!raw.equipment || typeof raw.equipment !== "object") return { ok: false, error: "Invalid equipment" };
    const equipmentKeywords = Array.isArray(raw.equipment.keywords)
      ? [...new Set(raw.equipment.keywords.filter((k): k is Keyword => has(CARD_KEYWORDS, k)))]
      : [];
    const nonGrantableKeyword = equipmentKeywords.find((keyword) => !keywordIsGrantable(keyword));
    if (nonGrantableKeyword) return { ok: false, error: `${nonGrantableKeyword} cannot be granted by Equipment.` };
    card.equipment = {
      buffPower: finite(raw.equipment.buffPower),
      buffHealth: finite(raw.equipment.buffHealth),
      keywords: equipmentKeywords,
    };
  }

  if (raw.levelUp !== undefined) {
    if (!raw.levelUp || !has(CARD_LEVEL_UP_TYPES, raw.levelUp.type)) return { ok: false, error: "Invalid level-up type" };
    const toDefId = cleanId(raw.levelUp.toDefId);
    if (!toDefId) return { ok: false, error: "Level-up target card is required" };
    card.levelUp = {
      type: raw.levelUp.type,
      amount: Math.max(1, Math.trunc(finite(raw.levelUp.amount, 1))),
      toDefId,
      hint: String(raw.levelUp.hint || "Level up condition").slice(0, 240),
    };
  }

  if (card.type === "Spell" && !card.spell) return { ok: false, error: "Spell cards require a spell effect" };
  if (card.type === "Unit") {
    card.power = card.power ?? 1;
    card.health = card.health ?? 1;
  }
  if (card.type === "Enchantment" || card.type === "Artifact") card.maxHealth = card.maxHealth ?? 3;
  if (card.type === "Equipment" && !card.equipment) card.equipment = { buffPower: 1, buffHealth: 0, keywords: [] };

  if (card.type === "Sentinela") {
    if (!raw.sentinela || typeof raw.sentinela !== "object" || !Array.isArray(raw.sentinela.abilities)) {
      return { ok: false, error: "Sentinela precisa de uma definição de lealdade e habilidades." };
    }
    const abilities = [];
    for (const ability of raw.sentinela.abilities) {
      if (!ability || typeof ability !== "object") return { ok: false, error: "Invalid Sentinela ability" };
      const effect = sanitizeCardEffect(ability.effect);
      if (!effect) return { ok: false, error: "Invalid Sentinela ability effect" };
      if (cardEffectUsesGraveyardTarget(effect)) return { ok: false, error: "Graveyard-targeted Sentinela abilities are not supported in Graveyard Effects 1.0" };
      abilities.push({
        cost: Math.trunc(finite(ability.cost)),
        description: String(ability.description || "").slice(0, 200),
        effect,
      });
    }
    if (!abilities.length) return { ok: false, error: "Sentinela precisa de pelo menos uma habilidade válida." };
    card.sentinela = {
      startingLoyalty: Math.max(1, Math.min(20, Math.trunc(finite(raw.sentinela.startingLoyalty, 3)))),
      abilities,
    };
  }

  const keywordError = keywordCardContractError(card);
  if (keywordError) return { ok: false, error: keywordError };

  const stack: unknown[] = [card];
  while (stack.length) {
    const value = stack.pop();
    if (typeof value === "number" && !Number.isFinite(value)) return { ok: false, error: "Card contains a non-finite numeric value" };
    if (value && typeof value === "object") for (const child of Object.values(value as Record<string, unknown>)) stack.push(child);
  }
  return { ok: true, card };
}

/** Normalize defaults that are intentionally implicit in base cards for semantic round-trip tests. */
export function normalizeCardForRoundTrip(card: CardDef): CardDef {
  const result = validateAuthorableCard(card);
  if (result.ok === false) throw new Error(`${card.defId}: ${result.error}`);
  return result.card;
}
