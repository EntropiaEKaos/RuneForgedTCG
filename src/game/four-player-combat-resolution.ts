import {
  applyFourPlayerBattlefieldDamage,
  createFourPlayerBattlefieldState,
  findFourPlayerBattlefieldObject,
  type FourPlayerBattlefieldObject,
  type FourPlayerBattlefieldState,
} from "./four-player-battlefield";
import { createFourPlayerCombatState } from "./four-player-combat";
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
}

export interface FourPlayerCombatResolutionResult {
  match: FourPlayerMatchState;
  destroyed: readonly FourPlayerCombatDestroyedObject[];
  nexusDamage: Partial<Record<FourPlayerSeat, number>>;
  poisonAdded: Partial<Record<FourPlayerSeat, number>>;
  healing: Partial<Record<FourPlayerSeat, number>>;
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
} {
  const source = findFourPlayerBattlefieldObject(state, sourceId);
  const target = findFourPlayerBattlefieldObject(state, targetId);
  if (!source.combat || source.combat.health <= 0) return { state, overflow: 0, healing: 0 };
  if (!target.combat || target.combat.health <= 0) return { state, overflow: 0, healing: 0 };

  const power = effectivePower(source);
  const targetHealthBefore = target.combat.health;
  const damaged = applyFourPlayerBattlefieldDamage(state, targetId, power, sourceId);
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
} {
  const attacker = findFourPlayerBattlefieldObject(state, attackerId);
  const blocker = findFourPlayerBattlefieldObject(state, blockerId);
  if (!attacker.combat || attacker.combat.health <= 0 || !blocker.combat || blocker.combat.health <= 0) {
    return { state, overflow: 0, attackerHealing: 0, blockerHealing: 0 };
  }

  const attackerPower = effectivePower(attacker);
  const blockerPower = effectivePower(blocker);
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
  };
}

function directStrike(
  state: FourPlayerBattlefieldState,
  sourceId: string,
  defendingSeat: FourPlayerSeat,
): {
  state: FourPlayerBattlefieldState;
  hit?: NexusHit;
  healing: number;
} {
  const source = livingBody(state, sourceId);
  if (!source) return { state, healing: 0 };
  const amount = effectivePower(source);
  const hit: NexusHit | undefined = amount > 0 ? {
    target: defendingSeat,
    amount,
    sourceController: source.controllerSeat,
    ...(source.kind === "general" ? { sourceGeneral: source.ownerSeat } : {}),
    poisonous: source.keywords.includes("Poisonous"),
  } : undefined;
  const healing = source.keywords.includes("Lifesteal") ? amount : 0;
  return {
    state: markEphemeralDead(state, sourceId),
    hit,
    healing,
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
    const life = Math.min(
      FOUR_PLAYER_STARTING_LIFE,
      Math.max(0, current.life - hurt) + healed,
    );
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

export function resolveFourPlayerCombat(match: FourPlayerMatchState): FourPlayerCombatResolutionResult {
  if (match.phase !== "combat") throw new Error("4P combat resolution requires the combat phase.");
  let battlefield = match.battlefield ?? createFourPlayerBattlefieldState();
  const assignments = [...match.combat.attackers];
  const blocks = new Map(match.combat.blockers.map((blocker) => [blocker.attackerId, blocker]));
  const nexusHits: NexusHit[] = [];
  const healing: Partial<Record<FourPlayerSeat, number>> = {};

  const pushHit = (hit: NexusHit | undefined) => {
    if (hit) nexusHits.push(hit);
  };

  for (const assignment of assignments) {
    if (match.seats[assignment.defendingSeat].eliminated) continue;
    const attacker = livingBody(battlefield, assignment.unitId);
    if (!attacker) continue;

    const block = blocks.get(assignment.unitId);
    const blocker = block ? livingBody(battlefield, block.unitId) : undefined;
    if (!blocker) {
      const first = directStrike(battlefield, assignment.unitId, assignment.defendingSeat);
      battlefield = first.state;
      pushHit(first.hit);
      addAmount(healing, attacker.controllerSeat, first.healing);

      const afterFirst = livingBody(battlefield, assignment.unitId);
      if (afterFirst?.keywords.includes("DoubleStrike")) {
        const second = directStrike(battlefield, assignment.unitId, assignment.defendingSeat);
        battlefield = second.state;
        pushHit(second.hit);
        addAmount(healing, attacker.controllerSeat, second.healing);
      }
      continue;
    }

    const fast = attacker.keywords.includes("QuickAttack") || attacker.keywords.includes("DoubleStrike");
    if (fast) {
      const first = strikeBattlefieldObject(battlefield, attacker.id, blocker.id, true);
      battlefield = first.state;
      addAmount(healing, attacker.controllerSeat, first.healing);
      if (first.overflow > 0) {
        nexusHits.push({
          target: assignment.defendingSeat,
          amount: first.overflow,
          sourceController: attacker.controllerSeat,
          ...(attacker.kind === "general" ? { sourceGeneral: attacker.ownerSeat } : {}),
          poisonous: attacker.keywords.includes("Poisonous"),
        });
      }

      const survivingBlocker = livingBody(battlefield, blocker.id);
      const survivingAttacker = livingBody(battlefield, attacker.id);
      if (survivingBlocker && survivingAttacker) {
        const counter = strikeBattlefieldObject(battlefield, blocker.id, attacker.id, false);
        battlefield = counter.state;
        addAmount(healing, blocker.controllerSeat, counter.healing);
      }

      const doubleAttacker = livingBody(battlefield, attacker.id);
      const doubleBlocker = livingBody(battlefield, blocker.id);
      if (doubleAttacker?.keywords.includes("DoubleStrike") && doubleBlocker) {
        const second = strikeBattlefieldObject(battlefield, attacker.id, blocker.id, true);
        battlefield = second.state;
        addAmount(healing, attacker.controllerSeat, second.healing);
        if (second.overflow > 0) {
          nexusHits.push({
            target: assignment.defendingSeat,
            amount: second.overflow,
            sourceController: attacker.controllerSeat,
            ...(attacker.kind === "general" ? { sourceGeneral: attacker.ownerSeat } : {}),
            poisonous: attacker.keywords.includes("Poisonous"),
          });
        }
      } else if (doubleAttacker?.keywords.includes("DoubleStrike") && attacker.keywords.includes("Overwhelm")) {
        const second = directStrike(battlefield, attacker.id, assignment.defendingSeat);
        battlefield = second.state;
        pushHit(second.hit);
        addAmount(healing, attacker.controllerSeat, second.healing);
      }
      continue;
    }

    const exchange = simultaneousBattlefieldExchange(battlefield, attacker.id, blocker.id);
    battlefield = exchange.state;
    addAmount(healing, attacker.controllerSeat, exchange.attackerHealing);
    addAmount(healing, blocker.controllerSeat, exchange.blockerHealing);
    if (exchange.overflow > 0) {
      nexusHits.push({
        target: assignment.defendingSeat,
        amount: exchange.overflow,
        sourceController: attacker.controllerSeat,
        ...(attacker.kind === "general" ? { sourceGeneral: attacker.ownerSeat } : {}),
        poisonous: attacker.keywords.includes("Poisonous"),
      });
    }
  }

  const destroyedObjects = battlefield.objects.filter((object) => object.combat && object.combat.health <= 0);
  const destroyed: FourPlayerCombatDestroyedObject[] = destroyedObjects.map((object) => ({
    id: object.id,
    defId: object.defId,
    ownerSeat: object.ownerSeat,
    kind: object.kind,
    destination: destinationFor(object),
  }));

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

  const nexusDamage: Partial<Record<FourPlayerSeat, number>> = {};
  const poisonAdded: Partial<Record<FourPlayerSeat, number>> = {};
  const generalDamage: Partial<Record<FourPlayerSeat, Partial<Record<FourPlayerSeat, number>>>> = {};

  for (const hit of nexusHits) {
    addAmount(nexusDamage, hit.target, hit.amount);
    if (hit.poisonous) addAmount(poisonAdded, hit.target, hit.amount);
    if (hit.sourceGeneral) {
      const ledger = generalDamage[hit.target] ?? {};
      ledger[hit.sourceGeneral] = (ledger[hit.sourceGeneral] ?? 0) + hit.amount;
      generalDamage[hit.target] = ledger;
    }
  }

  nextMatch = applySeatTotals(nextMatch, nexusDamage, generalDamage, poisonAdded, healing);
  return { match: nextMatch, destroyed, nexusDamage, poisonAdded, healing };
}
