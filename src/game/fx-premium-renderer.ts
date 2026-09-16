import type { FxExecutionPlan } from "./fx-plan";

export interface FxPremiumHandle { cancel(): void; }

/** Presentation-only legendary accent. Never affects engine state, targeting, timing authority or layout. */
export function playFxPremiumModifier(target: Element | null, plan: FxExecutionPlan): FxPremiumHandle | null {
  if (!target || typeof document === "undefined") return null;
  const host = target.closest('[data-fx-premium="legendary"]') ?? (target.matches('[data-fx-premium="legendary"]') ? target : null);
  if (!host) return null;
  const rect = host.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const halo = document.createElement("i");
  Object.assign(halo.style, { position: "fixed", left: `${rect.left - 8}px`, top: `${rect.top - 8}px`, width: `${rect.width + 16}px`, height: `${rect.height + 16}px`, borderRadius: "18px", pointerEvents: "none", zIndex: "91", border: "1px solid rgba(255,224,128,.82)", boxShadow: "0 0 18px rgba(255,190,64,.52), inset 0 0 18px rgba(255,236,170,.24)", mixBlendMode: "screen" } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(halo);

  const duration = Math.max(320, Math.min(1100, plan.durationMs + 180));
  let animation: Animation | null = null;
  try { animation = halo.animate([
    { opacity: 0, transform: "scale(.88) rotate(-1deg)", filter: "brightness(1.8)" },
    { opacity: 1, transform: "scale(1.035) rotate(.5deg)", filter: "brightness(1.25)", offset: .38 },
    { opacity: .72, transform: "scale(1) rotate(0deg)", filter: "brightness(1.05)", offset: .72 },
    { opacity: 0, transform: "scale(1.015)", filter: "brightness(1)" },
  ], { duration, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" }); } catch { halo.remove(); return null; }

  let cancelled = false;
  const cleanup = () => { if (cancelled) return; cancelled = true; try { animation?.cancel(); } catch {} halo.remove(); };
  const timer = window.setTimeout(cleanup, duration + 80);
  return { cancel() { window.clearTimeout(timer); cleanup(); } };
}
