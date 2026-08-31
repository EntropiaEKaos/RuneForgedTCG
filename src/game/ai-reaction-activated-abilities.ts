import { getCard } from "./cards";
import { resolveActivatedAbilityChoice } from "./engine/activated-actions";
import { isValidTarget } from "./engine/actions";
import {
  canReactWithActivatedAbilityAction,
  reactionActivatedAbilityOptions,
  reactionActivatedAbilitiesForInstance,
  type PendingReactionActionContext,
  type ReactionActivatedAbilityAction,
} from "./reaction-activated-abilities";
import type { BoardEntity, GameState, PlayerId, TargetKind } from "./types";

function entityId(entity: BoardEntity): string {
  if (entity.kind === "unit") return entity.unit.instanceId;
  if (entity.kind === "permanent") return entity.perm.instanceId;
  return entity.sen.instanceId;
}

function boardEntities(state: GameState): BoardEntity[] {
  const entities: BoardEntity[] = [];
  for (const owner of ["player", "ai"] as PlayerId[]) {
    for (const unit of state.players[owner].bench) entities.push({ kind: "unit", owner, unit });
    for (const perm of state.players[owner].permanents) entities.push({ kind: "permanent", owner, perm });
    for (const sen of state.players[owner].sentinelas) entities.push({ kind: "sentinela", owner, sen });
  }
  return entities;
}

function targetFor(
  state: GameState,
  playerId: PlayerId,
  targetKind: TargetKind,
  pending: PendingReactionActionContext,
): string | undefined {
  if (targetKind === "spellOnStack") return pending.instanceId;
  if (targetKind === "none" || targetKind === "self") return undefined;
  return boardEntities(state)
    .filter((entity) => isValidTarget(state, playerId, targetKind, entity))
    .sort((a, b) => entityId(a).localeCompare(entityId(b)))[0]
    ? entityId(boardEntities(state)
        .filter((entity) => isValidTarget(state, playerId, targetKind, entity))
        .sort((a, b) => entityId(a).localeCompare(entityId(b)))[0])
    : undefined;
}

function discardIds(state: GameState, playerId: PlayerId, count: number): string[] | undefined {
  if (count <= 0) return undefined;
  if (state.players[playerId].hand.length < count) return undefined;
  return [...state.players[playerId].hand]
    .sort((a, b) => {
      const costDelta = getCard(a.defId).cost - getCard(b.defId).cost;
      return costDelta !== 0 ? costDelta : a.instanceId.localeCompare(b.instanceId);
    })
    .slice(0, count)
    .map((card) => card.instanceId);
}

function effectScore(kind: string): number {
  if (kind === "negateSpell") return 100;
  if (kind === "grantBarrier") return 70;
  if (kind === "killUnit" || kind === "destroyPermanent") return 65;
  if (kind === "damageUnit" || kind === "damagePermanent" || kind === "aoeEnemy") return 55;
  if (kind === "healUnit" || kind === "healNexus") return 45;
  if (kind === "buffUnit" || kind === "buffSelf" || kind === "grantKeyword") return 35;
  if (kind === "draw") return 30;
  return 20;
}

/**
 * Choose one exact battlefield response. All payload details (mode, target and
 * selected discard ids) are resolved before returning, then revalidated by the
 * same authority used by stack insertion.
 */
export function aiChooseReactionActivatedAbilityAction(
  state: GameState,
  pendingAction: PendingReactionActionContext,
  playerId: PlayerId = "ai",
): ReactionActivatedAbilityAction | null {
  const candidates: Array<{ action: ReactionActivatedAbilityAction; score: number; stable: string }> = [];
  for (const option of reactionActivatedAbilityOptions(state, playerId, pendingAction)) {
    const ability = reactionActivatedAbilitiesForInstance(state, playerId, option.sourceInstanceId)[option.abilityIndex];
    if (!ability) continue;
    const resolved = resolveActivatedAbilityChoice(ability, option.modeId);
    if (!resolved.ok) continue;
    const targetInstanceId = targetFor(state, playerId, resolved.choice.effect.target, pendingAction);
    if (!["none", "self"].includes(resolved.choice.effect.target) && !targetInstanceId) continue;
    const costDiscardInstanceIds = discardIds(state, playerId, ability.cost?.discardFromHand ?? 0);
    if ((ability.cost?.discardFromHand ?? 0) > 0 && !costDiscardInstanceIds) continue;

    const action: ReactionActivatedAbilityAction = {
      kind: "sentinela",
      responseKind: "activatedAbility",
      player: playerId,
      instanceId: option.sourceInstanceId,
      defId: option.defId,
      abilityIndex: option.abilityIndex,
      ...(targetInstanceId ? { targetInstanceId } : {}),
      ...(option.modeId ? { modeId: option.modeId } : {}),
      ...(costDiscardInstanceIds ? { costDiscardInstanceIds } : {}),
    };
    if (!canReactWithActivatedAbilityAction(state, playerId, action, pendingAction)) continue;

    const resourcePenalty =
      (ability.cost?.mana ?? 0) * 2 +
      (ability.cost?.spellMana ?? 0) * 2 +
      (ability.cost?.nexusHealth ?? 0) * 3 +
      (ability.cost?.discardFromHand ?? 0) * 5 +
      (ability.cost?.sacrificeSelf ? 12 : 0) +
      (ability.cost?.consumeBarrier ? 6 : 0);
    candidates.push({
      action,
      score: effectScore(resolved.choice.effect.kind) - resourcePenalty,
      stable: `${option.sourceInstanceId}:${option.abilityIndex}:${option.modeId ?? ""}:${targetInstanceId ?? ""}`,
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.stable.localeCompare(b.stable));
  return candidates[0]?.action ?? null;
}
