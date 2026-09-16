import type { GameEvent } from "./events";
import type { FxExecutionPlan, FxQuality } from "./fx-plan";

/** Presentation-only visual identity. Never feeds back into engine state. */
export type FxVisualIdentity =
  | "neutral"
  | "impact"
  | "vitality"
  | "death"
  | "poison"
  | "barrier"
  | "frost"
  | "stun"
  | "ascension";

export type FxParticleShape = "spark" | "shard" | "mist" | "ring" | "mote";
export type FxTrailStyle = "none" | "short" | "stream" | "burst";

export interface FxVisualProfile {
  identity: FxVisualIdentity;
  particleShape: FxParticleShape;
  trail: FxTrailStyle;
  glow: number;
  bloom: number;
}

export interface FxVisualBudget {
  particles: number;
  trailSegments: number;
  glow: number;
  bloom: number;
}

const QUALITY_TRAIL_SEGMENTS: Record<FxQuality, number> = {
  low: 0,
  medium: 3,
  high: 6,
  ultra: 10,
};

export function resolveFxVisualProfile(event: GameEvent): FxVisualProfile {
  switch (event.type) {
    case "UNIT_DAMAGED":
    case "NEXUS_DAMAGED":
    case "UNIT_ATTACK_STARTED":
      return { identity: "impact", particleShape: "spark", trail: event.type === "UNIT_ATTACK_STARTED" ? "stream" : "burst", glow: .72, bloom: .45 };
    case "UNIT_HEALED":
    case "NEXUS_HEALED":
      return { identity: "vitality", particleShape: "mote", trail: "short", glow: .78, bloom: .52 };
    case "UNIT_DIED":
      return { identity: "death", particleShape: "mist", trail: "burst", glow: .38, bloom: .28 };
    case "UNIT_LEVELLED_UP":
      return { identity: "ascension", particleShape: "ring", trail: "stream", glow: 1, bloom: .9 };
    case "NEXUS_POISONED":
      return { identity: "poison", particleShape: "mist", trail: "short", glow: .62, bloom: .38 };
    case "STATUS_APPLIED":
      if (event.status === "barrier") return { identity: "barrier", particleShape: "ring", trail: "short", glow: .88, bloom: .64 };
      if (event.status === "frostbitten") return { identity: "frost", particleShape: "shard", trail: "burst", glow: .86, bloom: .58 };
      return { identity: "stun", particleShape: "spark", trail: "short", glow: .74, bloom: .5 };
    case "STATUS_REMOVED":
      return { identity: "barrier", particleShape: "shard", trail: "burst", glow: .84, bloom: .56 };
    default:
      return { identity: "neutral", particleShape: "mote", trail: "short", glow: .58, bloom: .36 };
  }
}

export function buildFxVisualBudget(plan: FxExecutionPlan, quality: FxQuality): FxVisualBudget {
  const disabled = plan.particleBudget <= 0;
  return {
    particles: plan.particleBudget,
    trailSegments: disabled ? 0 : QUALITY_TRAIL_SEGMENTS[quality],
    glow: disabled ? 0 : Math.min(1, quality === "ultra" ? 1 : quality === "high" ? .78 : .52),
    bloom: disabled ? 0 : Math.min(1, quality === "ultra" ? .9 : quality === "high" ? .62 : .36),
  };
}
