import { getCard } from "./cards";
import {
  activatedAbilitiesForInstance,
  activatedAbilityChoices,
  canBeginActivateAbility,
  isValidTarget,
  other,
  validateActivatedAbilityActivation,
} from "./engine";
import type { ActivatedAbility } from "./activated-ability-types";
import type { CardAction } from "./engine";
import type {
  BoardEntity,
  CardDef,
  CardEffect,
  GameState,
  PermanentInstance,
  PlayerId,
  SentinelaInstance,
  UnitInstance,
} from "./types";

type AiAbilitySource =
  | { kind: "unit"; instance: UnitInstance; def: CardDef }
  | { kind: "permanent"; instance: PermanentInstance; def: CardDef }
  | { kind: "sentinela"; instance: SentinelaInstance; def: CardDef };

interface ScoredActivation {
  action: CardAction;
  score: number;
  modeOrder: number;
}

const HOSTILE_EFFECTS = new Set<CardEffect["kind"]>([
  "damageUnit",
  "damageNexus",
  "aoeEnemy",
  "destroyPermanent",
  "damagePermanent",
  "frostbite",
  "stun",
  "recall",
  "killUnit",
  "poison",
  "mill",
]);

const FRIENDLY_EFFECTS = new Set<CardEffect["kind"]>([
  "healUnit",
  "healNexus",
  "buffUnit",
  "buffSelf",
  "buffAllies",
  "buffRace",
  "buffClass",
  "draw",
  "grantBarrier",
  "grantKeyword",
  "summonToken",
  "attachEquipment",
  "manaRefund",
  "drawOnSummon",
]);

function sourceId(source: AiAbilitySource): string {
  return source.instance.instanceId;
}

function boardEntityId(entity: BoardEntity): string {
  if (entity.kind === "unit") return entity.unit.instanceId;
  if (entity.kind === "permanent") return entity.perm.instanceId;
  return entity.sen.instanceId;
}

function controlledSources(state: GameState, playerId: PlayerId): AiAbilitySource[] {
  const player = state.players[playerId];
  return [
    ...player.bench.map((instance) => ({ kind: "unit" as const, instance, def: getCard(instance.defId) })),
    ...player.permanents.map((instance) => ({ kind: "permanent" as const, instance, def: getCard(instance.defId) })),
    ...player.sentinelas.map((instance) => ({ kind: "sentinela" as const, instance, def: getCard(instance.defId) })),
  ];
}

function allBoardEntities(state: GameState): BoardEntity[] {
  const entities: BoardEntity[] = [];
  for (const owner of ["player", "ai"] as PlayerId[]) {
    const player = state.players[owner];
    for (const unit of player.bench) entities.push({ kind: "unit", owner, unit });
    for (const perm of player.permanents) entities.push({ kind: "permanent", owner, perm });
    for (const sen of player.sentinelas) entities.push({ kind: "sentinela", owner, sen });
  }
  return entities;
}

function targetSideScore(effect: CardEffect, entity: BoardEntity, playerId: PlayerId): number {
  const friendly = entity.owner === playerId;
  if (HOSTILE_EFFECTS.has(effect.kind)) return friendly ? -1000 : 20;
  if (FRIENDLY_EFFECTS.has(effect.kind)) return friendly ? 20 : -1000;
  return friendly ? 0 : 5;
}

function targetValue(effect: CardEffect, entity: BoardEntity, playerId: PlayerId): number {
  let score = targetSideScore(effect, entity, playerId);
  if (score <= -1000) return score;

  if (entity.kind === "unit") {
    const unit = entity.unit;
    const missingHealth = Math.max(0, unit.maxHealth - unit.health);
    if (effect.kind === "healUnit") return missingHealth > 0 ? score + missingHealth * 12 + unit.power * 2 : -1000;
    if (effect.kind === "damageUnit") {
      const lethal = effect.amount >= unit.health ? 35 : 0;
      return score + lethal + unit.power * 5 + Math.min(effect.amount, unit.health) * 4;
    }
    if (effect.kind === "killUnit") return score + 60 + unit.power * 6 + unit.health * 2;
    if (effect.kind === "frostbite" || effect.kind === "stun" || effect.kind === "recall") return score + unit.power * 6 + unit.health;
    if (effect.kind === "poison") return score + unit.power * 4 + unit.health;
    if (effect.kind === "buffUnit" || effect.kind === "grantBarrier" || effect.kind === "grantKeyword") {
      return score + unit.power * 4 + unit.health * 2;
    }
    return score + unit.power * 2 + unit.health;
  }

  if (entity.kind === "permanent") {
    if (effect.kind === "destroyPermanent") return score + 70 + entity.perm.health * 3;
    if (effect.kind === "damagePermanent") {
      const lethal = effect.amount >= entity.perm.health ? 30 : 0;
      return score + lethal + Math.min(effect.amount, entity.perm.health) * 5;
    }
    return score + entity.perm.health * 2;
  }

  if (effect.kind === "damageUnit" || effect.kind === "killUnit") {
    const lethal = effect.kind === "killUnit" || effect.amount >= entity.sen.loyalty ? 35 : 0;
    return score + lethal + Math.max(0, 8 - entity.sen.loyalty) * 4;
  }
  return score + Math.max(0, 8 - entity.sen.loyalty) * 2;
}

function chooseTarget(
  state: GameState,
  playerId: PlayerId,
  sourceIdValue: string,
  abilityIndex: number,
  effect: CardEffect,
  modeId?: string,
): string | undefined | null {
  const targetKind = effect.target;
  if (targetKind === "none" || targetKind === "self") {
    return validateActivatedAbilityActivation(state, playerId, sourceIdValue, abilityIndex, undefined, modeId).ok
      ? undefined
      : null;
  }
  if (targetKind === "spellOnStack") return null;

  const candidates = allBoardEntities(state)
    .filter((entity) => isValidTarget(state, playerId, targetKind, entity))
    .map((entity) => ({
      entity,
      id: boardEntityId(entity),
      score: targetValue(effect, entity, playerId),
    }))
    .filter((candidate) => candidate.score > -1000)
    .filter((candidate) => validateActivatedAbilityActivation(
      state,
      playerId,
      sourceIdValue,
      abilityIndex,
      candidate.id,
      modeId,
    ).ok)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  return candidates[0]?.id ?? null;
}

function effectScore(state: GameState, playerId: PlayerId, effect: CardEffect, targetId?: string): number {
  const me = state.players[playerId];
  const enemy = state.players[other(playerId)];

  if (effect.kind === "damageNexus") {
    if (effect.amount >= enemy.nexusHealth) return 1000 + effect.amount;
    return 35 + effect.amount * 6;
  }
  if (effect.kind === "healNexus") {
    const missing = Math.max(0, 20 - me.nexusHealth);
    return missing > 0 ? 18 + Math.min(effect.amount, missing) * 5 : -1000;
  }
  if (effect.kind === "draw" || effect.kind === "drawOnSummon") {
    if (me.hand.length >= 9) return -1000;
    return 24 + effect.amount * 7 + Math.max(0, 5 - me.hand.length) * 2;
  }
  if (effect.kind === "aoeEnemy") {
    const victims = enemy.bench.length + enemy.permanents.length;
    return victims > 0 ? 20 + victims * effect.amount * 6 : -1000;
  }
  if (effect.kind === "buffAllies" || effect.kind === "buffRace" || effect.kind === "buffClass") {
    return me.bench.length > 0 ? 16 + me.bench.length * 6 : -1000;
  }
  if (effect.kind === "summonToken") return me.bench.length < 6 ? 30 : -1000;
  if (effect.kind === "manaRefund") return 20 + effect.amount * 4;
  if (effect.kind === "mill") return 22 + effect.amount * 3;
  if (effect.kind === "damagePermanent" || effect.kind === "destroyPermanent") return targetId ? 55 : -1000;
  if (effect.kind === "damageUnit" || effect.kind === "killUnit" || effect.kind === "frostbite" || effect.kind === "stun" || effect.kind === "recall" || effect.kind === "poison") {
    return targetId ? 45 : -1000;
  }
  if (effect.kind === "healUnit" || effect.kind === "buffUnit" || effect.kind === "grantBarrier" || effect.kind === "grantKeyword" || effect.kind === "attachEquipment") {
    return targetId || effect.target === "self" ? 32 : -1000;
  }
  if (effect.kind === "buffSelf") return 28;
  if (effect.kind === "negateSpell") return -1000; // No reaction context here.
  return 12;
}

function sourceSacrificeValue(source: AiAbilitySource): number {
  if (source.kind === "unit") return 16 + source.def.cost * 4 + source.instance.power * 3 + source.instance.health * 2;
  if (source.kind === "sentinela") return 20 + source.def.cost * 4 + source.instance.loyalty * 3;
  return 14 + source.def.cost * 4 + source.instance.health * 2;
}

function costPenalty(state: GameState, playerId: PlayerId, source: AiAbilitySource, ability: ActivatedAbility): number {
  const cost = ability.cost;
  if (!cost) return 0;
  let penalty = (cost.mana ?? 0) * 4 + (cost.spellMana ?? 0) * 3;

  if (cost.nexusHealth) {
    const after = state.players[playerId].nexusHealth - cost.nexusHealth;
    penalty += cost.nexusHealth * 7;
    if (after <= 6) penalty += 90;
  }
  if (cost.exhaustSelf) {
    penalty += source.kind === "unit" ? 8 + source.instance.power * 3 : 6;
  }
  if (cost.consumeBarrier && source.kind === "unit") {
    penalty += 16 + source.instance.power * 2 + source.instance.health;
  }
  if (cost.sacrificeSelf) penalty += sourceSacrificeValue(source);
  if ((cost.loyaltyDelta ?? 0) < 0) penalty += Math.abs(cost.loyaltyDelta ?? 0) * 6;
  if ((cost.loyaltyDelta ?? 0) > 0) penalty -= Math.min(12, (cost.loyaltyDelta ?? 0) * 3);
  return penalty;
}

function scoreActivation(
  state: GameState,
  playerId: PlayerId,
  source: AiAbilitySource,
  abilityIndex: number,
  ability: ActivatedAbility,
  choice: ReturnType<typeof activatedAbilityChoices>[number],
  modeOrder: number,
): ScoredActivation | null {
  const instanceId = sourceId(source);
  if (!canBeginActivateAbility(state, playerId, instanceId, abilityIndex, choice.modeId)) return null;

  const target = chooseTarget(state, playerId, instanceId, abilityIndex, choice.effect, choice.modeId);
  if (target === null) return null;
  const base = effectScore(state, playerId, choice.effect, target);
  if (base <= -1000) return null;

  const score = base - costPenalty(state, playerId, source, ability);
  if (score <= 0) return null;
  return {
    action: {
      kind: "sentinela",
      player: playerId,
      instanceId,
      defId: source.def.defId,
      abilityIndex,
      ...(choice.modeId ? { modeId: choice.modeId } : {}),
      ...(target ? { targetInstanceId: target } : {}),
    },
    score,
    modeOrder,
  };
}

/**
 * Chooses one legal, useful activated ability across Units, Artifacts,
 * Enchantments and Sentinelas. Modal abilities are expanded into stable
 * ability/mode/target candidates, while every rule (phase, costs, Hexproof,
 * shared Sentinela budget, per-round use, sacrifice and exhaustion) remains
 * authoritative in the generic engine.
 */
export function aiChooseActivatedAbilityAction(
  state: GameState,
  playerId: PlayerId = "ai",
): CardAction | null {
  if (state.phase !== "main" || state.activePlayer !== playerId) return null;

  const scored: ScoredActivation[] = [];
  for (const source of controlledSources(state, playerId)) {
    const abilities = activatedAbilitiesForInstance(state, playerId, sourceId(source));
    for (let abilityIndex = 0; abilityIndex < abilities.length; abilityIndex++) {
      const ability = abilities[abilityIndex];
      const choices = activatedAbilityChoices(ability);
      for (let modeOrder = 0; modeOrder < choices.length; modeOrder++) {
        const candidate = scoreActivation(state, playerId, source, abilityIndex, ability, choices[modeOrder], modeOrder);
        if (candidate) scored.push(candidate);
      }
    }
  }

  scored.sort((a, b) =>
    b.score - a.score ||
    a.action.instanceId.localeCompare(b.action.instanceId) ||
    (a.action.abilityIndex ?? 0) - (b.action.abilityIndex ?? 0) ||
    a.modeOrder - b.modeOrder ||
    (a.action.targetInstanceId ?? "").localeCompare(b.action.targetInstanceId ?? ""),
  );
  return scored[0]?.action ?? null;
}
