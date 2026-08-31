import { getCard } from "./cards";
import {
  canBlock,
  isValidTarget,
  reactionActivatedAbilitiesForInstance,
  resolveActivatedAbilityChoice,
  spellNeedsTarget,
  validateActivatedAbilityActivation,
} from "./engine";
import type { GameAction } from "./reducer";
import type { BoardEntity, GameState, PlayerId } from "./types";

export interface ActionValidationResult {
  ok: boolean;
  reason?: string;
}

function fail(reason: string): ActionValidationResult { return { ok: false, reason }; }
function ok(): ActionValidationResult { return { ok: true }; }
function unique(values: string[]): boolean { return new Set(values).size === values.length; }

export function assertInstanceExists(state: GameState, instanceId: string, zones: Array<"hand" | "bench" | "permanents" | "sentinelas"> = ["hand", "bench", "permanents", "sentinelas"]): void {
  for (const owner of ["player", "ai"] as PlayerId[]) {
    const p = state.players[owner];
    if (zones.includes("hand") && p.hand.some((x) => x.instanceId === instanceId)) return;
    if (zones.includes("bench") && p.bench.some((x) => x.instanceId === instanceId)) return;
    if (zones.includes("permanents") && p.permanents.some((x) => x.instanceId === instanceId)) return;
    if (zones.includes("sentinelas") && p.sentinelas.some((x) => x.instanceId === instanceId)) return;
  }
  throw new Error(`Unknown game instance: ${instanceId}`);
}

function findBoardEntity(state: GameState, instanceId: string): BoardEntity | null {
  for (const owner of ["player", "ai"] as PlayerId[]) {
    const unit = state.players[owner].bench.find((x) => x.instanceId === instanceId);
    if (unit) return { kind: "unit", unit, owner };
    const perm = state.players[owner].permanents.find((x) => x.instanceId === instanceId);
    if (perm) return { kind: "permanent", perm, owner };
    const sen = state.players[owner].sentinelas.find((x) => x.instanceId === instanceId);
    if (sen) return { kind: "sentinela", sen, owner };
  }
  return null;
}

function validateCardTarget(state: GameState, actor: PlayerId, defId: string, target?: string): ActionValidationResult {
  const needed = spellNeedsTarget(defId);
  if (!needed) return target ? fail("card does not accept an explicit target") : ok();
  if (needed === "spellOnStack") return ok();
  if (!target) return fail(`card requires ${needed} target`);
  const entity = findBoardEntity(state, target);
  if (!entity) return fail("target instance does not exist");
  return isValidTarget(state, actor, needed, entity) ? ok() : fail(`invalid ${needed} target`);
}

function validateReactionAbilityAction(state: GameState, action: Extract<GameAction, { type: "react" }>, actor: PlayerId): ActionValidationResult {
  if (action.responseKind !== "activatedAbility") return fail("reaction action is not a battlefield activation");
  if (!Number.isInteger(action.abilityIndex) || (action.abilityIndex ?? -1) < 0) return fail("reaction ability requires a valid abilityIndex");
  const abilities = reactionActivatedAbilitiesForInstance(state, actor, action.instanceId);
  const ability = abilities[action.abilityIndex!];
  if (!ability) return fail("reaction ability source/index does not exist for actor");

  if (action.modeId !== undefined && (action.modeId.length === 0 || action.modeId.length > 64 || action.modeId.trim() !== action.modeId)) {
    return fail("reaction ability modeId must be a non-empty string of at most 64 characters");
  }
  const resolved = resolveActivatedAbilityChoice(ability, action.modeId);
  if (!resolved.ok) return fail(resolved.reason);

  const discardIds = action.costDiscardInstanceIds;
  if (discardIds !== undefined && (
    discardIds.length > 10 ||
    !unique(discardIds) ||
    discardIds.some((id) => typeof id !== "string" || id.length === 0 || id.length > 128 || id.trim() !== id)
  )) return fail("reaction ability discard ids must be unique non-empty instance ids");
  const requiredDiscard = ability.cost?.discardFromHand ?? 0;
  if ((discardIds?.length ?? 0) !== requiredDiscard) return fail("reaction ability discard selection count does not match cost");
  const handIds = new Set(state.players[actor].hand.map((card) => card.instanceId));
  if (discardIds?.some((id) => !handIds.has(id))) return fail("reaction ability discard selection references card outside actor hand");

  const targetKind = resolved.choice.effect.target;
  if (targetKind === "spellOnStack") {
    if (!action.target) return fail("stack-targeted reaction ability requires pending action id");
    return ok();
  }
  if (!["none", "self"].includes(targetKind)) {
    if (!action.target) return fail("reaction ability requires an explicit target");
    const entity = findBoardEntity(state, action.target);
    if (!entity) return fail("reaction ability target does not exist");
    return isValidTarget(state, actor, targetKind, entity) ? ok() : fail("invalid reaction ability target");
  }
  return action.target ? fail("reaction ability does not accept an explicit target") : ok();
}

/**
 * Strict semantic validation for client-supplied GameAction values.
 * This complements turn/phase authorization by validating referenced instances,
 * duplicate ids, blocker legality, target ownership, activated-ability sources and mulligan ids.
 */
export function validateGameActionSemantics(state: GameState, action: GameAction, actor: PlayerId): ActionValidationResult {
  try {
    if (action.type === "aiStep" || action.type === "resolve") return fail(`${action.type} is server-only`);

    if ("player" in action && action.player !== actor) return fail("action player does not match authenticated actor");

    if (action.type === "react" && action.responseKind === "activatedAbility") {
      return validateReactionAbilityAction(state, action, actor);
    }

    if (action.type === "play" || action.type === "cast" || action.type === "react") {
      const inst = state.players[actor].hand.find((x) => x.instanceId === action.instanceId);
      if (!inst) return fail("card instance is not in actor hand");
      const def = getCard(inst.defId);
      if (action.type === "cast" || action.type === "react") {
        if (def.type !== "Spell") return fail(`${action.type} requires a Spell card`);
      }
      if (def.type === "Equipment" && action.target) {
        const target = state.players[actor].bench.find((x) => x.instanceId === action.target);
        if (!target) return fail("equipment target must be an allied unit");
        if (target.equipment.length >= 2) return fail("equipment target has no free slot");
      }
      if (def.type === "Spell") return validateCardTarget(state, actor, inst.defId, action.target);
      return ok();
    }

    if (action.type === "attack") {
      if (!action.attackerIds.length) return fail("attack requires at least one attacker");
      if (!unique(action.attackerIds)) return fail("duplicate attacker instance ids are forbidden");
      if (state.attackToken !== actor || state.hasAttackedThisTurn) return fail("actor does not currently own an unused attack token");
      const attackers = action.attackerIds.map((id) => state.players[actor].bench.find((u) => u.instanceId === id));
      if (attackers.some((u) => !u)) return fail("attacker instance does not exist on actor bench");
      if (attackers.some((u) => u && (u.stunned || u.hasAttackedThisTurn || (u.summonedThisTurn && !u.keywords.includes("Haste"))))) return fail("attacker is not ready to attack");
      const defender = actor === "player" ? "ai" : "player";
      const challengeEntries = Object.entries(action.challenges ?? {});
      for (const [attackerId, blockerId] of challengeEntries) {
        if (!action.attackerIds.includes(attackerId)) return fail("challenge references a non-attacking unit");
        const attacker = state.players[actor].bench.find((u) => u.instanceId === attackerId);
        const blocker = state.players[defender].bench.find((u) => u.instanceId === blockerId);
        if (!attacker || !blocker) return fail("challenge references a missing unit");
        if (!attacker.keywords.includes("Challenger")) return fail("challenge requires Challenger keyword");
        if (!canBlock(attacker, blocker)) return fail("challenged unit cannot legally block attacker");
      }
      const challengedBlockers = challengeEntries.map(([, id]) => id);
      if (!unique(challengedBlockers)) return fail("one blocker cannot be challenged by multiple attackers");
      for (const [attackerId, sentinelaId] of Object.entries(action.sentinelaTargets ?? {})) {
        if (!action.attackerIds.includes(attackerId)) return fail("sentinela target references a non-attacking unit");
        if (!state.players[defender].sentinelas.some((s) => s.instanceId === sentinelaId)) return fail("sentinela target does not exist");
      }
      return ok();
    }

    if (action.type === "block") {
      if (state.phase !== "blocking" || !state.combat) return fail("no combat is waiting for blockers");
      const defender = actor;
      const attackerOwner = state.combat.attackerId;
      if (defender === attackerOwner) return fail("attacker cannot submit blockers");
      const used = new Set<string>();
      for (const [attackerId, blockerId] of Object.entries(action.blocks)) {
        const attacker = state.players[attackerOwner].bench.find((u) => u.instanceId === attackerId && u.isAttacking);
        const blocker = state.players[defender].bench.find((u) => u.instanceId === blockerId);
        if (!attacker) return fail("block references a non-attacking or missing attacker");
        if (state.combat.locked.includes(attackerId) && state.combat.blocks[attackerId] !== blockerId) return fail("challenger-locked block cannot be reassigned");
        if (!blocker) return fail("blocker instance is not on defender bench");
        if (used.has(blockerId)) return fail("one blocker cannot block multiple attackers");
        if (!canBlock(attacker, blocker)) return fail("illegal blocker for attacker");
        used.add(blockerId);
      }
      return ok();
    }

    if (action.type === "sentinela") {
      const rawModeId = (action as typeof action & { modeId?: unknown }).modeId;
      if (rawModeId !== undefined && (typeof rawModeId !== "string" || rawModeId.length === 0 || rawModeId.length > 64 || rawModeId.trim() !== rawModeId)) {
        return fail("activated ability modeId must be a non-empty string of at most 64 characters");
      }
      const rawDiscardIds = (action as typeof action & { costDiscardInstanceIds?: unknown }).costDiscardInstanceIds;
      if (rawDiscardIds !== undefined && (
        !Array.isArray(rawDiscardIds) ||
        rawDiscardIds.length > 10 ||
        rawDiscardIds.some((id) => typeof id !== "string" || id.length === 0 || id.length > 128 || id.trim() !== id)
      )) {
        return fail("activated ability costDiscardInstanceIds must be an array of at most 10 non-empty instance ids");
      }
      const modeId = typeof rawModeId === "string" ? rawModeId : undefined;
      const costDiscardInstanceIds = Array.isArray(rawDiscardIds) ? rawDiscardIds as string[] : undefined;
      const validation = validateActivatedAbilityActivation(
        state,
        actor,
        action.sentinelaId,
        action.abilityIndex,
        action.target,
        modeId,
        costDiscardInstanceIds,
      );
      if (!validation.ok) return fail(validation.reason ?? "activated ability cannot be used");
      const targetKind = validation.effect?.target;
      const requiresTarget = targetKind !== undefined && !["none", "self", "spellOnStack"].includes(targetKind);
      if (requiresTarget && !action.target) return fail("activated ability requires an explicit client target");
      return ok();
    }

    if (action.type === "mulligan") {
      if (!unique(action.cardIds)) return fail("duplicate mulligan ids are forbidden");
      const handIds = new Set(state.players[actor].hand.map((c) => c.instanceId));
      if (action.cardIds.some((id) => !handIds.has(id))) return fail("mulligan references card outside actor hand");
      return ok();
    }

    if (action.type === "skipMulligan" || action.type === "pass") return ok();
    return fail("unsupported action");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "semantic validation failed");
  }
}