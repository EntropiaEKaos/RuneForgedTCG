import { resolveFourPlayerFlow } from "./four-player-flow";
import type { FourPlayerMatchState } from "./four-player-match";
import { advanceFourPlayerPhase } from "./four-player-phase-machine";
import { allLivingPlayersPassed, createFourPlayerPriorityState } from "./four-player-priority-manager";
import type { FourPlayerStackItem } from "./four-player-stack";

export interface FourPlayerServerPumpResult {
  match: FourPlayerMatchState;
  resolved: readonly FourPlayerStackItem[];
  awaitingClientInput: boolean;
  phaseAdvanced: boolean;
  turnAdvanced: boolean;
}

/**
 * Applies one deterministic internal transition that requires no client choice.
 * A complete pass cycle resolves exactly one LIFO stack object when the stack is
 * non-empty. With an empty stack, the same pass cycle advances exactly one phase;
 * ending advances to the next living player's beginning. Priority then reopens
 * with the active living seat, so the pump never skips multiple phases at once.
 */
export function pumpFourPlayerServer(match: FourPlayerMatchState): FourPlayerServerPumpResult {
  if (match.status === "completed") {
    return { match, resolved: [], awaitingClientInput: false, phaseAdvanced: false, turnAdvanced: false };
  }
  if (!allLivingPlayersPassed(match.resolution.priority)) {
    return { match, resolved: [], awaitingClientInput: true, phaseAdvanced: false, turnAdvanced: false };
  }
  if (match.resolution.stack.items.length === 0) {
    const advanced = advanceFourPlayerPhase(match);
    return {
      match: advanced.match,
      resolved: [],
      awaitingClientInput: true,
      phaseAdvanced: true,
      turnAdvanced: advanced.turnAdvanced,
    };
  }

  const result = resolveFourPlayerFlow(match.resolution);
  if (!result.resolved) {
    return { match, resolved: [], awaitingClientInput: true, phaseAdvanced: false, turnAdvanced: false };
  }
  const priority = createFourPlayerPriorityState(
    match.turn.activeSeat,
    result.flow.priority.eliminatedSeats,
    result.flow.priority.mode,
  );
  return {
    match: { ...match, resolution: { ...result.flow, priority } },
    resolved: [result.resolved],
    awaitingClientInput: true,
    phaseAdvanced: false,
    turnAdvanced: false,
  };
}
