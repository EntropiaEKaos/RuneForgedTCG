import type { GameEvent } from "./events";
import type { FxExecutionPlan, FxQuality } from "./fx-plan";
import { buildFxVisualBudget, resolveFxVisualProfile } from "./fx-visual-identity";

const PALETTE = {
  neutral: ["#e2e8f0", "#94a3b8"],
  impact: ["#fbbf24", "#fb7185", "#fff7ed"],
  vitality: ["#4ade80", "#a7f3d0", "#ecfdf5"],
  death: ["#94a3b8", "#475569", "#e2e8f0"],
  poison: ["#a3e635", "#65a30d", "#d9f99d"],
  barrier: ["#67e8f9", "#22d3ee", "#cffafe"],
  frost: ["#7dd3fc", "#bae6fd", "#e0f2fe"],
  stun: ["#c4b5fd", "#8b5cf6", "#ede9fe"],
  ascension: ["#fde68a", "#fbbf24", "#fff7d6"],
} as const;

function targetPoint(target: Element): { x: number; y: number } {
  const rect = target.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function makeLayer(): HTMLDivElement {
  const layer = document.createElement("div");
  layer.dataset.forgedFxLayer = "particles";
  Object.assign(layer.style, {
    position: "fixed", inset: "0", zIndex: "90", pointerEvents: "none", overflow: "hidden",
    contain: "strict",
  });
  document.body.appendChild(layer);
  return layer;
}

function particleCss(shape: string, size: number): Partial<CSSStyleDeclaration> {
  if (shape === "ring") return { width: `${size * 2}px`, height: `${size * 2}px`, border: "2px solid currentColor", borderRadius: "999px", background: "transparent" };
  if (shape === "shard") return { width: `${size * .55}px`, height: `${size * 1.8}px`, borderRadius: "2px", transform: "rotate(35deg)" };
  if (shape === "mist") return { width: `${size * 2.2}px`, height: `${size * 1.25}px`, borderRadius: "999px", filter: "blur(4px)" };
  return { width: `${size}px`, height: `${size}px`, borderRadius: shape === "spark" ? "2px" : "999px" };
}

export interface FxParticleHandle { cancel(): void }

/** Disposable presentation-only particles/trails. Failure or cancellation never affects gameplay. */
export function playFxParticles(target: Element | null, event: GameEvent, plan: FxExecutionPlan, quality: FxQuality): FxParticleHandle | null {
  if (!target || plan.particleBudget <= 0 || typeof document === "undefined") return null;
  const profile = resolveFxVisualProfile(event);
  const budget = buildFxVisualBudget(plan, quality);
  if (budget.particles <= 0) return null;

  const layer = makeLayer();
  const animations: Animation[] = [];
  const center = targetPoint(target);
  const palette = PALETTE[profile.identity];
  const count = Math.min(36, budget.particles);
  const duration = Math.max(260, Math.min(1100, plan.durationMs));

  for (let index = 0; index < count; index += 1) {
    const node = document.createElement("i");
    const angle = (Math.PI * 2 * index) / Math.max(1, count) + (index % 3) * .19;
    const distance = 28 + ((index * 17) % 58);
    const size = 4 + (index % 4) * 2;
    const color = palette[index % palette.length];
    Object.assign(node.style, {
      position: "absolute", left: `${center.x}px`, top: `${center.y}px`, color,
      background: profile.particleShape === "ring" ? "transparent" : color,
      boxShadow: `0 0 ${Math.round(10 + 14 * budget.glow)}px ${color}`,
      opacity: "0", willChange: "transform,opacity", transformOrigin: "center",
      ...particleCss(profile.particleShape, size),
    });
    layer.appendChild(node);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - (profile.identity === "vitality" || profile.identity === "ascension" ? 26 : 0);
    try {
      const animation = node.animate([
        { opacity: 0, transform: "translate(-50%,-50%) scale(.35)" },
        { opacity: .95, transform: `translate(calc(-50% + ${dx * .28}px), calc(-50% + ${dy * .28}px)) scale(1)`, offset: .2 },
        { opacity: 0, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.15)` },
      ], { duration: duration * (.72 + (index % 5) * .06), easing: "cubic-bezier(.16,1,.3,1)", fill: "both" });
      animations.push(animation);
    } catch {}
  }

  if (budget.trailSegments > 0 && profile.trail !== "none") {
    for (let index = 0; index < budget.trailSegments; index += 1) {
      const trail = document.createElement("b");
      const width = 24 + index * 7;
      const color = palette[index % palette.length];
      Object.assign(trail.style, {
        position: "absolute", left: `${center.x}px`, top: `${center.y}px`, width: `${width}px`, height: "2px",
        borderRadius: "999px", background: `linear-gradient(90deg, transparent, ${color})`,
        boxShadow: `0 0 ${8 + Math.round(12 * budget.bloom)}px ${color}`, opacity: "0", transformOrigin: "0 50%",
      });
      layer.appendChild(trail);
      const rotation = -55 + (110 * index) / Math.max(1, budget.trailSegments - 1);
      try { animations.push(trail.animate([
        { opacity: 0, transform: `rotate(${rotation}deg) scaleX(.15)` },
        { opacity: .78, transform: `rotate(${rotation}deg) scaleX(1)`, offset: .3 },
        { opacity: 0, transform: `rotate(${rotation}deg) translateX(${18 + index * 2}px) scaleX(.45)` },
      ], { duration: duration * .72, easing: "ease-out", fill: "both" })); } catch {}
    }
  }

  const cleanup = () => { for (const animation of animations) try { animation.cancel(); } catch {}; layer.remove(); };
  window.setTimeout(cleanup, duration + 180);
  return { cancel: cleanup };
}
