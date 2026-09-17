import type { FourPlayerSeat } from "./four-player-general";

export interface FourPlayerStackItem<TPayload = unknown> {
  id: string;
  controller: FourPlayerSeat;
  kind: string;
  payload: TPayload;
}

export interface FourPlayerStackState {
  items: readonly FourPlayerStackItem[];
  resolvedCount: number;
}

export function createFourPlayerStackState(): FourPlayerStackState {
  return { items: [], resolvedCount: 0 };
}

export function pushFourPlayerStackItem<TPayload>(
  state: FourPlayerStackState,
  item: FourPlayerStackItem<TPayload>,
): FourPlayerStackState {
  if (state.items.some((entry) => entry.id === item.id)) {
    throw new Error(`Duplicate four-player stack item id: ${item.id}`);
  }
  return { ...state, items: [...state.items, item] };
}

export function removeFourPlayerStackItemsByController(
  state: FourPlayerStackState,
  controller: FourPlayerSeat,
): FourPlayerStackState {
  return { ...state, items: state.items.filter((item) => item.controller !== controller) };
}

export function peekFourPlayerStack(state: FourPlayerStackState): FourPlayerStackItem | undefined {
  return state.items[state.items.length - 1];
}

export function resolveTopFourPlayerStack(state: FourPlayerStackState): {
  state: FourPlayerStackState;
  resolved?: FourPlayerStackItem;
} {
  const resolved = peekFourPlayerStack(state);
  if (!resolved) return { state };
  return {
    resolved,
    state: {
      items: state.items.slice(0, -1),
      resolvedCount: state.resolvedCount + 1,
    },
  };
}
