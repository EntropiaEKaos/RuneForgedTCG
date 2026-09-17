import { resolveFourPlayerFlow } from "./four-player-flow";
import type { FourPlayerMatchState } from "./four-player-match";
import { allLivingPlayersPassed, createFourPlayerPriorityState } from "./four-player-priority-manager";
import type { FourPlayerStackItem } from "./four-player-stack";

export interface FourPlayerServerPumpResult {
  match: FourPlayerMatchState;
  resolved: readonly FourPlayerStackItem[];
  awaitingClientInput: boolean;
}

/**
 * Applies deterministic internal transitions that require no client choice.
 * A complete pass cycle resolves exactly one LIFO stack object, then priority
 * reopens with the active living seat. Empty-stack pass cycles are deliberately
 * left to the phase/turn machine, which will be wired as a separate transition
 * instead of silently skipping phases here.
 */
export function pumpFourPlayerServer(match: FourPlayerMatchState): FourPlayerServerPumpResult {
  if (match.status === "completed") {
    return { match, resolved: [], awaitingClientInput: false };
  }
  if (!allLivingPlayersPassed(match.resolution.priority)) {
    return { match, resolved: [], awaitingClientInput: true };
  }
  if (match.resolution.stack.items.length === 0) {
    return { match, resolved: [], awaitingClientInput: false };
  }

  const result = resolveFourPlayerFlow(match.resolution);
  if (!result.resolved) {
    return { match, resolved: [], awaitingClientInput: true };
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
  };
}
