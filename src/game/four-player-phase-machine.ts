import {
  FOUR_PLAYER_PHASES,
  advanceFourPlayerMatchTurn,
  type FourPlayerMatchState,
  type FourPlayerPhase,
} from "./four-player-match";
import { createFourPlayerPriorityState } from "./four-player-priority-manager";

export interface FourPlayerPhaseAdvanceResult {
  match: FourPlayerMatchState;
  previousPhase: FourPlayerPhase;
  turnAdvanced: boolean;
}

/**
 * Advances only after the server has already established an empty stack and a
 * complete living-player pass cycle. Phase is persisted in authoritative match
 * state so reconnect/resync and subsequent commands observe the same timeline.
 */
export function advanceFourPlayerPhase(match: FourPlayerMatchState): FourPlayerPhaseAdvanceResult {
  const previousPhase = match.phase;
  if (match.status === "completed") return { match, previousPhase, turnAdvanced: false };

  const index = FOUR_PLAYER_PHASES.indexOf(match.phase);
  if (index < FOUR_PLAYER_PHASES.length - 1) {
    const nextPhase = FOUR_PLAYER_PHASES[index + 1];
    const priority = createFourPlayerPriorityState(
      match.turn.activeSeat,
      match.turn.eliminatedSeats,
      match.resolution.priority.mode,
    );
    return {
      match: { ...match, phase: nextPhase, resolution: { ...match.resolution, priority } },
      previousPhase,
      turnAdvanced: false,
    };
  }

  return {
    match: advanceFourPlayerMatchTurn(match),
    previousPhase,
    turnAdvanced: true,
  };
}
