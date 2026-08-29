import { getCard } from "../cards";
import type { GameState, PlayerId } from "../types";
import { checkWin, clone, findSentinela } from "./state";
import { cleanupSentinelas } from "./sentinela-state";
import { activateAbility } from "./activated-actions";

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
 *
 * Historicamente esta função responde somente se a habilidade pode ser
 * iniciada quanto a fase, dono, uso e lealdade; ela nunca exigiu que o caller
 * já tivesse escolhido um alvo. A UI genérica usa canBeginActivateAbility(),
 * que é deliberadamente mais estrita e só habilita habilidades direcionadas
 * quando existe ao menos um alvo legal.
 */
export function canActivateSentinela(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  abilityIndex: number,
): boolean {
  if (state.phase !== "main" || state.activePlayer !== playerId) return false;
  const found = findSentinela(state, instanceId);
  if (!found || found.owner !== playerId || found.sen.activatedThisTurn) return false;
  const ability = getCard(found.sen.defId).sentinela?.abilities[abilityIndex];
  if (!ability) return false;
  if (ability.cost < 0 && found.sen.loyalty < -ability.cost) return false;
  return true;
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
