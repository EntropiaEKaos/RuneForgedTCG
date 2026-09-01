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
  "buffAllies",
  "buffRace",
  "grantKeyword",
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
  if (effect.kind === "buffAllies") return me.bench.length > 0 && Boolean((effect.buffPower ?? 0) || (effect.buffHealth ?? 0));
  if (effect.kind === "buffRace") {
    return Boolean((effect.buffPower ?? 0) || (effect.buffHealth ?? 0)) && me.bench.some((unit) => unitMatchesRaceEffect(unit, effect));
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
 * Prefer a legal battlefield reaction when one exists, then fall back to the
 * historical hand-card reaction policy. Both candidates are revalidated by the
 * authoritative stack contract before insertion.
 */
export function aiChooseReaction(
  state: GameState,
  action: CardAction,
  playerId: PlayerId = "ai",
): AiAction | null {
  return aiChooseReactionActivatedAbilityAction(state, action, playerId) ??
    aiChooseCardReaction(state, action, playerId);
}
