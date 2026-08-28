import type { GameState, PlayerId, UnitInstance } from "./types";

/**
 * Presentation-neutral events derived from authoritative game state changes.
 *
 * The engine remains the source of truth for state. Consumers such as the UI,
 * audio layer, replay tooling and analytics can subscribe to the same event
 * vocabulary without embedding presentation logic in the rules engine.
 */
export type GameEvent =
  | {
      type: "UNIT_SUMMONED";
      player: PlayerId;
      unitId: string;
      defId: string;
    }
  | {
      type: "UNIT_DAMAGED";
      player: PlayerId;
      unitId: string;
      amount: number;
    }
  | {
      type: "UNIT_HEALED";
      player: PlayerId;
      unitId: string;
      amount: number;
    }
  | {
      type: "UNIT_DIED";
      player: PlayerId;
      unitId: string;
      defId: string;
    }
  | {
      type: "UNIT_LEVELLED_UP";
      player: PlayerId;
      unitId: string;
      fromDefId: string;
      toDefId: string;
    }
  | {
      type: "UNIT_ATTACK_STARTED";
      player: PlayerId;
      unitId: string;
    }
  | {
      type: "STATUS_APPLIED";
      player: PlayerId;
      unitId: string;
      status: "barrier" | "frostbitten" | "stunned";
    }
  | {
      type: "STATUS_REMOVED";
      player: PlayerId;
      unitId: string;
      status: "barrier";
    }
  | {
      type: "NEXUS_DAMAGED";
      player: PlayerId;
      amount: number;
    }
  | {
      type: "NEXUS_HEALED";
      player: PlayerId;
      amount: number;
    }
  | {
      type: "NEXUS_POISONED";
      player: PlayerId;
      amount: number;
      total: number;
    };

export interface GameEventBatch {
  events: GameEvent[];
  previous: GameState;
  next: GameState;
}

/**
 * Derives semantic events from two consecutive immutable game states.
 *
 * This is deliberately deterministic and has no DOM/audio dependencies, so it
 * can be used by tests, replay tooling, server code and the browser alike.
 */
export function deriveGameEvents(previous: GameState, next: GameState): GameEvent[] {
  if (previous === next) return [];

  const events: GameEvent[] = [];
  const players: PlayerId[] = ["player", "ai"];

  for (const player of players) {
    const previousUnits = new Map(previous.players[player].bench.map((unit) => [unit.instanceId, unit]));
    const nextUnits = new Map(next.players[player].bench.map((unit) => [unit.instanceId, unit]));

    for (const unit of nextUnits.values()) {
      const before = previousUnits.get(unit.instanceId);
      if (!before) {
        events.push({ type: "UNIT_SUMMONED", player, unitId: unit.instanceId, defId: unit.defId });
        continue;
      }

      if (unit.health < before.health) {
        events.push({
          type: "UNIT_DAMAGED",
          player,
          unitId: unit.instanceId,
          amount: before.health - unit.health,
        });
      } else if (unit.health > before.health && unit.defId === before.defId) {
        events.push({
          type: "UNIT_HEALED",
          player,
          unitId: unit.instanceId,
          amount: unit.health - before.health,
        });
      }

      if (unit.defId !== before.defId) {
        events.push({
          type: "UNIT_LEVELLED_UP",
          player,
          unitId: unit.instanceId,
          fromDefId: before.defId,
          toDefId: unit.defId,
        });
      }

      if (!before.barrier && unit.barrier) {
        events.push({ type: "STATUS_APPLIED", player, unitId: unit.instanceId, status: "barrier" });
      }
      if (before.barrier && !unit.barrier) {
        events.push({ type: "STATUS_REMOVED", player, unitId: unit.instanceId, status: "barrier" });
      }
      if (!before.frostbitten && unit.frostbitten) {
        events.push({ type: "STATUS_APPLIED", player, unitId: unit.instanceId, status: "frostbitten" });
      }
      if (!before.stunned && unit.stunned) {
        events.push({ type: "STATUS_APPLIED", player, unitId: unit.instanceId, status: "stunned" });
      }
      if (!before.isAttacking && unit.isAttacking) {
        events.push({ type: "UNIT_ATTACK_STARTED", player, unitId: unit.instanceId });
      }
    }

    for (const unit of previousUnits.values()) {
      if (!nextUnits.has(unit.instanceId)) {
        events.push({
          type: "UNIT_DIED",
          player,
          unitId: unit.instanceId,
          defId: unit.defId,
        });
      }
    }

    const previousNexus = previous.players[player].nexusHealth;
    const nextNexus = next.players[player].nexusHealth;
    if (nextNexus < previousNexus) {
      events.push({ type: "NEXUS_DAMAGED", player, amount: previousNexus - nextNexus });
    } else if (nextNexus > previousNexus) {
      events.push({ type: "NEXUS_HEALED", player, amount: nextNexus - previousNexus });
    }
    const poisonAdded = next.players[player].poisonCounters - previous.players[player].poisonCounters;
    if (poisonAdded > 0) {
      events.push({ type: "NEXUS_POISONED", player, amount: poisonAdded, total: next.players[player].poisonCounters });
    }
  }

  return events;
}

export function isDamageEvent(event: GameEvent): boolean {
  return event.type === "UNIT_DAMAGED" || event.type === "UNIT_DIED" || event.type === "NEXUS_DAMAGED" || event.type === "NEXUS_POISONED";
}

export function isHealEvent(event: GameEvent): boolean {
  return event.type === "UNIT_HEALED" || event.type === "NEXUS_HEALED";
}

export function isLevelEvent(event: GameEvent): boolean {
  return event.type === "UNIT_LEVELLED_UP";
}

export function getUnitFromEvent(state: GameState, event: GameEvent): UnitInstance | null {
  if (!("unitId" in event)) return null;
  return state.players[event.player].bench.find((unit) => unit.instanceId === event.unitId) ?? null;
}
