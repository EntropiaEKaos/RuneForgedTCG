import type { AiRulesSnapshot, EngineRulesSnapshot } from "./types";

export type RuntimeEngineRules = EngineRulesSnapshot;
export type RuntimeAiRules = AiRulesSnapshot;

export const DEFAULT_RUNTIME_ENGINE_RULES: RuntimeEngineRules = {
  nexusStart: 20, maxMana: 10, maxSpellMana: 3, handCap: 10, startHand: 4, benchCap: 6, permanentsCap: 4,
  runtimeOverridesEnabled: false, maxRounds: 200, fatigueEnabled: false, fatigueStart: 1, fatigueStep: 1,
  actionAllowlist: ["play", "cast", "attack", "block", "pass", "react", "resolve", "sentinela", "mulligan", "skipMulligan"],
  phaseSequence: ["main", "blocking", "gameover"],
};

let current: RuntimeEngineRules = structuredClone(DEFAULT_RUNTIME_ENGINE_RULES);
export const DEFAULT_RUNTIME_AI_RULES: RuntimeAiRules = { defaultDifficulty: "tactician", aggressionScale: 1, valueScale: 1, reactionDepth: 2, randomness: 0.08 };
let currentAi: RuntimeAiRules = { ...DEFAULT_RUNTIME_AI_RULES };

export function configureRuntimeEngineRules(value: Partial<RuntimeEngineRules>): RuntimeEngineRules {
  current = { ...DEFAULT_RUNTIME_ENGINE_RULES, ...current, ...value, actionAllowlist: Array.isArray(value.actionAllowlist) ? [...value.actionAllowlist] : current.actionAllowlist, phaseSequence: Array.isArray(value.phaseSequence) ? [...value.phaseSequence] : current.phaseSequence };
  return getRuntimeEngineRules();
}

export function getRuntimeEngineRules(): RuntimeEngineRules { return { ...current, actionAllowlist: [...current.actionAllowlist], phaseSequence: [...current.phaseSequence] }; }

export function runtimeActionAllowed(action: string, rules: RuntimeEngineRules = current): boolean {
  return !rules.runtimeOverridesEnabled || action === "aiStep" || rules.actionAllowlist.includes(action);
}

/** Stable fallback for legacy persisted games that predate rule snapshots. */
export function legacyEngineRules(): RuntimeEngineRules {
  return structuredClone(DEFAULT_RUNTIME_ENGINE_RULES);
}

export function legacyAiRules(): RuntimeAiRules {
  return { ...DEFAULT_RUNTIME_AI_RULES };
}

export function configureRuntimeAiRules(value: Partial<RuntimeAiRules>): RuntimeAiRules { currentAi = { ...currentAi, ...value }; return getRuntimeAiRules(); }
export function getRuntimeAiRules(): RuntimeAiRules { return { ...currentAi }; }
