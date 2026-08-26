import {
  configureRuntimeAiRules,
  configureRuntimeDeckRules,
  configureRuntimeEngineRules,
} from "./runtime-config";
import type { AiRulesSnapshot, EngineRulesSnapshot } from "./types";

type JsonRecord = Record<string, unknown>;

let clientArtFallbackUrl = "";

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function finiteNumber(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? [...value]
    : undefined;
}

export function getClientArtFallbackUrl(): string {
  return clientArtFallbackUrl;
}

/**
 * Hydrates only browser-safe runtime state from the already validated catalog
 * configuration returned by the server.
 *
 * Returns true when presentation state used directly by rendered cards changed,
 * allowing the catalog provider to invalidate CardView without polling DB state.
 * This module deliberately has no dependency on settings.ts: persistence,
 * control-plane and database reads stay server-only.
 */
export function hydrateClientRuntimeConfig(value: unknown): boolean {
  const config = record(value);
  const advanced = record(config.advanced);
  const engine = record(advanced.engine);
  const ai = record(advanced.ai);
  const presentation = record(advanced.presentation);

  const nextArtFallbackUrl = typeof presentation.artFallbackUrl === "string"
    ? presentation.artFallbackUrl.trim()
    : "";
  const presentationChanged = nextArtFallbackUrl !== clientArtFallbackUrl;
  clientArtFallbackUrl = nextArtFallbackUrl;

  const engineRules: Partial<EngineRulesSnapshot> = {};
  const numericEngineKeys = [
    "nexusStart",
    "maxMana",
    "maxSpellMana",
    "handCap",
    "startHand",
    "benchCap",
    "permanentsCap",
  ] as const;
  for (const key of numericEngineKeys) {
    const parsed = finiteNumber(config[key]);
    if (parsed !== undefined) engineRules[key] = parsed;
  }

  const maxRounds = finiteNumber(engine.maxRounds);
  const fatigueStart = finiteNumber(engine.fatigueStart);
  const fatigueStep = finiteNumber(engine.fatigueStep);
  const runtimeOverridesEnabled = booleanValue(engine.runtimeOverridesEnabled);
  const fatigueEnabled = booleanValue(engine.fatigueEnabled);
  const actionAllowlist = stringArray(engine.actionAllowlist);
  const phaseSequence = stringArray(engine.phaseSequence);

  if (maxRounds !== undefined) engineRules.maxRounds = maxRounds;
  if (fatigueStart !== undefined) engineRules.fatigueStart = fatigueStart;
  if (fatigueStep !== undefined) engineRules.fatigueStep = fatigueStep;
  if (runtimeOverridesEnabled !== undefined) engineRules.runtimeOverridesEnabled = runtimeOverridesEnabled;
  if (fatigueEnabled !== undefined) engineRules.fatigueEnabled = fatigueEnabled;
  if (actionAllowlist) engineRules.actionAllowlist = actionAllowlist;
  if (phaseSequence) engineRules.phaseSequence = phaseSequence;

  configureRuntimeEngineRules(engineRules);

  const deckRules = {
    deckMin: finiteNumber(config.deckMin),
    deckMax: finiteNumber(config.deckMax),
    maxCopies: finiteNumber(config.maxCopies),
    maxRegions: finiteNumber(config.maxRegions),
  };
  configureRuntimeDeckRules(Object.fromEntries(
    Object.entries(deckRules).filter((entry): entry is [keyof typeof deckRules, number] => entry[1] !== undefined),
  ));

  const aiRules: Partial<AiRulesSnapshot> = {};
  const difficulty = ai.defaultDifficulty;
  if (difficulty === "apprentice" || difficulty === "tactician" || difficulty === "overlord") {
    aiRules.defaultDifficulty = difficulty;
  }
  for (const key of ["aggressionScale", "valueScale", "reactionDepth", "randomness"] as const) {
    const parsed = finiteNumber(ai[key]);
    if (parsed !== undefined) aiRules[key] = parsed;
  }
  configureRuntimeAiRules(aiRules);

  return presentationChanged;
}
