export interface GameConfig {
  nexusStart: number;
  maxMana: number;
  maxSpellMana: number;
  handCap: number;
  startHand: number;
  benchCap: number;
  permanentsCap: number;
  deckMin: number;
  deckMax: number;
  maxCopies: number;
  maxRegions: number;
  reactionMs: number;
  aiEnabled: boolean;
  rankedEnabled: boolean;
  maintenanceMode: boolean;
  announcement: string;
  advanced: AdvancedGameConfig;
}

export interface AdvancedGameConfig {
  engine: {
    runtimeOverridesEnabled: boolean;
    maxRounds: number;
    fatigueEnabled: boolean;
    fatigueStart: number;
    fatigueStep: number;
    actionAllowlist: string[];
    phaseSequence: string[];
  };
  ai: {
    defaultDifficulty: "apprentice" | "tactician" | "overlord";
    aggressionScale: number;
    valueScale: number;
    reactionDepth: number;
    randomness: number;
  };
  matchmaking: {
    baseRange: number;
    maxRange: number;
    rangeStep: number;
    rangeStepSeconds: number;
    staleSeconds: number;
    queueTtlSeconds: number;
    aiFallbackSeconds: number;
    rematchCooldownSeconds: number;
  };
  ranked: {
    eloDivisor: number;
    placementK: number;
    normalK: number;
    minimumMmr: number;
    leaderboardSize: number;
  };
  economy: {
    loginClaimHours: number;
    loginResetHours: number;
    duplicateCap: number;
    dustValues: Record<"Common" | "Rare" | "Epic" | "Legend", number>;
  };
  presentation: {
    defaultTheme: string;
    defaultBoard: string;
    fxIntensity: number;
    masterVolume: number;
    reduceMotionDefault: boolean;
    artFallbackUrl: string;
  };
  localization: { defaultLocale: string; fallbackLocale: string };
  moderation: { chatMaxLength: number; floodWindowSeconds: number; floodMaxMessages: number; replayRetentionDays: number; allowDeckModeration: boolean };
}

export type AdvancedGameConfigPatch = {
  [K in keyof AdvancedGameConfig]?: K extends "economy"
    ? Omit<Partial<AdvancedGameConfig["economy"]>, "dustValues"> & { dustValues?: Partial<AdvancedGameConfig["economy"]["dustValues"]> }
    : Partial<AdvancedGameConfig[K]>;
};

export type GameConfigPatch = Omit<Partial<GameConfig>, "advanced"> & { advanced?: AdvancedGameConfigPatch };

export const DEFAULT_ADVANCED_CONFIG: AdvancedGameConfig = {
  engine: {
    runtimeOverridesEnabled: false,
    maxRounds: 200,
    fatigueEnabled: false,
    fatigueStart: 1,
    fatigueStep: 1,
    actionAllowlist: ["play", "cast", "attack", "block", "pass", "react", "resolve", "sentinela", "mulligan", "skipMulligan"],
    phaseSequence: ["main", "blocking", "gameover"],
  },
  ai: { defaultDifficulty: "tactician", aggressionScale: 1, valueScale: 1, reactionDepth: 2, randomness: 0.08 },
  matchmaking: { baseRange: 150, maxRange: 600, rangeStep: 75, rangeStepSeconds: 10, staleSeconds: 20, queueTtlSeconds: 600, aiFallbackSeconds: 8, rematchCooldownSeconds: 120 },
  ranked: { eloDivisor: 400, placementK: 40, normalK: 24, minimumMmr: 0, leaderboardSize: 20 },
  economy: { loginClaimHours: 20, loginResetHours: 48, duplicateCap: 3, dustValues: { Common: 10, Rare: 25, Epic: 50, Legend: 100 } },
  presentation: { defaultTheme: "runeforge-default", defaultBoard: "default", fxIntensity: 1, masterVolume: 1, reduceMotionDefault: false, artFallbackUrl: "" },
  localization: { defaultLocale: "pt-BR", fallbackLocale: "en" },
  moderation: { chatMaxLength: 280, floodWindowSeconds: 10, floodMaxMessages: 6, replayRetentionDays: 90, allowDeckModeration: true },
};

export const DEFAULT_CONFIG: GameConfig = {
  nexusStart: 20,
  maxMana: 10,
  maxSpellMana: 3,
  handCap: 10,
  startHand: 4,
  benchCap: 6,
  permanentsCap: 4,
  deckMin: 20,
  deckMax: 40,
  maxCopies: 3,
  maxRegions: 3,
  reactionMs: 10000,
  aiEnabled: true,
  rankedEnabled: false,
  maintenanceMode: false,
  announcement: "",
  advanced: DEFAULT_ADVANCED_CONFIG,
};

async function applyEngineRuntime(config: GameConfig) {
  const { configureRuntimeEngineRules, configureRuntimeAiRules, configureRuntimeDeckRules } = await import("./runtime-config");
  configureRuntimeEngineRules({
    nexusStart: config.nexusStart, maxMana: config.maxMana, maxSpellMana: config.maxSpellMana,
    handCap: config.handCap, startHand: config.startHand, benchCap: config.benchCap, permanentsCap: config.permanentsCap,
    ...config.advanced.engine,
  });
  configureRuntimeAiRules(config.advanced.ai);
  configureRuntimeDeckRules({
    deckMin: config.deckMin,
    deckMax: config.deckMax,
    maxCopies: config.maxCopies,
    maxRegions: config.maxRegions,
  });
}

let cached: GameConfig = { ...DEFAULT_CONFIG };
let loaded = false;
let lastCheckedAt = 0;
let loading: Promise<GameConfig> | null = null;
let cachedRevision = 0;

function configCacheTtlMs(): number {
  const raw = Number(process.env.GAME_CONFIG_CACHE_TTL_MS);
  if (!Number.isFinite(raw)) return 1_000;
  return Math.max(250, Math.min(60_000, Math.trunc(raw)));
}

function normalizeGameConfig(value?: Partial<GameConfig> | null): GameConfig {
  const advanced = value?.advanced || ({} as Partial<AdvancedGameConfig>);
  const merged = {
    ...DEFAULT_CONFIG,
    ...(value || {}),
  };
  // Card/deck identity is deliberately single/dual/triad. Never let stale or
  // hand-edited settings create a four-region identity the engine cannot model.
  merged.maxRegions = Math.max(1, Math.min(3, Math.trunc(Number(merged.maxRegions) || DEFAULT_CONFIG.maxRegions)));
  return {
    ...merged,
    advanced: {
      ...DEFAULT_ADVANCED_CONFIG,
      ...advanced,
      engine: { ...DEFAULT_ADVANCED_CONFIG.engine, ...(advanced.engine || {}) },
      ai: { ...DEFAULT_ADVANCED_CONFIG.ai, ...(advanced.ai || {}) },
      matchmaking: { ...DEFAULT_ADVANCED_CONFIG.matchmaking, ...(advanced.matchmaking || {}) },
      ranked: { ...DEFAULT_ADVANCED_CONFIG.ranked, ...(advanced.ranked || {}) },
      economy: { ...DEFAULT_ADVANCED_CONFIG.economy, ...(advanced.economy || {}), dustValues: { ...DEFAULT_ADVANCED_CONFIG.economy.dustValues, ...(advanced.economy?.dustValues || {}) } },
      presentation: { ...DEFAULT_ADVANCED_CONFIG.presentation, ...(advanced.presentation || {}) },
      localization: { ...DEFAULT_ADVANCED_CONFIG.localization, ...(advanced.localization || {}) },
      moderation: { ...DEFAULT_ADVANCED_CONFIG.moderation, ...(advanced.moderation || {}) },
    },
  };
}

async function resolveRuntimeOverrides(config: GameConfig): Promise<GameConfig> {
  let candidate = config;
  try {
    const { getRuntimeEngineContract, getRuntimeDefinition } = await import("@/lib/control-plane");
    if (config.advanced.engine.runtimeOverridesEnabled) {
      const contract = await getRuntimeEngineContract();
      const capacity = (adapter: string, fallback: number) => Number(contract.zones.find((item) => item.payload.runtimeAdapter === adapter)?.payload.capacity) || fallback;
      candidate = normalizeGameConfig({
        ...candidate,
        deckMax: capacity("deck", candidate.deckMax),
        handCap: capacity("hand", candidate.handCap),
        benchCap: capacity("bench", candidate.benchCap),
        permanentsCap: capacity("permanents", candidate.permanentsCap),
        advanced: {
          ...candidate.advanced,
          engine: {
            ...candidate.advanced.engine,
            actionAllowlist: contract.actions
              .filter((item) => item.payload.enabled !== false && item.payload.runtimeAdapter !== "metadata")
              .map((item) => String(item.payload.runtimeAction || item.key)),
            phaseSequence: contract.phases
              .filter((item) => item.payload.runtimeAdapter !== "metadata")
              .sort((a, b) => Number(a.payload.order) - Number(b.payload.order))
              .map((item) => String(item.payload.id || item.key)),
          },
        },
      });
    }

    // Published Total Control definitions are runtime controls, not decorative
    // metadata. Merge the selected definitions over safe settings while still
    // passing the same invariants used by the Admin settings endpoint.
    const [moderation, visual, localization, audio] = await Promise.all([
      getRuntimeDefinition("moderation-rules", "default"),
      getRuntimeDefinition("visual-themes", candidate.advanced.presentation.defaultTheme),
      getRuntimeDefinition("localizations", candidate.advanced.localization.defaultLocale.toLowerCase()),
      getRuntimeDefinition("audio-cues", "master"),
    ]);
    candidate = normalizeGameConfig({
      ...candidate,
      advanced: {
        ...candidate.advanced,
        moderation: {
          ...candidate.advanced.moderation,
          ...(moderation && Number.isFinite(Number(moderation.chatMaxLength)) ? { chatMaxLength: Math.max(1, Math.min(2000, Math.trunc(Number(moderation.chatMaxLength)))) } : {}),
          ...(moderation && Number.isFinite(Number(moderation.floodWindowSeconds)) ? { floodWindowSeconds: Math.max(1, Math.min(600, Math.trunc(Number(moderation.floodWindowSeconds)))) } : {}),
          ...(moderation && Number.isFinite(Number(moderation.floodMaxMessages)) ? { floodMaxMessages: Math.max(1, Math.min(100, Math.trunc(Number(moderation.floodMaxMessages)))) } : {}),
          ...(moderation && Number.isFinite(Number(moderation.replayRetentionDays)) ? { replayRetentionDays: Math.max(1, Math.min(3650, Math.trunc(Number(moderation.replayRetentionDays)))) } : {}),
          ...(typeof moderation?.allowDeckModeration === "boolean" ? { allowDeckModeration: moderation.allowDeckModeration } : {}),
        },
        presentation: {
          ...candidate.advanced.presentation,
          ...(visual?.board ? { defaultBoard: String(visual.board).slice(0, 80) } : {}),
          ...(Number.isFinite(Number(visual?.fxIntensity)) ? { fxIntensity: Math.max(0, Math.min(2, Number(visual?.fxIntensity))) } : {}),
          ...(typeof visual?.reduceMotion === "boolean" ? { reduceMotionDefault: visual.reduceMotion } : {}),
          ...(audio?.muted === true ? { masterVolume: 0 } : Number.isFinite(Number(audio?.volume)) ? { masterVolume: Math.max(0, Math.min(1, Number(audio?.volume))) } : {}),
        },
        localization: {
          ...candidate.advanced.localization,
          ...(localization?.locale ? { defaultLocale: String(localization.locale).slice(0, 20) } : {}),
          ...(localization?.fallback ? { fallbackLocale: String(localization.fallback).slice(0, 20) } : {}),
        },
      },
    });
    return validateGameConfig(candidate).length ? config : candidate;
  } catch {
    // A control-plane read failure must never erase the last valid settings.
    return config;
  }
}

async function reloadGameConfig(): Promise<GameConfig> {
  if (typeof window !== "undefined") {
    loaded = true;
    lastCheckedAt = Date.now();
    return cached;
  }

  const hadValidSnapshot = loaded;
  try {
    const { db } = await import("@/db");
    const { gameSettings } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(gameSettings).where(eq(gameSettings.key, "main")).limit(1);
    const persisted = row?.value && typeof row.value === "object"
      ? normalizeGameConfig(row.value as Partial<GameConfig>)
      : normalizeGameConfig(DEFAULT_CONFIG);
    const persistedErrors = validateGameConfig(persisted);
    if (persistedErrors.length) throw new GameConfigValidationError(persistedErrors);
    cachedRevision = Number((row as { revision?: number } | undefined)?.revision ?? 0);
    cached = await resolveRuntimeOverrides(persisted);
    loaded = true;
    await applyEngineRuntime(cached);
  } catch {
    // Fail-open to the last known-good snapshot. Only a cold start with no
    // database snapshot falls back to defaults.
    if (!hadValidSnapshot) {
      cached = normalizeGameConfig(DEFAULT_CONFIG);
      loaded = true;
      await applyEngineRuntime(cached);
    }
  } finally {
    lastCheckedAt = Date.now();
  }
  return cached;
}

export async function loadGameConfig(): Promise<GameConfig> {
  if (!loading) loading = reloadGameConfig().finally(() => { loading = null; });
  return loading;
}

export function getGameConfigSync(): GameConfig {
  return cached;
}

/**
 * Refreshes settings at most once per TTL per process. This keeps horizontally
 * scaled instances convergent after a Studio publish without querying the DB
 * on every action. Concurrent requests share the same in-flight refresh.
 */
export async function ensureConfigLoaded(): Promise<GameConfig> {
  if (typeof window !== "undefined") return cached;
  if (!loaded || Date.now() - lastCheckedAt >= configCacheTtlMs()) return loadGameConfig();
  return cached;
}

export function invalidateGameConfigCache(): void {
  lastCheckedAt = 0;
}


export function getGameConfigRevision(): number {
  return cachedRevision;
}

export class GameConfigConflictError extends Error {
  constructor(public readonly currentRevision: number) {
    super(`Game settings changed concurrently (current revision ${currentRevision})`);
    this.name = "GameConfigConflictError";
  }
}

export class GameConfigValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join("; "));
    this.name = "GameConfigValidationError";
  }
}

function mergeAdvancedConfig(base: AdvancedGameConfig, partial?: AdvancedGameConfigPatch): AdvancedGameConfig {
  if (!partial) return base;
  return {
    ...base,
    ...partial,
    engine: { ...base.engine, ...(partial.engine || {}) },
    ai: { ...base.ai, ...(partial.ai || {}) },
    matchmaking: { ...base.matchmaking, ...(partial.matchmaking || {}) },
    ranked: { ...base.ranked, ...(partial.ranked || {}) },
    economy: {
      ...base.economy,
      ...(partial.economy || {}),
      dustValues: { ...base.economy.dustValues, ...(partial.economy?.dustValues || {}) },
    },
    presentation: { ...base.presentation, ...(partial.presentation || {}) },
    localization: { ...base.localization, ...(partial.localization || {}) },
    moderation: { ...base.moderation, ...(partial.moderation || {}) },
  };
}

export function mergeGameConfig(base: GameConfig, partial: GameConfigPatch): GameConfig {
  return normalizeGameConfig({
    ...base,
    ...partial,
    advanced: mergeAdvancedConfig(base.advanced, partial.advanced),
  });
}

export function validateGameConfig(config: GameConfig): string[] {
  const errors: string[] = [];
  const finiteRange = (label: string, value: number, min: number, max: number) => {
    if (!Number.isFinite(value) || value < min || value > max) errors.push(`${label} must be between ${min} and ${max}`);
  };
  finiteRange("nexusStart", config.nexusStart, 1, 200);
  finiteRange("maxMana", config.maxMana, 1, 50);
  finiteRange("maxSpellMana", config.maxSpellMana, 0, 50);
  finiteRange("handCap", config.handCap, 1, 50);
  finiteRange("startHand", config.startHand, 0, 20);
  finiteRange("benchCap", config.benchCap, 1, 30);
  finiteRange("permanentsCap", config.permanentsCap, 0, 30);
  finiteRange("deckMin", config.deckMin, 1, 100);
  finiteRange("deckMax", config.deckMax, 1, 100);
  finiteRange("maxCopies", config.maxCopies, 1, 10);
  finiteRange("maxRegions", config.maxRegions, 1, 3);
  finiteRange("reactionMs", config.reactionMs, 500, 120_000);
  if (config.deckMin > config.deckMax) errors.push("deckMin cannot exceed deckMax");
  if (config.startHand > config.handCap) errors.push("startHand cannot exceed handCap");
  if (config.maxSpellMana > config.maxMana) errors.push("maxSpellMana cannot exceed maxMana");

  const engine = config.advanced.engine;
  finiteRange("engine.maxRounds", engine.maxRounds, 1, 5_000);
  finiteRange("engine.fatigueStart", engine.fatigueStart, 0, 100);
  finiteRange("engine.fatigueStep", engine.fatigueStep, 0, 100);
  if (!engine.phaseSequence.length) errors.push("engine.phaseSequence cannot be empty");
  if (!engine.actionAllowlist.length) errors.push("engine.actionAllowlist cannot be empty");

  const ai = config.advanced.ai;
  finiteRange("ai.aggressionScale", ai.aggressionScale, 0, 5);
  finiteRange("ai.valueScale", ai.valueScale, 0, 5);
  finiteRange("ai.reactionDepth", ai.reactionDepth, 0, 20);
  finiteRange("ai.randomness", ai.randomness, 0, 1);

  const mm = config.advanced.matchmaking;
  finiteRange("matchmaking.baseRange", mm.baseRange, 0, 5_000);
  finiteRange("matchmaking.maxRange", mm.maxRange, 0, 10_000);
  finiteRange("matchmaking.rangeStep", mm.rangeStep, 0, 1_000);
  finiteRange("matchmaking.rangeStepSeconds", mm.rangeStepSeconds, 1, 600);
  finiteRange("matchmaking.staleSeconds", mm.staleSeconds, 1, 600);
  finiteRange("matchmaking.queueTtlSeconds", mm.queueTtlSeconds, 30, 86_400);
  finiteRange("matchmaking.rematchCooldownSeconds", mm.rematchCooldownSeconds, 0, 86_400);
  finiteRange("matchmaking.aiFallbackSeconds", mm.aiFallbackSeconds, 0, 600);
  if (mm.baseRange > mm.maxRange) errors.push("matchmaking.baseRange cannot exceed maxRange");

  const ranked = config.advanced.ranked;
  finiteRange("ranked.eloDivisor", ranked.eloDivisor, 1, 10_000);
  finiteRange("ranked.placementK", ranked.placementK, 1, 500);
  finiteRange("ranked.normalK", ranked.normalK, 1, 500);
  finiteRange("ranked.minimumMmr", ranked.minimumMmr, 0, 1_000_000);
  finiteRange("ranked.leaderboardSize", ranked.leaderboardSize, 1, 10_000);

  const economy = config.advanced.economy;
  finiteRange("economy.loginClaimHours", economy.loginClaimHours, 1, 168);
  finiteRange("economy.loginResetHours", economy.loginResetHours, economy.loginClaimHours, 720);
  finiteRange("economy.duplicateCap", economy.duplicateCap, 1, 10);
  for (const [rarity, value] of Object.entries(economy.dustValues)) finiteRange(`economy.dustValues.${rarity}`, value, 0, 1_000_000);

  const presentation = config.advanced.presentation;
  finiteRange("presentation.fxIntensity", presentation.fxIntensity, 0, 2);
  finiteRange("presentation.masterVolume", presentation.masterVolume, 0, 1);
  const moderation = config.advanced.moderation;
  finiteRange("moderation.chatMaxLength", moderation.chatMaxLength, 1, 2_000);
  finiteRange("moderation.floodWindowSeconds", moderation.floodWindowSeconds, 1, 600);
  finiteRange("moderation.floodMaxMessages", moderation.floodMaxMessages, 1, 100);
  finiteRange("moderation.replayRetentionDays", moderation.replayRetentionDays, 1, 3_650);
  return errors;
}

/** Hydrates the browser-side synchronous rules used by deck/UI helpers. */
export async function hydrateClientGameConfig(partial: GameConfigPatch): Promise<GameConfig> {
  if (typeof window === "undefined") return ensureConfigLoaded();
  cached = mergeGameConfig(cached, partial);
  loaded = true;
  lastCheckedAt = Date.now();
  await applyEngineRuntime(cached);
  return cached;
}

export async function saveGameConfig(partial: GameConfigPatch, expectedRevision?: number): Promise<GameConfig> {
  if (typeof window !== "undefined") {
    const next = mergeGameConfig(cached, partial);
    const errors = validateGameConfig(next);
    if (errors.length) throw new GameConfigValidationError(errors);
    cached = next;
    cachedRevision += 1;
    loaded = true;
    lastCheckedAt = Date.now();
    await applyEngineRuntime(cached);
    return next;
  }

  const { pool } = await import("@/db");
  const client = await pool.connect();
  let persisted: GameConfig;
  let nextRevision = 0;
  try {
    await client.query("begin");
    const result = await client.query<{ value: unknown; revision: number }>(
      "select value, revision from game_settings where key = $1 for update",
      ["main"],
    );
    const row = result.rows[0];
    const currentRevision = Number(row?.revision ?? 0);
    if (expectedRevision !== undefined && expectedRevision !== currentRevision) {
      throw new GameConfigConflictError(currentRevision);
    }
    const base = row?.value && typeof row.value === "object"
      ? normalizeGameConfig(row.value as Partial<GameConfig>)
      : normalizeGameConfig(DEFAULT_CONFIG);
    persisted = mergeGameConfig(base, partial);
    const errors = validateGameConfig(persisted);
    if (errors.length) throw new GameConfigValidationError(errors);
    nextRevision = currentRevision + 1;

    if (row) {
      await client.query(
        "update game_settings set value = $1::jsonb, revision = $2, updated_at = now() where key = $3",
        [JSON.stringify(persisted), nextRevision, "main"],
      );
    } else {
      await client.query(
        "insert into game_settings(key, value, revision) values($1, $2::jsonb, $3)",
        ["main", JSON.stringify(persisted), nextRevision],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  cached = await resolveRuntimeOverrides(persisted!);
  cachedRevision = nextRevision;
  loaded = true;
  lastCheckedAt = Date.now();
  await applyEngineRuntime(cached);
  return cached;
}
