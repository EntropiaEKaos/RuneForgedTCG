import { declareFourPlayerAttacker, declareFourPlayerBlocker } from "./four-player-combat";
import { passFourPlayerFlow, submitFourPlayerAction } from "./four-player-flow";
import { castGeneralFromZone } from "./four-player-general-zone";
import {
  advanceFourPlayerMatchTurn,
  eliminateFourPlayerMatchSeat,
  type FourPlayerMatchState,
  updateMatchGeneral,
} from "./four-player-match";
import type { FourPlayerServerEvent } from "./four-player-protocol";
import type { FourPlayerStackItem } from "./four-player-stack";

export interface DeclareAttackerPayload { unitId: string; defendingSeat: "p1" | "p2" | "p3" | "p4"; }
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
      if (state.turn.activeSeat !== event.actor) throw new Error(`Only active seat ${state.turn.activeSeat} may declare attackers.`);
      const payload = event.payload as DeclareAttackerPayload;
      return { ...state, combat: declareFourPlayerAttacker(state.combat, payload.unitId, payload.defendingSeat) };
    }

    case "declare_blocker": {
      const payload = event.payload as DeclareBlockerPayload;
      return { ...state, combat: declareFourPlayerBlocker(state.combat, event.actor, payload.unitId, payload.attackerId) };
    }

    case "cast_general": {
      assertPriorityHolder(state, event.actor);
      const general = castGeneralFromZone(state.generals[event.actor]);
      const withGeneral = updateMatchGeneral(state, event.actor, general);
      const stackItem: FourPlayerStackItem<{ owner: FourPlayerServerEvent["actor"]; defId: string }> = {
        id: `general:${event.actor}:${general.castsFromGeneralZone}:${event.eventId}`,
        controller: event.actor,
        kind: "general_cast",
        payload: { owner: event.actor, defId: general.defId },
      };
      return {
        ...withGeneral,
        resolution: submitFourPlayerAction(withGeneral.resolution, stackItem),
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
