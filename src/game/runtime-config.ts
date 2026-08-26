import type { AiRulesSnapshot, EngineRulesSnapshot } from "./types";

export type RuntimeEngineRules = EngineRulesSnapshot;
export type RuntimeAiRules = AiRulesSnapshot;
export interface RuntimeDeckRules {
  deckMin: number;
  deckMax: number;
  maxCopies: number;
  maxRegions: number;
}

export const DEFAULT_RUNTIME_ENGINE_RULES: RuntimeEngineRules = {
  nexusStart: 20, maxMana: 10, maxSpellMana: 3, handCap: 10, startHand: 4, benchCap: 6, permanentsCap: 4,
  runtimeOverridesEnabled: false, maxRounds: 200, fatigueEnabled: false, fatigueStart: 1, fatigueStep: 1,
  actionAllowlist: ["play", "cast", "attack", "block", "pass", "react", "resolve", "sentinela", "mulligan", "skipMulligan"],
  phaseSequence: ["main", "blocking", "gameover"],
};

export const DEFAULT_RUNTIME_DECK_RULES: RuntimeDeckRules = {
  deckMin: 20,
  deckMax: 40,
  maxCopies: 3,
  maxRegions: 3,
};

let current: RuntimeEngineRules = structuredClone(DEFAULT_RUNTIME_ENGINE_RULES);
export const DEFAULT_RUNTIME_AI_RULES: RuntimeAiRules = { defaultDifficulty: "tactician", aggressionScale: 1, valueScale: 1, reactionDepth: 2, randomness: 0.08 };
let currentAi: RuntimeAiRules = { ...DEFAULT_RUNTIME_AI_RULES };
let currentDeck: RuntimeDeckRules = { ...DEFAULT_RUNTIME_DECK_RULES };

export function configureRuntimeEngineRules(value: Partial<RuntimeEngineRules>): RuntimeEngineRules {
  current = { ...DEFAULT_RUNTIME_ENGINE_RULES, ...current, ...value, actionAllowlist: Array.isArray(value.actionAllowlist) ? [...value.actionAllowlist] : current.actionAllowlist, phaseSequence: Array.isArray(value.phaseSequence) ? [...value.phaseSequence] : current.phaseSequence };
  return getRuntimeEngineRules();
}

export function getRuntimeEngineRules(): RuntimeEngineRules { return { ...current, actionAllowlist: [...current.actionAllowlist], phaseSequence: [...current.phaseSequence] }; }

export function configureRuntimeDeckRules(value: Partial<RuntimeDeckRules>): RuntimeDeckRules {
  const next = { ...currentDeck, ...value };
  currentDeck = {
    deckMin: Number.isFinite(next.deckMin) ? Math.max(1, Math.trunc(next.deckMin)) : DEFAULT_RUNTIME_DECK_RULES.deckMin,
    deckMax: Number.isFinite(next.deckMax) ? Math.max(1, Math.trunc(next.deckMax)) : DEFAULT_RUNTIME_DECK_RULES.deckMax,
    maxCopies: Number.isFinite(next.maxCopies) ? Math.max(1, Math.trunc(next.maxCopies)) : DEFAULT_RUNTIME_DECK_RULES.maxCopies,
    maxRegions: Number.isFinite(next.maxRegions) ? Math.max(1, Math.min(3, Math.trunc(next.maxRegions))) : DEFAULT_RUNTIME_DECK_RULES.maxRegions,
  };
  return getRuntimeDeckRules();
}

export function getRuntimeDeckRules(): RuntimeDeckRules { return { ...currentDeck }; }

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
