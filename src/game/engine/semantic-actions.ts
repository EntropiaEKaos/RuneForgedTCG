import { getCard } from "../cards";
import { putInGraveyard } from "../graveyard";
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

/**
 * Canonical spell resolution wrapper. The physical card remains committed to
 * the stack during resolution and enters its owner's graveyard only after the
 * underlying spell action resolves successfully.
 */
export function castSpell(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  targetInstanceId?: string,
): GameState {
  const instance = state.players[playerId].hand.find((card) => card.instanceId === instanceId);
  if (!instance) return state;
  const def = getCard(instance.defId);
  const next = base.castSpell(state, playerId, instanceId, targetInstanceId);
  if (next === state) return state;
  if (def.type === "Spell" && !next.players[playerId].hand.some((card) => card.instanceId === instanceId)) {
    putInGraveyard(next, playerId, def.defId, "spell", instanceId);
  }
  return next;
}

/**
 * Aura 2.5 must not add a blanket stat recomputation to legacy actions.
 * Only states that actually contain a conditional Aura source need the extra
 * post-transition refresh; ordinary games preserve their pre-2.5 behavior.
 */
function hasConditionalAuraSource(state: GameState): boolean {
  for (const pid of ["player", "ai"] as PlayerId[]) {
    const player = state.players[pid];
    for (const instance of player.bench) {
      if (getCard(instance.defId).aura?.condition) return true;
    }
    for (const instance of player.permanents) {
      if (getCard(instance.defId).aura?.condition) return true;
    }
    for (const instance of player.sentinelas) {
      if (getCard(instance.defId).aura?.condition) return true;
    }
  }
  return false;
}

/** onAttack triggers can change board/Nexus state before blockers exist. */
export function declareAttack(
  state: GameState,
  playerId: PlayerId,
  attackerIds: string[],
  challenges?: Record<string, string>,
  sentinelaTargets?: Record<string, string>,
): GameState {
  const hadConditionalAura = hasConditionalAuraSource(state);
  const next = base.declareAttack(state, playerId, attackerIds, challenges, sentinelaTargets);
  if (next !== state && (hadConditionalAura || hasConditionalAuraSource(next))) {
    recomputeContinuousAuras(next);
  }
  return next;
}

/** Mana refresh, fatigue and round-start state may toggle Aura 2.5 conditions. */
export function endTurn(state: GameState, playerId: PlayerId): GameState {
  const hadConditionalAura = hasConditionalAuraSource(state);
  const next = base.endTurn(state, playerId);
  if (next !== state && (hadConditionalAura || hasConditionalAuraSource(next))) {
    recomputeContinuousAuras(next);
  }
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
 * Structure is stored as Artifact for backwards-compatible persistence. Legacy
 * Unit/Permanent/Equipment play already converges through cleanupDead(), which
 * recomputes Auras. Sentinela is the only legacy play path that needs an extra
 * refresh when its own Aura enters or when paying its mana can toggle another
 * conditional Aura.
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
    const hadConditionalAura = hasConditionalAuraSource(state);
    const next = base.playUnit(state, playerId, instanceId, targetInstanceId);
    if (
      next !== state &&
      def.type === "Sentinela" &&
      (Boolean(def.aura) || hadConditionalAura || hasConditionalAuraSource(next))
    ) {
      recomputeContinuousAuras(next);
    }
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
  checkWin(s);
  return s;
}