import type { FourPlayerSeat } from "./four-player-general";
import {
  actionTaken,
  allLivingPlayersPassed,
  createFourPlayerPriorityState,
  passPriority,
  type FourPlayerPriorityMode,
  type FourPlayerPriorityState,
} from "./four-player-priority-manager";
import {
  createFourPlayerStackState,
  pushFourPlayerStackItem,
  resolveTopFourPlayerStack,
  type FourPlayerStackItem,
  type FourPlayerStackState,
} from "./four-player-stack";

export interface FourPlayerResolutionFlow {
  priority: FourPlayerPriorityState;
  stack: FourPlayerStackState;
}

export function createFourPlayerResolutionFlow(
  activeSeat: FourPlayerSeat,
  eliminatedSeats: readonly FourPlayerSeat[] = [],
  mode: FourPlayerPriorityMode = "smart_priority",
): FourPlayerResolutionFlow {
  return {
    priority: createFourPlayerPriorityState(activeSeat, eliminatedSeats, mode),
    stack: createFourPlayerStackState(),
  };
}

export function submitFourPlayerAction(
  flow: FourPlayerResolutionFlow,
  item: FourPlayerStackItem,
): FourPlayerResolutionFlow {
  if (flow.priority.holder !== item.controller) {
    throw new Error(`Seat ${item.controller} cannot act while ${flow.priority.holder} holds priority.`);
  }
  return {
    stack: pushFourPlayerStackItem(flow.stack, item),
    priority: actionTaken(flow.priority, item.controller),
  };
}

export function passFourPlayerFlow(flow: FourPlayerResolutionFlow): FourPlayerResolutionFlow {
  return { ...flow, priority: passPriority(flow.priority) };
}

/** Resolve exactly one LIFO object after every living player has passed. */
export function resolveFourPlayerFlow(flow: FourPlayerResolutionFlow): {
  flow: FourPlayerResolutionFlow;
  resolved?: FourPlayerStackItem;
} {
  if (!allLivingPlayersPassed(flow.priority)) return { flow };

  const result = resolveTopFourPlayerStack(flow.stack);
  const anchor = result.resolved?.controller ?? flow.priority.anchorSeat;
  return {
    resolved: result.resolved,
    flow: {
      stack: result.state,
      priority: createFourPlayerPriorityState(
        anchor,
        flow.priority.eliminatedSeats,
        flow.priority.mode,
      ),
    },
  };
}
