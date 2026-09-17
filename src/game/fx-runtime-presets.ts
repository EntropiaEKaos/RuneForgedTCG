import { FORGED_FX_PRESETS, type FxIntensity, type FxPreset, type FxPresetId, type FxRenderer } from "./fx-registry";

export type FxPresetOverrides = Partial<Record<FxPresetId, FxPreset>>;

const PRESET_IDS = new Set<FxPresetId>(Object.keys(FORGED_FX_PRESETS) as FxPresetId[]);
const RENDERERS = new Set<FxRenderer>(["motion", "timeline", "gpu"]);
const INTENSITIES = new Set<FxIntensity>(["subtle", "standard", "cinematic"]);
const SHAKES = new Set(["light", "medium"] as const);

type PublishedFxPresetRow = {
  key?: unknown;
  renderer?: unknown;
  intensity?: unknown;
  durationMs?: unknown;
  particleBudget?: unknown;
  screenShake?: unknown;
  targetFlashMs?: unknown;
  soundCue?: unknown;
};

function boundedInteger(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

function normalizeRow(row: PublishedFxPresetRow): FxPreset | null {
  if (typeof row.key !== "string" || !PRESET_IDS.has(row.key as FxPresetId)) return null;
  if (typeof row.renderer !== "string" || !RENDERERS.has(row.renderer as FxRenderer)) return null;
  if (typeof row.intensity !== "string" || !INTENSITIES.has(row.intensity as FxIntensity)) return null;
  if (!boundedInteger(row.durationMs, 80, 5000) || !boundedInteger(row.particleBudget, 0, 36)) return null;
  if (row.screenShake !== null && row.screenShake !== undefined && (typeof row.screenShake !== "string" || !SHAKES.has(row.screenShake as "light" | "medium"))) return null;
  if (row.targetFlashMs !== null && row.targetFlashMs !== undefined && !boundedInteger(row.targetFlashMs, 0, 2000)) return null;
  if (row.soundCue !== null && row.soundCue !== undefined && (typeof row.soundCue !== "string" || row.soundCue.length > 80)) return null;

  const id = row.key as FxPresetId;
  return {
    ...FORGED_FX_PRESETS[id],
    id,
    renderer: row.renderer as FxRenderer,
    intensity: row.intensity as FxIntensity,
    durationMs: row.durationMs as number,
    particleBudget: row.particleBudget as number,
    ...(row.screenShake === null || row.screenShake === undefined ? { screenShake: undefined } : { screenShake: row.screenShake as "light" | "medium" }),
    ...(row.targetFlashMs === null || row.targetFlashMs === undefined ? { targetFlashMs: undefined } : { targetFlashMs: row.targetFlashMs as number }),
    ...(row.soundCue === null || row.soundCue === undefined ? { soundCue: undefined } : { soundCue: row.soundCue as string }),
  };
}

export function parsePublishedFxPresets(payload: unknown): FxPresetOverrides {
  if (!payload || typeof payload !== "object") return {};
  const presets = (payload as { presets?: unknown }).presets;
  if (!Array.isArray(presets)) return {};

  const overrides: FxPresetOverrides = {};
  for (const candidate of presets) {
    if (!candidate || typeof candidate !== "object") continue;
    const preset = normalizeRow(candidate as PublishedFxPresetRow);
    if (preset) overrides[preset.id] = preset;
  }
  return overrides;
}

export function applyFxPresetOverrides<T extends { preset: FxPreset }>(resolved: T, overrides: FxPresetOverrides): T {
  const preset = overrides[resolved.preset.id];
  return preset ? { ...resolved, preset } : resolved;
}
