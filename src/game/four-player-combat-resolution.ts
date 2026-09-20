import {
  applyFourPlayerBattlefieldDamage,
  createFourPlayerBattlefieldState,
  findFourPlayerBattlefieldObject,
  type FourPlayerBattlefieldObject,
  type FourPlayerBattlefieldState,
} from "./four-player-battlefield";
import {
  createFourPlayerCombatState,
  type FourPlayerCombatResolutionCursor,
} from "./four-player-combat";
import type { FourPlayerEffectZoneAction } from "./four-player-effect-resolution";
import { moveGeneralFromBattlefield } from "./four-player-general-zone";
import {
  FOUR_PLAYER_POISON_LETHAL,
  FOUR_PLAYER_STARTING_LIFE,
  eliminateFourPlayerMatchSeat,
  type FourPlayerMatchState,
  updateMatchGeneral,
} from "./four-player-match";
import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";

export type FourPlayerCombatDestination = "graveyard" | "general_zone" | "none";

export interface FourPlayerCombatDestroyedObject {
  id: string;
  defId: string;
  ownerSeat: FourPlayerSeat;
  kind: FourPlayerBattlefieldObject["kind"];
  destination: FourPlayerCombatDestination;
  killerId?: string;
}

export interface FourPlayerCombatImpact {
  source: FourPlayerBattlefieldObject;
  kind: "strike" | "nexus_strike";
  targetObjectId?: string;
  targetSeat?: FourPlayerSeat;
}

export interface FourPlayerCombatResolutionResult {
  match: FourPlayerMatchState;
  destroyed: readonly FourPlayerCombatDestroyedObject[];
  nexusDamage: Partial<Record<FourPlayerSeat, number>>;
  poisonAdded: Partial<Record<FourPlayerSeat, number>>;
  healing: Partial<Record<FourPlayerSeat, number>>;
  zoneActions: readonly FourPlayerEffectZoneAction[];
}

export interface FourPlayerCombatStepResult extends FourPlayerCombatResolutionResult {
  completed: boolean;
  impacts: readonly FourPlayerCombatImpact[];
  triggerSourceMatch?: FourPlayerMatchState;
}

interface NexusHit {
  target: FourPlayerSeat;
  amount: number;
  sourceController: FourPlayerSeat;
  sourceGeneral?: FourPlayerSeat;
  poisonous: boolean;
}

function livingBody(state: FourPlayerBattlefieldState, id: string): FourPlayerBattlefieldObject | undefined {
  const object = state.objects.find((entry) => entry.id === id);
  return object?.combat && object.combat.health > 0 ? object : undefined;
}

function snapshotCombatObject(object: FourPlayerBattlefieldObject): FourPlayerBattlefieldObject {
  return {
    ...object,
    ...(object.combat ? { combat: { ...object.combat } } : {}),
    ...(object.durability ? { durability: { ...object.durability } } : {}),
    ...(object.equipment ? { equipment: object.equipment.map((entry) => ({ ...entry, keywords: [...entry.keywords] })) } : {}),
    keywords: [...object.keywords],
  };
}

function effectivePower(object: FourPlayerBattlefieldObject): number {
  if (!object.combat) return 0;
  return object.combat.frostbitten ? 0 : Math.max(0, object.combat.power);
}

function markEphemeralDead(
  state: FourPlayerBattlefieldState,
  sourceId: string,
): FourPlayerBattlefieldState {
  const source = state.objects.find((entry) => entry.id === sourceId);
  if (!source?.combat || !source.keywords.includes("Ephemeral") || source.combat.health <= 0) return state;
  return {
    objects: state.objects.map((entry) => entry.id === sourceId
      ? { ...entry, combat: { ...entry.combat!, health: 0 } }
      : entry),
  };
}

function addAmount(
  target: Partial<Record<FourPlayerSeat, number>>,
  seat: FourPlayerSeat,
  amount: number,
): void {
  if (amount <= 0) return;
  target[seat] = (target[seat] ?? 0) + amount;
}

function strikeBattlefieldObject(
  state: FourPlayerBattlefieldState,
  sourceId: string,
  targetId: string,
  allowOverwhelm: boolean,
): {
  state: FourPlayerBattlefieldState;
  overflow: number;
  healing: number;
  killed: boolean;
  source: FourPlayerBattlefieldObject;
} {
  const source = findFourPlayerBattlefieldObject(state, sourceId);
  const target = findFourPlayerBattlefieldObject(state, targetId);
  if (!source.combat || source.combat.health <= 0) return { state, overflow: 0, healing: 0, killed: false, source };
  if (!target.combat || target.combat.health <= 0) return { state, overflow: 0, healing: 0, killed: false, source };

  const power = effectivePower(source);
  const targetHealthBefore = target.combat.health;
  const damaged = applyFourPlayerBattlefieldDamage(state, targetId, power, sourceId);
  const targetAfter = findFourPlayerBattlefieldObject(damaged.state, targetId);
  let overflow = 0;

  if (allowOverwhelm && source.keywords.includes("Overwhelm") && power > 0 && !damaged.barrierConsumed) {
    if (source.keywords.includes("Deathtouch") && damaged.damageDealt > 0) {
      overflow = Math.max(0, power - Math.min(1, targetHealthBefore));
    } else {
      overflow = Math.max(0, damaged.damageDealt - targetHealthBefore);
    }
  }

  const healing = source.keywords.includes("Lifesteal")
    ? damaged.damageDealt + overflow
    : 0;
  return {
    state: markEphemeralDead(damaged.state, sourceId),
    overflow,
    healing,
    killed: targetHealthBefore > 0 && Boolean(targetAfter.combat && targetAfter.combat.health <= 0),
    source: snapshotCombatObject(source),
  };
}

function simultaneousBattlefieldExchange(
  state: FourPlayerBattlefieldState,
  attackerId: string,
  blockerId: string,
): {
  state: FourPlayerBattlefieldState;
  overflow: number;
  attackerHealing: number;
  blockerHealing: number;
  attackerKilledBlocker: boolean;
  blockerKilledAttacker: boolean;
  attacker: FourPlayerBattlefieldObject;
  blocker: FourPlayerBattlefieldObject;
} {
  const attacker = findFourPlayerBattlefieldObject(state, attackerId);
  const blocker = findFourPlayerBattlefieldObject(state, blockerId);
  if (!attacker.combat || attacker.combat.health <= 0 || !blocker.combat || blocker.combat.health <= 0) {
    return {
      state, overflow: 0, attackerHealing: 0, blockerHealing: 0,
      attackerKilledBlocker: false, blockerKilledAttacker: false, attacker, blocker,
    };
  }

  const attackerPower = effectivePower(attacker);
  const blockerPower = effectivePower(blocker);
  const attackerHealthBefore = attacker.combat.health;
  const blockerHealthBefore = blocker.combat.health;

  const attackerStrike = applyFourPlayerBattlefieldDamage(state, blockerId, attackerPower, attackerId);
  const blockerStrike = applyFourPlayerBattlefieldDamage(state, attackerId, blockerPower, blockerId);

  let overflow = 0;
  if (attacker.keywords.includes("Overwhelm") && attackerPower > 0 && !attackerStrike.barrierConsumed) {
    if (attacker.keywords.includes("Deathtouch") && attackerStrike.damageDealt > 0) {
      overflow = Math.max(0, attackerPower - Math.min(1, blockerHealthBefore));
    } else {
      overflow = Math.max(0, attackerStrike.damageDealt - blockerHealthBefore);
    }
  }

  const attackerAfter = findFourPlayerBattlefieldObject(blockerStrike.state, attackerId);
  const blockerAfter = findFourPlayerBattlefieldObject(attackerStrike.state, blockerId);
  let merged: FourPlayerBattlefieldState = {
    objects: state.objects.map((object) => {
      if (object.id === attackerId) return { ...attackerAfter };
      if (object.id === blockerId) return { ...blockerAfter };
      return object;
    }),
  };
  merged = markEphemeralDead(merged, attackerId);
  merged = markEphemeralDead(merged, blockerId);

  return {
    state: merged,
    overflow,
    attackerHealing: attacker.keywords.includes("Lifesteal") ? attackerStrike.damageDealt + overflow : 0,
    blockerHealing: blocker.keywords.includes("Lifesteal") ? blockerStrike.damageDealt : 0,
    attackerKilledBlocker: blockerHealthBefore > 0 && Boolean(blockerAfter.combat && blockerAfter.combat.health <= 0),
    blockerKilledAttacker: attackerHealthBefore > 0 && Boolean(attackerAfter.combat && attackerAfter.combat.health <= 0),
    attacker: snapshotCombatObject(attacker),
    blocker: snapshotCombatObject(blocker),
  };
}

function directStrike(
  state: FourPlayerBattlefieldState,
  sourceId: string,
  defendingSeat: FourPlayerSeat,
): {
  state: FourPlayerBattlefieldState;
  hit: NexusHit;
  healing: number;
  source: FourPlayerBattlefieldObject;
} {
  const source = findFourPlayerBattlefieldObject(state, sourceId);
  if (!source.combat || source.combat.health <= 0) throw new Error(`4P direct strike source ${sourceId} is not alive.`);
  const amount = effectivePower(source);
  const hit: NexusHit = {
    target: defendingSeat,
    amount,
    sourceController: source.controllerSeat,
    ...(source.kind === "general" ? { sourceGeneral: source.ownerSeat } : {}),
    poisonous: source.keywords.includes("Poisonous"),
  };
  const healing = source.keywords.includes("Lifesteal") ? amount : 0;
  return {
    state: markEphemeralDead(state, sourceId),
    hit,
    healing,
    source: snapshotCombatObject(source),
  };
}

function destinationFor(object: FourPlayerBattlefieldObject): FourPlayerCombatDestination {
  if (object.kind === "general") return "general_zone";
  if (object.kind === "token") return "none";
  return "graveyard";
}

function applySeatTotals(
  match: FourPlayerMatchState,
  damage: Partial<Record<FourPlayerSeat, number>>,
  generalDamage: Partial<Record<FourPlayerSeat, Partial<Record<FourPlayerSeat, number>>>>,
  poison: Partial<Record<FourPlayerSeat, number>>,
  healing: Partial<Record<FourPlayerSeat, number>>,
): FourPlayerMatchState {
  let next = match;
  for (const seat of FOUR_PLAYER_SEATS) {
    const current = next.seats[seat];
    const hurt = damage[seat] ?? 0;
    const healed = healing[seat] ?? 0;
    const poisonAdded = poison[seat] ?? 0;
    const life = Math.min(FOUR_PLAYER_STARTING_LIFE, Math.max(0, current.life - hurt) + healed);
    const ledger = { ...current.generalDamageReceived };
    for (const [source, amount] of Object.entries(generalDamage[seat] ?? {})) {
      if (!amount) continue;
      const sourceSeat = source as FourPlayerSeat;
      ledger[sourceSeat] = (ledger[sourceSeat] ?? 0) + amount;
    }
    next = {
      ...next,
      seats: {
        ...next.seats,
        [seat]: {
          ...current,
          life,
          poisonCounters: current.poisonCounters + poisonAdded,
          generalDamageReceived: ledger,
        },
      },
    };
  }

  for (const seat of FOUR_PLAYER_SEATS) {
    const state = next.seats[seat];
    if (!state.eliminated && (state.life <= 0 || state.poisonCounters >= FOUR_PLAYER_POISON_LETHAL)) {
      next = eliminateFourPlayerMatchSeat(next, seat);
    }
  }
  return next;
}

function applyNexusHit(
  match: FourPlayerMatchState,
  hit: NexusHit,
  healingAmount: number,
): {
  match: FourPlayerMatchState;
  nexusDamage: Partial<Record<FourPlayerSeat, number>>;
  poisonAdded: Partial<Record<FourPlayerSeat, number>>;
  healing: Partial<Record<FourPlayerSeat, number>>;
} {
  const nexusDamage: Partial<Record<FourPlayerSeat, number>> = {};
  const poisonAdded: Partial<Record<FourPlayerSeat, number>> = {};
  const healing: Partial<Record<FourPlayerSeat, number>> = {};
  const generalDamage: Partial<Record<FourPlayerSeat, Partial<Record<FourPlayerSeat, number>>>> = {};
  addAmount(nexusDamage, hit.target, hit.amount);
  if (hit.poisonous) addAmount(poisonAdded, hit.target, hit.amount);
  addAmount(healing, hit.sourceController, healingAmount);
  if (hit.sourceGeneral) {
    generalDamage[hit.target] = { [hit.sourceGeneral]: hit.amount };
  }
  return {
    match: applySeatTotals(match, nexusDamage, generalDamage, poisonAdded, healing),
    nexusDamage,
    poisonAdded,
    healing,
  };
}

function applyHealing(
  match: FourPlayerMatchState,
  healing: Partial<Record<FourPlayerSeat, number>>,
): FourPlayerMatchState {
  return applySeatTotals(match, {}, {}, {}, healing);
}

function cursorFor(match: FourPlayerMatchState): FourPlayerCombatResolutionCursor {
  return match.combat.resolution ?? {
    completedAttackerIds: [],
    stage: "start",
    killerByVictim: {},
  };
}

function setCursor(match: FourPlayerMatchState, cursor: FourPlayerCombatResolutionCursor): FourPlayerMatchState {
  return { ...match, combat: { ...match.combat, resolution: cursor } };
}

function completeAttacker(
  match: FourPlayerMatchState,
  cursor: FourPlayerCombatResolutionCursor,
  attackerId: string,
): FourPlayerMatchState {
  const completedAttackerIds = cursor.completedAttackerIds.includes(attackerId)
    ? cursor.completedAttackerIds
    : [...cursor.completedAttackerIds, attackerId];
  return setCursor(match, {
    completedAttackerIds,
    stage: "start",
    killerByVictim: cursor.killerByVictim,
  });
}

function recordKiller(
  cursor: FourPlayerCombatResolutionCursor,
  victimId: string,
  killerId: string,
): FourPlayerCombatResolutionCursor {
  return {
    ...cursor,
    killerByVictim: { ...cursor.killerByVictim, [victimId]: killerId },
  };
}

function finalizeCombat(match: FourPlayerMatchState, cursor: FourPlayerCombatResolutionCursor): FourPlayerCombatStepResult {
  const battlefield = match.battlefield ?? createFourPlayerBattlefieldState();
  const destroyedObjects = battlefield.objects.filter((object) => object.combat && object.combat.health <= 0);
  const destroyed: FourPlayerCombatDestroyedObject[] = destroyedObjects.map((object) => ({
    id: object.id,
    defId: object.defId,
    ownerSeat: object.ownerSeat,
    kind: object.kind,
    destination: destinationFor(object),
    ...(cursor.killerByVictim[object.id] ? { killerId: cursor.killerByVictim[object.id] } : {}),
  }));
  const zoneActions: FourPlayerEffectZoneAction[] = destroyedObjects.flatMap((object) =>
    (object.equipment ?? [])
      .filter((equipment) => equipment.physical)
      .map((equipment) => ({
        kind: "put_graveyard" as const,
        card: { instanceId: equipment.instanceId, defId: equipment.defId, ownerSeat: equipment.ownerSeat },
      })),
  );

  let nextMatch: FourPlayerMatchState = {
    ...match,
    battlefield: {
      objects: battlefield.objects.filter((object) => !destroyedObjects.some((dead) => dead.id === object.id)),
    },
    combat: createFourPlayerCombatState(match.turn.activeSeat, match.turn.eliminatedSeats),
  };

  for (const object of destroyedObjects) {
    if (object.kind !== "general") continue;
    const general = nextMatch.generals[object.ownerSeat];
    if (general.location === "battlefield") {
      nextMatch = updateMatchGeneral(
        nextMatch,
        object.ownerSeat,
        moveGeneralFromBattlefield(general, "graveyard", true),
      );
    }
  }

  return {
    match: nextMatch,
    destroyed,
    nexusDamage: {},
    poisonAdded: {},
    healing: {},
    zoneActions,
    completed: true,
    impacts: [],
    triggerSourceMatch: match,
  };
}

export function advanceFourPlayerCombatStep(match: FourPlayerMatchState): FourPlayerCombatStepResult {
  if (match.phase !== "combat") throw new Error("4P combat resolution requires the combat phase.");
  let current = match;

  for (let guard = 0; guard < 64; guard += 1) {
    let cursor = cursorFor(current);
    const battlefield = current.battlefield ?? createFourPlayerBattlefieldState();

    if (current.status === "completed") {
      return { match: current, destroyed: [], nexusDamage: {}, poisonAdded: {}, healing: {}, zoneActions: [], completed: true, impacts: [] };
    }

    if (cursor.stage === "start") {
      const assignment = current.combat.attackers.find((entry) => !cursor.completedAttackerIds.includes(entry.unitId));
      if (!assignment) return finalizeCombat(current, cursor);
      if (current.seats[assignment.defendingSeat].eliminated || !livingBody(battlefield, assignment.unitId)) {
        current = completeAttacker(current, cursor, assignment.unitId);
        continue;
      }

      const attacker = livingBody(battlefield, assignment.unitId)!;
      const block = current.combat.blockers.find((entry) => entry.attackerId === assignment.unitId);
      const blocker = block ? livingBody(battlefield, block.unitId) : undefined;

      if (!blocker) {
        const strike = directStrike(battlefield, attacker.id, assignment.defendingSeat);
        let next: FourPlayerMatchState = { ...current, battlefield: strike.state };
        const totals = applyNexusHit(next, strike.hit, strike.healing);
        next = totals.match;
        cursor = {
          ...cursor,
          stage: "after_unblocked_first",
          currentAttackerId: attacker.id,
        };
        next = setCursor(next, cursor);
        return {
          match: next,
          destroyed: [],
          nexusDamage: totals.nexusDamage,
          poisonAdded: totals.poisonAdded,
          healing: totals.healing,
          zoneActions: [],
          completed: false,
          impacts: [{ source: strike.source, kind: "nexus_strike", targetSeat: assignment.defendingSeat }],
        };
      }

      const fast = attacker.keywords.includes("QuickAttack") || attacker.keywords.includes("DoubleStrike");
      if (fast) {
        const strike = strikeBattlefieldObject(battlefield, attacker.id, blocker.id, true);
        let next: FourPlayerMatchState = { ...current, battlefield: strike.state };
        const healing: Partial<Record<FourPlayerSeat, number>> = {};
        addAmount(healing, attacker.controllerSeat, strike.healing);
        next = applyHealing(next, healing);
        if (strike.overflow > 0) {
          const overflow: NexusHit = {
            target: assignment.defendingSeat,
            amount: strike.overflow,
            sourceController: attacker.controllerSeat,
            ...(attacker.kind === "general" ? { sourceGeneral: attacker.ownerSeat } : {}),
            poisonous: attacker.keywords.includes("Poisonous"),
          };
          next = applyNexusHit(next, overflow, 0).match;
        }
        cursor = {
          ...cursor,
          ...(strike.killed ? { killerByVictim: { ...cursor.killerByVictim, [blocker.id]: attacker.id } } : {}),
          stage: "after_fast_first",
          currentAttackerId: attacker.id,
        };
        next = setCursor(next, cursor);
        return {
          match: next,
          destroyed: [],
          nexusDamage: strike.overflow > 0 ? { [assignment.defendingSeat]: strike.overflow } : {},
          poisonAdded: strike.overflow > 0 && attacker.keywords.includes("Poisonous") ? { [assignment.defendingSeat]: strike.overflow } : {},
          healing,
          zoneActions: [],
          completed: false,
          impacts: [{ source: strike.source, kind: "strike", targetObjectId: blocker.id }],
        };
      }

      const exchange = simultaneousBattlefieldExchange(battlefield, attacker.id, blocker.id);
      let next: FourPlayerMatchState = { ...current, battlefield: exchange.state };
      const healing: Partial<Record<FourPlayerSeat, number>> = {};
      addAmount(healing, attacker.controllerSeat, exchange.attackerHealing);
      addAmount(healing, blocker.controllerSeat, exchange.blockerHealing);
      next = applyHealing(next, healing);
      if (exchange.overflow > 0) {
        const overflow: NexusHit = {
          target: assignment.defendingSeat,
          amount: exchange.overflow,
          sourceController: attacker.controllerSeat,
          ...(attacker.kind === "general" ? { sourceGeneral: attacker.ownerSeat } : {}),
          poisonous: attacker.keywords.includes("Poisonous"),
        };
        next = applyNexusHit(next, overflow, 0).match;
      }
      if (exchange.attackerKilledBlocker) cursor = recordKiller(cursor, blocker.id, attacker.id);
      if (exchange.blockerKilledAttacker) cursor = recordKiller(cursor, attacker.id, blocker.id);
      next = completeAttacker(next, cursor, attacker.id);
      return {
        match: next,
        destroyed: [],
        nexusDamage: exchange.overflow > 0 ? { [assignment.defendingSeat]: exchange.overflow } : {},
        poisonAdded: exchange.overflow > 0 && attacker.keywords.includes("Poisonous") ? { [assignment.defendingSeat]: exchange.overflow } : {},
        healing,
        zoneActions: [],
        completed: false,
        impacts: [
          { source: exchange.attacker, kind: "strike", targetObjectId: blocker.id },
          { source: exchange.blocker, kind: "strike", targetObjectId: attacker.id },
        ],
      };
    }

    const attackerId = cursor.currentAttackerId;
    if (!attackerId) {
      current = setCursor(current, { ...cursor, stage: "start" });
      continue;
    }
    const assignment = current.combat.attackers.find((entry) => entry.unitId === attackerId);
    if (!assignment) {
      current = completeAttacker(current, cursor, attackerId);
      continue;
    }

    if (cursor.stage === "after_unblocked_first") {
      const attacker = livingBody(battlefield, attackerId);
      if (!attacker || !attacker.keywords.includes("DoubleStrike") || current.seats[assignment.defendingSeat].eliminated) {
        current = completeAttacker(current, cursor, attackerId);
        continue;
      }
      const strike = directStrike(battlefield, attackerId, assignment.defendingSeat);
      let next: FourPlayerMatchState = { ...current, battlefield: strike.state };
      const totals = applyNexusHit(next, strike.hit, strike.healing);
      next = completeAttacker(totals.match, cursor, attackerId);
      return {
        match: next,
        destroyed: [],
        nexusDamage: totals.nexusDamage,
        poisonAdded: totals.poisonAdded,
        healing: totals.healing,
        zoneActions: [],
        completed: false,
        impacts: [{ source: strike.source, kind: "nexus_strike", targetSeat: assignment.defendingSeat }],
      };
    }

    const block = current.combat.blockers.find((entry) => entry.attackerId === attackerId);
    const blockerId = block?.unitId;

    if (cursor.stage === "after_fast_first") {
      const attacker = livingBody(battlefield, attackerId);
      const blocker = blockerId ? livingBody(battlefield, blockerId) : undefined;
      if (!attacker || !blocker) {
        current = setCursor(current, { ...cursor, stage: "after_fast_counter" });
        continue;
      }
      const strike = strikeBattlefieldObject(battlefield, blocker.id, attacker.id, false);
      let next: FourPlayerMatchState = { ...current, battlefield: strike.state };
      const healing: Partial<Record<FourPlayerSeat, number>> = {};
      addAmount(healing, blocker.controllerSeat, strike.healing);
      next = applyHealing(next, healing);
      if (strike.killed) cursor = recordKiller(cursor, attacker.id, blocker.id);
      cursor = { ...cursor, stage: "after_fast_counter" };
      next = setCursor(next, cursor);
      return {
        match: next,
        destroyed: [],
        nexusDamage: {},
        poisonAdded: {},
        healing,
        zoneActions: [],
        completed: false,
        impacts: [{ source: strike.source, kind: "strike", targetObjectId: attacker.id }],
      };
    }

    if (cursor.stage === "after_fast_counter") {
      const attacker = livingBody(battlefield, attackerId);
      if (!attacker || !attacker.keywords.includes("DoubleStrike")) {
        current = completeAttacker(current, cursor, attackerId);
        continue;
      }
      const blocker = blockerId ? livingBody(battlefield, blockerId) : undefined;
      if (blocker) {
        const strike = strikeBattlefieldObject(battlefield, attacker.id, blocker.id, true);
        let next: FourPlayerMatchState = { ...current, battlefield: strike.state };
        const healing: Partial<Record<FourPlayerSeat, number>> = {};
        addAmount(healing, attacker.controllerSeat, strike.healing);
        next = applyHealing(next, healing);
        if (strike.overflow > 0) {
          const overflow: NexusHit = {
            target: assignment.defendingSeat,
            amount: strike.overflow,
            sourceController: attacker.controllerSeat,
            ...(attacker.kind === "general" ? { sourceGeneral: attacker.ownerSeat } : {}),
            poisonous: attacker.keywords.includes("Poisonous"),
          };
          next = applyNexusHit(next, overflow, 0).match;
        }
        if (strike.killed) cursor = recordKiller(cursor, blocker.id, attacker.id);
        next = completeAttacker(next, cursor, attackerId);
        return {
          match: next,
          destroyed: [],
          nexusDamage: strike.overflow > 0 ? { [assignment.defendingSeat]: strike.overflow } : {},
          poisonAdded: strike.overflow > 0 && attacker.keywords.includes("Poisonous") ? { [assignment.defendingSeat]: strike.overflow } : {},
          healing,
          zoneActions: [],
          completed: false,
          impacts: [{ source: strike.source, kind: "strike", targetObjectId: blocker.id }],
        };
      }
      if (attacker.keywords.includes("Overwhelm") && !current.seats[assignment.defendingSeat].eliminated) {
        const strike = directStrike(battlefield, attacker.id, assignment.defendingSeat);
        let next: FourPlayerMatchState = { ...current, battlefield: strike.state };
        const totals = applyNexusHit(next, strike.hit, strike.healing);
        next = completeAttacker(totals.match, cursor, attackerId);
        return {
          match: next,
          destroyed: [],
          nexusDamage: totals.nexusDamage,
          poisonAdded: totals.poisonAdded,
          healing: totals.healing,
          zoneActions: [],
          completed: false,
          impacts: [{ source: strike.source, kind: "nexus_strike", targetSeat: assignment.defendingSeat }],
        };
      }
      current = completeAttacker(current, cursor, attackerId);
      continue;
    }
  }

  throw new Error("4P incremental combat exceeded its deterministic safety boundary.");
}

export function resolveFourPlayerCombat(match: FourPlayerMatchState): FourPlayerCombatResolutionResult {
  let current = match;
  const destroyed: FourPlayerCombatDestroyedObject[] = [];
  const zoneActions: FourPlayerEffectZoneAction[] = [];
  const nexusDamage: Partial<Record<FourPlayerSeat, number>> = {};
  const poisonAdded: Partial<Record<FourPlayerSeat, number>> = {};
  const healing: Partial<Record<FourPlayerSeat, number>> = {};

  for (let guard = 0; guard < 256; guard += 1) {
    const step = advanceFourPlayerCombatStep(current);
    current = step.match;
    for (const [seat, amount] of Object.entries(step.nexusDamage)) {
      if (amount) addAmount(nexusDamage, seat as FourPlayerSeat, amount);
    }
    for (const [seat, amount] of Object.entries(step.poisonAdded)) {
      if (amount) addAmount(poisonAdded, seat as FourPlayerSeat, amount);
    }
    for (const [seat, amount] of Object.entries(step.healing)) {
      if (amount) addAmount(healing, seat as FourPlayerSeat, amount);
    }
    destroyed.push(...step.destroyed);
    zoneActions.push(...step.zoneActions);
    if (step.completed) return { match: current, destroyed, nexusDamage, poisonAdded, healing, zoneActions };
  }
  throw new Error("4P combat resolver exceeded its deterministic safety boundary.");
}
