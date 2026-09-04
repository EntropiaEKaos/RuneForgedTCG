export * from "./ai-core";

import { getCard } from "./cards";
import {
  aiChooseAction as aiChooseCoreAction,
  aiChooseReaction as aiChooseCardReaction,
  type AiAction,
} from "./ai-core";
import { aiChooseReactionActivatedAbilityAction } from "./ai-reaction-activated-abilities";
import {
  activateAbility,
  canPlayCard,
  castSpell,
  isValidTarget,
  other,
  playUnit,
  spellNeedsTarget,
  type CardAction,
} from "./engine";
import { graveyardEntries } from "./graveyard";
import {
  graveyardTargetScore,
  isGraveyardTargetKind,
  isValidGraveyardTarget,
} from "./graveyard-effects";
import { canReactWithResponse } from "./reaction-contract";
import { engineRulesFor } from "./match-rules";
import { selfMillAiValue } from "./ai-graveyard-plan";
import type { BoardEntity, CardEffect, GameState, PlayerId, UnitInstance } from "./types";

/**
 * Effects observed in the Vanilla experimental spell suites that the historical
 * ai-core can legally afford but does not always route into a main-phase action.
 * Keep this list intentionally narrow: the existing priority tree still owns
 * draw/heal/ordinary damage/AOE/buffUnit/grantBarrier decisions.
 */
const TACTICAL_FALLBACK_EFFECTS = new Set<CardEffect["kind"]>([
  "damageNexus",
  "frostbite",
  "stun",
  "recall",
  "killUnit",
  "poison",
  "mill",
  "selfMill",
  "buffAllies",
  "buffRace",
  "grantKeyword",
  "returnGraveyardToHand",
  "reanimateUnit",
  "banishGraveyardCard",
]);

const HOSTILE_TARGETED_EFFECTS = new Set<CardEffect["kind"]>([
  "damageUnit",
  "destroyPermanent",
  "damagePermanent",
  "frostbite",
  "stun",
  "recall",
  "killUnit",
]);

/**
 * High-impact spell effects that the historical reaction heuristic did not
 * understand because they were introduced after its original danger list.
 * Keep this deliberately small: the core reaction chooser still owns all
 * historical burn/removal/counter decisions, while this facade closes proven
 * semantic coverage gaps without changing ordinary reaction priorities.
 */
const CRITICAL_COUNTER_FALLBACK_EFFECTS = new Set<CardEffect["kind"]>([
  "reanimateUnit",
]);

function boardEntityId(entity: BoardEntity): string {
  if (entity.kind === "unit") return entity.unit.instanceId;
  if (entity.kind === "permanent") return entity.perm.instanceId;
  return entity.sen.instanceId;
}

function boardEntityValue(entity: BoardEntity, effect: CardEffect): number {
  if (entity.kind === "unit") {
    if (effect.kind === "killUnit") return 100 + entity.unit.power * 8 + entity.unit.health * 2;
    if (effect.kind === "frostbite" || effect.kind === "stun" || effect.kind === "recall") {
      return entity.unit.power * 8 + entity.unit.health * 2;
    }
    return entity.unit.power * 5 + entity.unit.health * 2;
  }
  if (entity.kind === "permanent") return 30 + entity.perm.health * 4;
  return 40 + Math.max(0, 10 - entity.sen.loyalty) * 4;
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

function fallbackTargetUseful(entity: BoardEntity, effect: CardEffect): boolean {
  if (entity.kind !== "unit") return true;
  if (effect.kind === "frostbite") return !entity.unit.frostbitten && entity.unit.power > 0;
  if (effect.kind === "stun") return !entity.unit.stunned;
  if (effect.kind === "grantKeyword") {
    return Boolean(effect.keyword) && !entity.unit.keywords.includes(effect.keyword!);
  }
  return true;
}

function unitMatchesRaceEffect(unit: UnitInstance, effect: CardEffect): boolean {
  const races = effect.races ?? (effect.race ? [effect.race] : []);
  if (races.length === 0) return false;
  return unit.races.some((race) => races.includes(race));
}

function fallbackEffectUseful(state: GameState, playerId: PlayerId, effect: CardEffect): boolean {
  const me = state.players[playerId];
  const enemy = state.players[other(playerId)];
  if (effect.kind === "damageNexus") return enemy.nexusHealth > 0 && effect.amount > 0;
  if (effect.kind === "poison") return enemy.poisonCounters < 10 && effect.amount > 0;
  if (effect.kind === "mill") return enemy.deck.length > 0 && effect.amount > 0;
  if (effect.kind === "selfMill") return selfMillAiValue(state, playerId, effect.amount) > 0;
  if (effect.kind === "buffAllies") return me.bench.length > 0 && Boolean((effect.buffPower ?? 0) || (effect.buffHealth ?? 0));
  if (effect.kind === "buffRace") {
    return Boolean((effect.buffPower ?? 0) || (effect.buffHealth ?? 0)) && me.bench.some((unit) => unitMatchesRaceEffect(unit, effect));
  }
  if (effect.kind === "reanimateUnit") {
    return me.bench.length < engineRulesFor(state).benchCap &&
      graveyardEntries(state, playerId).some((entry) => getCard(entry.defId).type === "Unit");
  }
  if (effect.kind === "returnGraveyardToHand") {
    return me.hand.length < engineRulesFor(state).handCap && graveyardEntries(state, playerId).length > 0;
  }
  if (effect.kind === "banishGraveyardCard") {
    if (effect.target === "enemyGraveyardCard") return graveyardEntries(state, other(playerId)).length > 0;
    return graveyardEntries(state, playerId).length + graveyardEntries(state, other(playerId)).length > 0;
  }
  return true;
}

function chooseFallbackTarget(
  state: GameState,
  playerId: PlayerId,
  effect: CardEffect,
): string | undefined | null {
  const targetKind = effect.target;
  if (targetKind === "none" || targetKind === "self") return undefined;
  if (targetKind === "spellOnStack") return null;

  if (isGraveyardTargetKind(targetKind)) {
    const candidates = (["player", "ai"] as PlayerId[])
      .flatMap((owner) => graveyardEntries(state, owner))
      .filter((entry) => isValidGraveyardTarget(state, playerId, targetKind, entry))
      .map((entry) => ({ entry, score: graveyardTargetScore(entry) }))
      .sort((a, b) => b.score - a.score || a.entry.instanceId.localeCompare(b.entry.instanceId));
    return candidates[0]?.entry.instanceId ?? null;
  }

  const hostile = HOSTILE_TARGETED_EFFECTS.has(effect.kind);
  const enemyId = other(playerId);
  const candidates = allBoardEntities(state)
    .filter((entity) => isValidTarget(state, playerId, targetKind, entity))
    .filter((entity) => hostile ? entity.owner === enemyId : entity.owner === playerId)
    .filter((entity) => fallbackTargetUseful(entity, effect))
    .map((entity) => ({ entity, id: boardEntityId(entity), score: boardEntityValue(entity, effect) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  return candidates[0]?.id ?? null;
}

/**
 * Vanilla 1.3 fallback: preserve every historical ai-core priority and only
 * intervene when the core would otherwise return null despite a useful,
 * actionable main-phase spell. Target legality and minimum semantic usefulness
 * are both checked so the fix cannot become a blind "spend all mana" policy.
 */
function chooseTacticalMainPhaseFallback(state: GameState, playerId: PlayerId): AiAction | null {
  if (state.phase !== "main" || state.activePlayer !== playerId) return null;

  const candidates = state.players[playerId].hand
    .filter((card) => canPlayCard(state, playerId, card.instanceId))
    .map((card) => ({ card, def: getCard(card.defId) }))
    .filter(({ def }) => def.type === "Spell" && Boolean(def.spell) && TACTICAL_FALLBACK_EFFECTS.has(def.spell!.kind))
    .sort((a, b) => b.def.cost - a.def.cost || a.def.defId.localeCompare(b.def.defId));

  for (const { card, def } of candidates) {
    const effect = def.spell!;
    if (!fallbackEffectUseful(state, playerId, effect)) continue;
    const targetKind = spellNeedsTarget(def.defId);
    const targetInstanceId = chooseFallbackTarget(state, playerId, effect);
    if (targetKind && targetKind !== "none" && targetKind !== "self" && targetInstanceId == null) continue;
    if (targetKind === "spellOnStack") continue;
    return {
      kind: "spell",
      instanceId: card.instanceId,
      defId: def.defId,
      targetInstanceId: targetInstanceId ?? undefined,
    };
  }
  return null;
}

function chooseCriticalCounterFallback(
  state: GameState,
  action: CardAction,
  playerId: PlayerId,
): AiAction | null {
  if (action.kind !== "spell") return null;
  const pending = getCard(action.defId);
  if (!pending.spell || !CRITICAL_COUNTER_FALLBACK_EFFECTS.has(pending.spell.kind)) return null;

  const counters = state.players[playerId].hand
    .map((card) => ({ card, def: getCard(card.defId) }))
    .filter(({ def }) => def.type === "Spell" && def.spell?.kind === "negateSpell")
    .sort((a, b) => a.def.cost - b.def.cost || a.def.defId.localeCompare(b.def.defId) || a.card.instanceId.localeCompare(b.card.instanceId));

  for (const { card } of counters) {
    const response: CardAction = {
      kind: "spell",
      player: playerId,
      instanceId: card.instanceId,
      defId: card.defId,
      targetInstanceId: action.instanceId,
    };
    if (canReactWithResponse(state, playerId, response, action)) return response;
  }
  return null;
}

function chooseSemanticTrapFallback(
  state: GameState,
  action: CardAction,
  playerId: PlayerId,
): AiAction | null {
  const enemyId = other(playerId);
  const me = state.players[playerId];
  const enemy = state.players[enemyId];

  const traps = me.hand
    .map((card) => ({ card, def: getCard(card.defId) }))
    .filter(({ def }) => def.type === "Spell" && def.archetypeKey === "trap" && Boolean(def.spell))
    .sort((a, b) => a.def.cost - b.def.cost || a.def.defId.localeCompare(b.def.defId) || a.card.instanceId.localeCompare(b.card.instanceId));

  for (const { card, def } of traps) {
    const effect = def.spell!;
    const targetKind = spellNeedsTarget(def.defId);
    let targetIds: Array<string | undefined> = [];

    if (!targetKind || targetKind === "none" || targetKind === "self") {
      targetIds = [undefined];
    } else if (targetKind === "spellOnStack") {
      if (action.kind === "spell") targetIds = [action.instanceId];
    } else if (targetKind === "allyUnit") {
      targetIds = [...me.bench]
        .sort((a, b) => Number(a.barrier) - Number(b.barrier) || b.power - a.power || b.health - a.health)
        .map((unit) => unit.instanceId);
    } else if (targetKind === "enemyUnit") {
      targetIds = [...enemy.bench]
        .filter((unit) => !unit.stunned)
        .sort((a, b) => b.power - a.power || a.health - b.health)
        .map((unit) => unit.instanceId);
    } else {
      continue;
    }

    for (const targetInstanceId of targetIds) {
      const useful =
        effect.kind === "damageNexus" ? enemy.nexusHealth > 0 :
        effect.kind === "mill" ? enemy.deck.length > 0 :
        effect.kind === "buffAllies" ? me.bench.length > 0 :
        effect.kind === "grantBarrier" ? Boolean(targetInstanceId && me.bench.some((unit) => unit.instanceId === targetInstanceId && !unit.barrier)) :
        effect.kind === "stun" ? Boolean(targetInstanceId && enemy.bench.some((unit) => unit.instanceId === targetInstanceId && !unit.stunned)) :
        effect.kind === "negateSpell" ? action.kind === "spell" :
        false;
      if (!useful) continue;

      const response: CardAction = {
        kind: "spell",
        player: playerId,
        instanceId: card.instanceId,
        defId: card.defId,
        targetInstanceId,
      };
      if (canReactWithResponse(state, playerId, response, action)) return response;
    }
  }

  return null;
}

/**
 * Public main-phase chooser. The certified historical policy remains first;
 * Vanilla 1.3 only fills proven tactical coverage gaps after that policy has
 * declined to act.
 */
export function aiChooseAction(state: GameState, playerId: PlayerId = "ai"): AiAction | null {
  return aiChooseCoreAction(state, playerId) ?? chooseTacticalMainPhaseFallback(state, playerId);
}

/**
 * Public AI execution facade. Activated battlefield actions use the same
 * generic executor as the browser, reducer, replay and PvP paths, preserving
 * the versioned `sentinela` action kind while carrying additive modal and
 * selected-cost payload fields.
 */
export function applyAiAction(
  state: GameState,
  action: AiAction,
  playerId: PlayerId = "ai",
): GameState {
  if (action.kind === "unit") {
    return playUnit(state, playerId, action.instanceId, action.targetInstanceId);
  }
  if (action.kind === "sentinela") {
    return activateAbility(
      state,
      playerId,
      action.instanceId,
      action.abilityIndex ?? 0,
      action.targetInstanceId,
      action.modeId,
      action.costDiscardInstanceIds,
    );
  }
  return castSpell(state, playerId, action.instanceId, action.targetInstanceId);
}

/**
 * Prefer a legal battlefield reaction when one exists, then the historical
 * hand-card policy, then a narrow semantic fallback for high-impact effects
 * introduced after the original danger table (currently Reanimation).
 */
export function aiChooseReaction(
  state: GameState,
  action: CardAction,
  playerId: PlayerId = "ai",
): AiAction | null {
  return aiChooseReactionActivatedAbilityAction(state, action, playerId) ??
    aiChooseCardReaction(state, action, playerId) ??
    chooseCriticalCounterFallback(state, action, playerId) ??
    chooseSemanticTrapFallback(state, action, playerId);
}
