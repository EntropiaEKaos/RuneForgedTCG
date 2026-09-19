import {
  assertFourPlayerAttackerObject,
  assertFourPlayerBlockerObject,
  canFourPlayerBlockObjects,
  createFourPlayerBattlefieldState,
  findFourPlayerBattlefieldObject,
  markFourPlayerBattlefieldObjectAttacked,
} from "./four-player-battlefield";
import { declareFourPlayerAttacker, declareFourPlayerBlocker } from "./four-player-combat";
import { passFourPlayerFlow, submitFourPlayerAction } from "./four-player-flow";
import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";
import { assertGeneralCastTiming, castGeneralFromZone, generalCastCost } from "./four-player-general-zone";
import {
  advanceFourPlayerMatchTurn,
  eliminateFourPlayerMatchSeat,
  type FourPlayerMatchState,
  updateMatchGeneral,
} from "./four-player-match";
import type { FourPlayerServerEvent } from "./four-player-protocol";
import type { FourPlayerStackItem } from "./four-player-stack";

export interface DeclareAttackerPayload { unitId: string; defendingSeat: FourPlayerSeat; }
export interface DeclareBlockerPayload { unitId: string; attackerId: string; }

function assertActiveMatch(state: FourPlayerMatchState): void {
  if (state.status === "completed") throw new Error("Completed four-player matches are terminal.");
}

function assertPriorityHolder(state: FourPlayerMatchState, actor: FourPlayerServerEvent["actor"]): void {
  if (state.resolution.priority.holder !== actor) {
    throw new Error(`Only priority holder ${state.resolution.priority.holder} may act.`);
  }
}

/**
 * Pure authoritative reducer. It consumes canonical server events only; clients never
 * mutate FourPlayerMatchState directly. These checks are defense-in-depth: protocol
 * validation may reject commands earlier, but canonical events still cannot bypass
 * terminal, priority, controller, or unresolved-stack invariants here.
 */
export function reduceFourPlayerServerEvent(
  state: FourPlayerMatchState,
  event: FourPlayerServerEvent,
): FourPlayerMatchState {
  assertActiveMatch(state);

  switch (event.type) {
    case "pass_priority":
      assertPriorityHolder(state, event.actor);
      return { ...state, resolution: passFourPlayerFlow(state.resolution) };

    case "submit_action": {
      assertPriorityHolder(state, event.actor);
      const item = event.payload as FourPlayerStackItem;
      if (item.controller !== event.actor) {
        throw new Error(`Action controller ${item.controller} does not match actor ${event.actor}.`);
      }
      return {
        ...state,
        resolution: submitFourPlayerAction(state.resolution, item),
      };
    }

    case "declare_attacker": {
      assertPriorityHolder(state, event.actor);
      if (state.turn.activeSeat !== event.actor) throw new Error(`Only active seat ${state.turn.activeSeat} may declare attackers.`);
      if (state.phase !== "combat") throw new Error("Attackers may only be declared during the combat phase.");
      const payload = event.payload as Partial<DeclareAttackerPayload>;
      const unitId = typeof payload.unitId === "string" ? payload.unitId.trim() : "";
      if (!unitId) throw new Error("Attacker unitId is required.");
      if (!payload.defendingSeat || !FOUR_PLAYER_SEATS.includes(payload.defendingSeat)) {
        throw new Error("Attacker defendingSeat is invalid.");
      }
      const battlefield = state.battlefield ?? createFourPlayerBattlefieldState();
      assertFourPlayerAttackerObject(battlefield, event.actor, unitId, state.turn.turn);
      return {
        ...state,
        battlefield: markFourPlayerBattlefieldObjectAttacked(battlefield, unitId),
        combat: declareFourPlayerAttacker(state.combat, unitId, payload.defendingSeat),
      };
    }

    case "declare_blocker": {
      assertPriorityHolder(state, event.actor);
      if (state.phase !== "combat") throw new Error("Blockers may only be declared during the combat phase.");
      const payload = event.payload as Partial<DeclareBlockerPayload>;
      const unitId = typeof payload.unitId === "string" ? payload.unitId.trim() : "";
      const attackerId = typeof payload.attackerId === "string" ? payload.attackerId.trim() : "";
      if (!unitId) throw new Error("Blocker unitId is required.");
      if (!attackerId) throw new Error("Blocker attackerId is required.");
      const battlefield = state.battlefield ?? createFourPlayerBattlefieldState();
      const blocker = assertFourPlayerBlockerObject(battlefield, event.actor, unitId);
      const attacker = findFourPlayerBattlefieldObject(battlefield, attackerId);
      if (!canFourPlayerBlockObjects(attacker, blocker)) {
        throw new Error(`Blocker ${unitId} cannot legally block attacker ${attackerId}.`);
      }
      return { ...state, combat: declareFourPlayerBlocker(state.combat, event.actor, unitId, attackerId) };
    }

    case "play_card":
      throw new Error("play_card requires zone-aware Commander authority and cannot be reduced without card zones.");

    case "cast_general": {
      assertPriorityHolder(state, event.actor);
      assertGeneralCastTiming(state.turn.activeSeat, state.phase, state.resolution.stack.items.length, event.actor);
      const currentGeneral = state.generals[event.actor];
      const cost = generalCastCost(currentGeneral, state.generalPrintedCosts[event.actor]);
      const seat = state.seats[event.actor];
      if (seat.mana < cost) throw new Error(`Insufficient mana to cast General: requires ${cost}, has ${seat.mana}.`);
      const general = castGeneralFromZone(currentGeneral);
      const withGeneral = updateMatchGeneral(state, event.actor, general);
      const paidState: FourPlayerMatchState = {
        ...withGeneral,
        seats: { ...withGeneral.seats, [event.actor]: { ...withGeneral.seats[event.actor], mana: seat.mana - cost } },
      };
      const stackItem: FourPlayerStackItem<{ owner: FourPlayerServerEvent["actor"]; defId: string }> = {
        id: `general:${event.actor}:${general.castsFromGeneralZone}:${event.eventId}`,
        controller: event.actor,
        kind: "general_cast",
        payload: { owner: event.actor, defId: general.defId },
      };
      return {
        ...paidState,
        resolution: submitFourPlayerAction(paidState.resolution, stackItem),
      };
    }

    case "end_turn":
      if (state.turn.activeSeat !== event.actor) throw new Error(`Only active seat ${state.turn.activeSeat} may end the turn.`);
      if (state.resolution.stack.items.length > 0) throw new Error("Cannot end turn while the stack is not empty.");
      if (state.resolution.priority.consecutivePasses > 0) throw new Error("Cannot end turn during an unresolved priority pass cycle.");
      if (state.resolution.priority.holder !== event.actor) throw new Error(`Only priority holder ${state.resolution.priority.holder} may end the turn.`);
      return advanceFourPlayerMatchTurn(state);

    case "concede":
      return eliminateFourPlayerMatchSeat(state, event.actor);
  }
}
