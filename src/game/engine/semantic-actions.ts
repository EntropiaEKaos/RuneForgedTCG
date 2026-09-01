import { getCard } from "../cards";
import { engineRulesFor } from "../match-rules";
import { isRitualCard, isStructureCard, isTrapCard } from "../semantic-card-types";
import type { GameState, PlayerId } from "../types";
import * as base from "./actions";
import { cleanupDead } from "./effects";
import { checkWin, clone, makePermanent, recomputeContinuousAuras } from "./state";

export const effectiveCost = base.effectiveCost;
export const spellNeedsTarget = base.spellNeedsTarget;
export const isValidTarget = base.isValidTarget;
export const isReadyToAttack = base.isReadyToAttack;
export const canDeclareAttack = base.canDeclareAttack;
export const canBlock = base.canBlock;
export const resolveCombat = base.resolveCombat;
export const mulligan = base.mulligan;
export const skipMulligan = base.skipMulligan;

/** Recompute controller-scoped Aura conditions after any successful spell transition. */
export function castSpell(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  targetInstanceId?: string,
): GameState {
  const next = base.castSpell(state, playerId, instanceId, targetInstanceId);
  if (next !== state) recomputeContinuousAuras(next);
  return next;
}

/** onAttack triggers can change board/Nexus state before blockers exist, so refresh conditional Auras immediately. */
export function declareAttack(
  state: GameState,
  playerId: PlayerId,
  attackerIds: string[],
  challenges?: Record<string, string>,
  sentinelaTargets?: Record<string, string>,
): GameState {
  const next = base.declareAttack(state, playerId, attackerIds, challenges, sentinelaTargets);
  if (next !== state) recomputeContinuousAuras(next);
  return next;
}

/** Mana refresh, fatigue and round-start state may toggle Aura 2.5 conditions. */
export function endTurn(state: GameState, playerId: PlayerId): GameState {
  const next = base.endTurn(state, playerId);
  if (next !== state) recomputeContinuousAuras(next);
  return next;
}

/**
 * Semantic timing gate layered over the legacy Spell reaction contract.
 * Rituals never respond; Traps intentionally use the existing Fast/Burst
 * speed rules and ordinary spells keep their historical behavior.
 */
export function canCastReaction(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  actionKind: "unit" | "spell" | "sentinela",
): boolean {
  const instance = state.players[playerId].hand.find((card) => card.instanceId === instanceId);
  if (!instance) return false;
  const def = getCard(instance.defId);
  if (isRitualCard(def)) return false;
  return base.canCastReaction(state, playerId, instanceId, actionKind);
}

/**
 * Traps are reaction-only. Structures use regular mana and the permanent cap;
 * every other card delegates to the certified legacy gate unchanged.
 */
export function canPlayCard(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  const instance = state.players[playerId].hand.find((card) => card.instanceId === instanceId);
  if (!instance) return false;
  const def = getCard(instance.defId);
  if (isTrapCard(def)) return false;
  if (!isStructureCard(def)) return base.canPlayCard(state, playerId, instanceId);

  if (state.phase !== "main" || state.activePlayer !== playerId) return false;
  const player = state.players[playerId];
  const cost = base.effectiveCost(state, playerId, def);
  return player.mana >= cost && player.permanents.length < engineRulesFor(state).permanentsCap;
}

/**
 * Structure is stored as Artifact for backwards-compatible persistence, but
 * resolves as a non-spell battlefield object. Aura 2.5 refreshes the continuous
 * layer after every successful play so controller-state conditions cannot stay stale.
 */
export function playUnit(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  targetInstanceId?: string,
): GameState {
  const instance = state.players[playerId].hand.find((card) => card.instanceId === instanceId);
  if (!instance) return state;
  const def = getCard(instance.defId);
  if (!isStructureCard(def)) {
    const next = base.playUnit(state, playerId, instanceId, targetInstanceId);
    if (next !== state) recomputeContinuousAuras(next);
    return next;
  }

  if (state.phase !== "main" || state.activePlayer !== playerId) return state;
  const s = clone(state);
  const player = s.players[playerId];
  const current = player.hand.find((card) => card.instanceId === instanceId);
  if (!current) return state;
  const cost = base.effectiveCost(s, playerId, def);
  if (player.mana < cost || player.permanents.length >= engineRulesFor(s).permanentsCap) return state;

  player.mana -= cost;
  player.hand = player.hand.filter((card) => card.instanceId !== instanceId);
  player.permanents.push(makePermanent(s, def.defId, playerId));
  s.log.push(`${player.name} constrói ${def.name} (Estrutura).`);
  cleanupDead(s);
  recomputeContinuousAuras(s);
  checkWin(s);
  return s;
}
