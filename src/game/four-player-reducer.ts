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

/**
 * Pure authoritative reducer. It consumes canonical server events only; clients never
 * mutate FourPlayerMatchState directly.
 */
export function reduceFourPlayerServerEvent(
  state: FourPlayerMatchState,
  event: FourPlayerServerEvent,
): FourPlayerMatchState {
  switch (event.type) {
    case "pass_priority":
      return { ...state, resolution: passFourPlayerFlow(state.resolution) };

    case "submit_action":
      return {
        ...state,
        resolution: submitFourPlayerAction(state.resolution, event.payload as FourPlayerStackItem),
      };

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
      const general = castGeneralFromZone(state.generals[event.actor]);
      return updateMatchGeneral(state, event.actor, general);
    }

    case "end_turn":
      if (state.turn.activeSeat !== event.actor) throw new Error(`Only active seat ${state.turn.activeSeat} may end the turn.`);
      return advanceFourPlayerMatchTurn(state);

    case "concede":
      return eliminateFourPlayerMatchSeat(state, event.actor);
  }
}
