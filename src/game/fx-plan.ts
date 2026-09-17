import type { GameEvent } from "./events";
import { resolveGameEventBatchFx, type FxIntensity, type FxPreset, type FxRenderer, type ResolvedFx } from "./fx-registry";
import { applyFxAssociation, type FxAssociation, type FxAssociationContext } from "./fx-associations";
import { applyFxPresetOverrides, ensureRuntimeFxPresetsLoaded, getRuntimeFxPresetOverrides, type FxPresetOverrides } from "./fx-runtime-presets";
import { ensureRuntimeFxAssociationsLoaded, getRuntimeFxAssociations } from "./fx-runtime-associations";

export type FxQuality = "low" | "medium" | "high" | "ultra";
export interface FxCapabilities { quality: FxQuality; reducedMotion: boolean; constrained: boolean; }
export interface FxExecutionPlan extends ResolvedFx { renderer: FxRenderer; intensity: FxIntensity; durationMs: number; particleBudget: number; allowScreenShake: boolean; allowTargetFlash: boolean; }
const QUALITY_PARTICLE_SCALE: Record<FxQuality, number> = { low: 0, medium: 0.45, high: 0.75, ultra: 1 };
function reducedDuration(preset: FxPreset, capabilities: FxCapabilities): number { if (capabilities.reducedMotion) return Math.min(120, preset.durationMs); if (capabilities.constrained) return Math.min(360, preset.durationMs); return preset.durationMs; }
export function buildFxExecutionPlan(resolved: ResolvedFx, capabilities: FxCapabilities): FxExecutionPlan { const scale = capabilities.reducedMotion || capabilities.constrained ? 0 : QUALITY_PARTICLE_SCALE[capabilities.quality]; return { ...resolved, renderer: resolved.preset.renderer, intensity: resolved.preset.intensity, durationMs: reducedDuration(resolved.preset, capabilities), particleBudget: Math.floor((resolved.preset.particleBudget ?? 0) * scale), allowScreenShake: Boolean(resolved.preset.screenShake) && !capabilities.reducedMotion && !capabilities.constrained, allowTargetFlash: Boolean(resolved.preset.targetFlashMs) && !capabilities.reducedMotion }; }
export function buildGameEventFxPlans(events: readonly GameEvent[], capabilities: FxCapabilities, overrides?: FxPresetOverrides, contexts?: ReadonlyMap<GameEvent, FxAssociationContext>, associations?: readonly FxAssociation[]): FxExecutionPlan[] {
  // Both config snapshots load without blocking or replaying authoritative events.
  ensureRuntimeFxPresetsLoaded();
  ensureRuntimeFxAssociationsLoaded();
  const activeOverrides = overrides ?? getRuntimeFxPresetOverrides();
  const activeAssociations = associations ?? getRuntimeFxAssociations();
  return resolveGameEventBatchFx(events)
    .map((resolved) => applyFxAssociation(resolved, contexts?.get(resolved.event) ?? null, activeAssociations))
    .map((resolved) => applyFxPresetOverrides(resolved, activeOverrides))
    .map((resolved) => buildFxExecutionPlan(resolved, capabilities));
}
