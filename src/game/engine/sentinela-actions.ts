import { getCard } from "../cards";
import type { GameState, PlayerId } from "../types";
import { checkWin, clone, findSentinela } from "./state";
import { cleanupSentinelas } from "./sentinela-state";
import { activateAbility, canBeginActivateAbility } from "./activated-actions";

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
 * Compatibilidade pública com o contrato 2.96/2.97 de Sentinelas.
 * A regra agora é executada pelo sistema genérico de habilidades ativadas.
 */
export function canActivateSentinela(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  abilityIndex: number,
): boolean {
  return canBeginActivateAbility(state, playerId, instanceId, abilityIndex);
}

/**
 * Compatibilidade pública com o contrato legado. Mantemos o nome para não
 * quebrar replays/clientes, mas a execução é única em activateAbility().
 */
export function activateSentinelaAbility(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  abilityIndex: number,
  targetInstanceId?: string,
): GameState {
  return activateAbility(state, playerId, instanceId, abilityIndex, targetInstanceId);
}
