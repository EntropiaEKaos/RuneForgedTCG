import type { FourPlayerMatchState } from "./four-player-match";
import { advanceFourPlayerMatchTurn } from "./four-player-match";
import { createFourPlayerPriorityState } from "./four-player-priority-manager";

export const FOUR_PLAYER_PHASES = [
  "beginning",
  "main_1",
  "combat",
  "main_2",
  "ending",
] as const;

export type FourPlayerPhase = (typeof FOUR_PLAYER_PHASES)[number];

export interface FourPlayerPhaseState {
  phase: FourPlayerPhase;
}

export interface FourPlayerPhaseAdvanceResult {
  match: FourPlayerMatchState;
  phase: FourPlayerPhaseState;
  turnAdvanced: boolean;
}

export function createFourPlayerPhaseState(phase: FourPlayerPhase = "beginning"): FourPlayerPhaseState {
  return { phase };
}

/**
 * Advances only after the server has already established an empty stack and a
 * complete living-player pass cycle. The phase machine itself is deterministic:
 * it never resolves stack objects and never asks the client to choose a phase.
 */
export function advanceFourPlayerPhase(
  match: FourPlayerMatchState,
  phase: FourPlayerPhaseState,
): FourPlayerPhaseAdvanceResult {
  if (match.status === "completed") return { match, phase, turnAdvanced: false };

  const index = FOUR_PLAYER_PHASES.indexOf(phase.phase);
  if (index < FOUR_PLAYER_PHASES.length - 1) {
    const nextPhase = FOUR_PLAYER_PHASES[index + 1];
    const priority = createFourPlayerPriorityState(
      match.turn.activeSeat,
      match.turn.eliminatedSeats,
      match.resolution.priority.mode,
    );
    return {
      match: { ...match, resolution: { ...match.resolution, priority } },
      phase: { phase: nextPhase },
      turnAdvanced: false,
    };
  }

  const nextMatch = advanceFourPlayerMatchTurn(match);
  return {
    match: nextMatch,
    phase: createFourPlayerPhaseState(),
    turnAdvanced: true,
  };
}
