import type { GameEvent } from "./events";

/** Presentation-only FX vocabulary. Engine state never depends on this layer. */
export type FxPresetId = "summon-default" | "attack-default" | "damage-default" | "heal-default" | "death-default" | "levelup-default" | "poison-default" | "barrier-default" | "barrierbreak-default" | "frost-default" | "stun-default";
export type FxRenderer = "motion" | "timeline" | "gpu";
export type FxIntensity = "subtle" | "standard" | "cinematic";
export interface FxPreset { id: FxPresetId; renderer: FxRenderer; intensity: FxIntensity; durationMs: number; screenShake?: "light" | "medium" | "heavy"; targetFlashMs?: number; particleBudget?: number; soundCue?: string; }
export const FORGED_FX_PRESETS = {
  "summon-default": { id: "summon-default", renderer: "timeline", intensity: "standard", durationMs: 520, particleBudget: 18, soundCue: "summon" },
  "attack-default": { id: "attack-default", renderer: "motion", intensity: "standard", durationMs: 260, screenShake: "light", soundCue: "attack" },
  "damage-default": { id: "damage-default", renderer: "timeline", intensity: "standard", durationMs: 320, screenShake: "light", targetFlashMs: 110, particleBudget: 12, soundCue: "damage" },
  "heal-default": { id: "heal-default", renderer: "timeline", intensity: "subtle", durationMs: 420, targetFlashMs: 140, particleBudget: 10, soundCue: "heal" },
  "death-default": { id: "death-default", renderer: "timeline", intensity: "cinematic", durationMs: 620, screenShake: "medium", particleBudget: 22, soundCue: "death" },
  "levelup-default": { id: "levelup-default", renderer: "gpu", intensity: "cinematic", durationMs: 900, screenShake: "medium", targetFlashMs: 180, particleBudget: 36, soundCue: "levelup" },
  "poison-default": { id: "poison-default", renderer: "gpu", intensity: "standard", durationMs: 520, particleBudget: 20, soundCue: "poison" },
  "barrier-default": { id: "barrier-default", renderer: "gpu", intensity: "standard", durationMs: 460, targetFlashMs: 120, particleBudget: 18, soundCue: "barrier" },
  "barrierbreak-default": { id: "barrierbreak-default", renderer: "timeline", intensity: "standard", durationMs: 380, targetFlashMs: 100, particleBudget: 12, soundCue: "barrierbreak" },
  "frost-default": { id: "frost-default", renderer: "gpu", intensity: "standard", durationMs: 540, targetFlashMs: 140, particleBudget: 24, soundCue: "frost" },
  "stun-default": { id: "stun-default", renderer: "timeline", intensity: "standard", durationMs: 420, screenShake: "light", targetFlashMs: 100, particleBudget: 10, soundCue: "stun" },
} as const satisfies Record<FxPresetId, FxPreset>;
export interface ResolvedFx { preset: FxPreset; event: GameEvent; }
export function resolveGameEventFx(event: GameEvent): ResolvedFx | null {
  let id: FxPresetId | null = null;
  switch (event.type) {
    case "UNIT_SUMMONED": id = "summon-default"; break;
    case "UNIT_ATTACK_STARTED": id = "attack-default"; break;
    case "UNIT_DAMAGED": case "NEXUS_DAMAGED": id = "damage-default"; break;
    case "UNIT_HEALED": case "NEXUS_HEALED": id = "heal-default"; break;
    case "UNIT_DIED": id = "death-default"; break;
    case "UNIT_LEVELLED_UP": id = "levelup-default"; break;
    case "NEXUS_POISONED": id = "poison-default"; break;
    case "STATUS_APPLIED": if (event.status === "barrier") id = "barrier-default"; else if (event.status === "frostbitten") id = "frost-default"; else if (event.status === "stunned") id = "stun-default"; break;
    case "STATUS_REMOVED": id = "barrierbreak-default"; break;
  }
  return id ? { preset: FORGED_FX_PRESETS[id], event } : null;
}
export function resolveGameEventBatchFx(events: readonly GameEvent[]): ResolvedFx[] { return events.map(resolveGameEventFx).filter((value): value is ResolvedFx => value !== null); }
