import { getCard } from "./cards";
import { canBlock, isValidTarget, spellNeedsTarget, validateActivatedAbilityActivation } from "./engine";
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
  if (needed === "spellOnStack") return ok(); // reaction stack target is represented by protocol state, not board id.
  if (!target) return fail(`card requires ${needed} target`);
  const entity = findBoardEntity(state, target);
  if (!entity) return fail("target instance does not exist");
  return isValidTarget(state, actor, needed, entity) ? ok() : fail(`invalid ${needed} target`);
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

    if (action.type === "play" || action.type === "cast" || action.type === "react") {
      const inst = state.players[actor].hand.find((x) => x.instanceId === action.instanceId);
      if (!inst) return fail("card instance is not in actor hand");
      const def = getCard(inst.defId);
      if (action.type === "cast" || action.type === "react") {
        if (def.type !== "Spell") return fail(`${action.type} requires a Spell card`);
      }
      if (action.type === "play" && def.type === "Spell") {
        // Existing clients may use play for spells; preserve compatibility while still validating targets.
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
      // Backwards-compatible opcode: `sentinela` now means "activate a board
      // ability". Legacy Sentinelas keep identical ids/indexes while Units,
      // Artifacts and Enchantments can use the same authoritative transport.
      const validation = validateActivatedAbilityActivation(
        state,
        actor,
        action.sentinelaId,
        action.abilityIndex,
        action.target,
      );
      return validation.ok ? ok() : fail(validation.reason ?? "activated ability cannot be used");
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
