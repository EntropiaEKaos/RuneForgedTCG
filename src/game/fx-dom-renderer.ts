import type { FxExecutionPlan } from "./fx-plan";

export interface FxDomAnimationSpec {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}

/**
 * Renderer boundary for lightweight battlefield motion.
 * It owns only the dedicated FX wrapper transform/opacity. Gameplay and card
 * layout remain authoritative elsewhere, leaving an inner cinematic layer free
 * for a future GSAP renderer without transform ownership conflicts.
 */
export function buildFxDomAnimation(plan: FxExecutionPlan): FxDomAnimationSpec | null {
  const duration = plan.durationMs;
  switch (plan.preset.id) {
    case "summon-default":
      return {
        keyframes: [
          { opacity: 0, transform: "translateY(18px) scale(.94)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        options: { duration, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" },
      };
    case "attack-default":
      return {
        keyframes: [
          { transform: "translateY(0) scale(1)" },
          { transform: "translateY(-8px) scale(1.025)", offset: 0.45 },
          { transform: "translateY(0) scale(1)" },
        ],
        options: { duration, easing: "cubic-bezier(.2,.9,.25,1)", fill: "both" },
      };
    case "damage-default":
      return {
        keyframes: [
          { transform: "translateX(0)" },
          { transform: "translateX(-4px)" },
          { transform: "translateX(4px)" },
          { transform: "translateX(0)" },
        ],
        options: { duration, easing: "ease-out", fill: "both" },
      };
    case "heal-default":
      return {
        keyframes: [{ opacity: 0.78 }, { opacity: 1 }],
        options: { duration, easing: "ease-out", fill: "both" },
      };
    case "death-default":
      return {
        keyframes: [
          { opacity: 1, transform: "scale(1)" },
          { opacity: 0, transform: "scale(.92) translateY(10px)" },
        ],
        options: { duration, easing: "cubic-bezier(.4,0,1,1)", fill: "both" },
      };
    default:
      return null;
  }
}

export function playFxDomAnimation(element: Element | null, plan: FxExecutionPlan): Animation | null {
  if (!element || typeof element.animate !== "function") return null;
  const spec = buildFxDomAnimation(plan);
  if (!spec) return null;
  try {
    return element.animate(spec.keyframes, spec.options);
  } catch {
    // Presentation failure must never block gameplay.
    return null;
  }
}
