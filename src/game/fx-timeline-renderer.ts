import type { GameEvent } from "./events";
import type { FxExecutionPlan } from "./fx-plan";

export interface FxTimelineHandle { cancel(): void; }

const noopHandle = (): FxTimelineHandle => ({ cancel() {} });

/**
 * Presentation-only GSAP timeline renderer.
 * Uses a disposable overlay so it never competes with Motion/CardView transforms
 * and never owns authoritative game state.
 */
export async function playFxTimeline(
  target: HTMLElement | null,
  event: GameEvent,
  plan: FxExecutionPlan,
): Promise<FxTimelineHandle> {
  if (!target || typeof document === "undefined" || plan.renderer !== "timeline") return noopHandle();

  try {
    const { gsap } = await import("gsap");
    if (!target.isConnected) return noopHandle();

    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return noopHandle();

    const overlay = document.createElement("i");
    overlay.setAttribute("aria-hidden", "true");
    overlay.dataset.forgedFxTimeline = event.type;
    Object.assign(overlay.style, {
      position: "fixed",
      pointerEvents: "none",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      borderRadius: "18px",
      border: "1px solid rgba(255,255,255,.42)",
      boxShadow: "0 0 0 1px rgba(103,232,249,.15), 0 0 28px rgba(103,232,249,.25)",
      background: "radial-gradient(circle at 50% 45%, rgba(255,255,255,.22), rgba(103,232,249,.08) 42%, transparent 72%)",
      mixBlendMode: "screen",
      zIndex: "92",
      transformOrigin: "50% 50%",
    });
    document.body.appendChild(overlay);

    let cancelled = false;
    const duration = Math.max(0.18, Math.min(1, plan.durationMs / 1000 + plan.comboDepth * 0.035));
    const timeline = gsap.timeline({
      onComplete: () => {
        if (!cancelled) overlay.remove();
      },
    });

    timeline.fromTo(
      overlay,
      { autoAlpha: 0, scale: 0.9, rotateZ: event.type === "UNIT_DIED" ? -2 : 0 },
      { autoAlpha: Math.min(1, 0.9 + plan.comboDepth * 0.025), scale: 1 + 0.025 * plan.comboScale, rotateZ: 0, duration: duration * 0.34, ease: "power2.out" },
    ).to(overlay, {
      autoAlpha: 0,
      scale: event.type === "UNIT_DIED" ? Math.max(0.78, 0.86 - plan.comboDepth * 0.015) : 1.07 + plan.comboDepth * 0.012,
      filter: event.type === "UNIT_DIED" ? "blur(6px) grayscale(1)" : "blur(2px)",
      duration: duration * 0.66,
      ease: "power2.inOut",
    });

    return {
      cancel() {
        if (cancelled) return;
        cancelled = true;
        timeline.kill();
        overlay.remove();
      },
    };
  } catch {
    return noopHandle();
  }
}
