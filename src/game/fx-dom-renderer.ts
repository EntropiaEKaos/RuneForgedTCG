import type { FxExecutionPlan } from "./fx-plan";

export interface FxDomAnimationSpec {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}

/** Premium lightweight battlefield motion boundary. Gameplay and layout stay authoritative elsewhere. */
export function buildFxDomAnimation(plan: FxExecutionPlan): FxDomAnimationSpec | null {
  const duration = plan.durationMs;
  switch (plan.preset.id) {
    case "summon-default": return {
      keyframes: [
        { opacity: 0, transform: "translateY(22px) scale(.9)", filter: "brightness(1.55) saturate(1.2)" },
        { opacity: 1, transform: "translateY(-3px) scale(1.025)", filter: "brightness(1.18) saturate(1.1)", offset: .68 },
        { opacity: 1, transform: "translateY(0) scale(1)", filter: "brightness(1) saturate(1)" },
      ], options: { duration, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" },
    };
    case "attack-default": return {
      keyframes: [
        { transform: "translateY(0) scale(1)", filter: "brightness(1)" },
        { transform: "translateY(4px) scale(.985)", filter: "brightness(.94)", offset: .2 },
        { transform: "translateY(-12px) scale(1.04)", filter: "brightness(1.28)", offset: .58 },
        { transform: "translateY(0) scale(1)", filter: "brightness(1)" },
      ], options: { duration, easing: "cubic-bezier(.2,.9,.25,1)", fill: "both" },
    };
    case "damage-default": return {
      keyframes: [
        { transform: "translateX(0) scale(1)", filter: "brightness(1)" },
        { transform: "translateX(-5px) scale(.99)", filter: "brightness(1.5) saturate(1.25)", offset: .18 },
        { transform: "translateX(5px) scale(1.012)", filter: "brightness(1.15)", offset: .38 },
        { transform: "translateX(-2px) scale(1)", filter: "brightness(1.04)", offset: .62 },
        { transform: "translateX(0) scale(1)", filter: "brightness(1)" },
      ], options: { duration, easing: "cubic-bezier(.22,.61,.36,1)", fill: "both" },
    };
    case "heal-default": return {
      keyframes: [
        { opacity: .82, transform: "scale(.985)", filter: "brightness(1) saturate(1)" },
        { opacity: 1, transform: "scale(1.018)", filter: "brightness(1.32) saturate(1.18)", offset: .55 },
        { opacity: 1, transform: "scale(1)", filter: "brightness(1) saturate(1)" },
      ], options: { duration, easing: "ease-out", fill: "both" },
    };
    case "death-default": return {
      keyframes: [
        { opacity: 1, transform: "scale(1) translateY(0)", filter: "brightness(1) grayscale(0)" },
        { opacity: .92, transform: "scale(1.025) translateY(-2px)", filter: "brightness(1.3) grayscale(.25)", offset: .24 },
        { opacity: 0, transform: "scale(.86) translateY(16px)", filter: "brightness(.55) grayscale(1) blur(1px)" },
      ], options: { duration, easing: "cubic-bezier(.4,0,1,1)", fill: "both" },
    };
    case "barrierbreak-default": return {
      keyframes: [
        { transform: "scale(1)", filter: "brightness(1)" },
        { transform: "scale(1.035)", filter: "brightness(1.65) saturate(1.25)", offset: .28 },
        { transform: "scale(.985)", filter: "brightness(.9)", offset: .62 },
        { transform: "scale(1)", filter: "brightness(1)" },
      ], options: { duration, easing: "cubic-bezier(.22,.61,.36,1)", fill: "both" },
    };
    case "stun-default": return {
      keyframes: [
        { transform: "rotate(0deg)", filter: "brightness(1)" },
        { transform: "rotate(-1.2deg)", filter: "brightness(1.25)", offset: .3 },
        { transform: "rotate(1.2deg)", filter: "brightness(1.2)", offset: .58 },
        { transform: "rotate(0deg)", filter: "brightness(1)" },
      ], options: { duration, easing: "ease-out", fill: "both" },
    };
    default: return null;
  }
}

export function playFxDomAnimation(element: Element | null, plan: FxExecutionPlan): Animation | null {
  if (!element || typeof element.animate !== "function") return null;
  const spec = buildFxDomAnimation(plan);
  if (!spec) return null;
  try { return element.animate(spec.keyframes, spec.options); }
  catch { return null; }
}
