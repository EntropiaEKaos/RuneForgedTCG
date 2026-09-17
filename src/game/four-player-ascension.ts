import type { FourPlayerSeat } from "./four-player-general";

export type GeneralAscensionMetric =
  | "general_damage_dealt"
  | "spells_cast"
  | "allies_summoned"
  | "opponents_damaged";

export interface GeneralAscensionObjective {
  key: string;
  metric: GeneralAscensionMetric;
  threshold: number;
}

export interface GeneralAscensionState {
  owner: FourPlayerSeat;
  objective: GeneralAscensionObjective;
  progress: number;
  ascended: boolean;
}

export function createGeneralAscensionState(
  owner: FourPlayerSeat,
  objective: GeneralAscensionObjective,
): GeneralAscensionState {
  if (objective.threshold <= 0) throw new Error("Ascension threshold must be positive.");
  return { owner, objective, progress: 0, ascended: false };
}

export function recordGeneralAscensionProgress(
  state: GeneralAscensionState,
  metric: GeneralAscensionMetric,
  amount = 1,
): GeneralAscensionState {
  if (amount < 0) throw new Error("Ascension progress cannot be negative.");
  if (state.ascended || metric !== state.objective.metric || amount === 0) return state;
  const progress = Math.min(state.objective.threshold, state.progress + amount);
  return { ...state, progress, ascended: progress >= state.objective.threshold };
}
