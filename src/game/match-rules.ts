import type { AiRulesSnapshot, EngineRulesSnapshot, GameState } from "./types";
import { legacyAiRules, legacyEngineRules } from "./runtime-config";

/**
 * Rules are part of match state from 2.90 onward. Never consult mutable global
 * LiveOps configuration while reducing an existing match.
 */
export function engineRulesFor(state: GameState): EngineRulesSnapshot {
  const rules = (state as GameState & { rules?: EngineRulesSnapshot }).rules;
  return rules ?? legacyEngineRules();
}

export function aiRulesFor(state: GameState): AiRulesSnapshot {
  const rules = (state as GameState & { aiRules?: AiRulesSnapshot }).aiRules;
  return rules ?? legacyAiRules();
}
