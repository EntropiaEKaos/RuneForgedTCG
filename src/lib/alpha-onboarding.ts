import type { AiDifficulty } from "@/game/types";

export const ALPHA_ONBOARDING_STORAGE_KEY = "runeforge_alpha_onboarding";
export const ALPHA_ONBOARDING_COMPLETE = "complete";
export const ALPHA_FIRST_MATCH_DIFFICULTY: AiDifficulty = "apprentice";

export function shouldShowAlphaOnboarding(input: { created?: boolean; completed?: boolean }): boolean {
  return input.created === true && input.completed !== true;
}
