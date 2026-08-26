import { getCard } from "../cards";
import type { GameState, PlayerId } from "../types";
import { checkWin, clone, findSentinela } from "./state";
import { applyEffect, checkLevelUps, cleanupDead } from "./effects";
import { cleanupSentinelas } from "./sentinela-state";

/** Aplica dano a uma sentinela (reduz lealdade). */
export function damageSentinela(state: GameState, targetId: string, amount: number): GameState {
  if (amount <= 0) return state;
  const s = clone(state);
  const found = findSentinela(s, targetId);
  if (!found) return state;
  found.sen.loyalty -= amount;
  s.log.push(`${getCard(found.sen.defId).name} perde ${amount} de Lealdade.`);
  cleanupSentinelas(s);
  checkWin(s);
  return s;
}

/**
 * Verifica se uma habilidade de sentinela pode ser ativada agora.
 * Regras: fase main, turno do dono, habilidade ainda não ativada este turno,
 * lealdade suficiente para custos negativos.
 */
export function canActivateSentinela(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  abilityIndex: number,
): boolean {
  if (state.phase !== "main" || state.activePlayer !== playerId) return false;
  const found = findSentinela(state, instanceId);
  if (!found || found.owner !== playerId) return false;
  if (found.sen.activatedThisTurn) return false;
  const def = getCard(found.sen.defId);
  const ability = def.sentinela?.abilities[abilityIndex];
  if (!ability) return false;
  if (ability.cost < 0 && found.sen.loyalty < -ability.cost) return false;
  return true;
}

/**
 * Ativa uma habilidade de sentinela, aplicando o custo de lealdade e o efeito.
 * Retorna o mesmo estado se a ativação for inválida.
 */
export function activateSentinelaAbility(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  abilityIndex: number,
  targetInstanceId?: string,
): GameState {
  if (!canActivateSentinela(state, playerId, instanceId, abilityIndex)) return state;
  const s = clone(state);
  const found = findSentinela(s, instanceId)!;
  const def = getCard(found.sen.defId);
  const ability = def.sentinela!.abilities[abilityIndex];

  found.sen.loyalty += ability.cost;
  found.sen.activatedThisTurn = true;
  s.log.push(`${def.name} ativa "${ability.description}".`);

  // Habilidades com alvo exigem targetInstanceId.
  const needsTarget =
    ability.effect.target !== "none" &&
    ability.effect.target !== "self" &&
    ability.effect.target !== "spellOnStack";
  applyEffect(s, playerId, ability.effect, needsTarget ? targetInstanceId : undefined);

  // Sentinela abilities can deal lethal damage or destroy units. Resolve deaths
  // immediately so the authoritative state never exposes zero-health corpses.
  cleanupDead(s);
  cleanupSentinelas(s);
  checkLevelUps(s);
  checkWin(s);
  return s;
}

/** Reset da flag activatedThisTurn no início de cada rodada. */
