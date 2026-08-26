"use client";

import { useEffect, useState } from "react";

export type PerformanceTier = "normal" | "constrained";

/**
 * Small, presentation-only guard. It samples a short animation window and
 * suppresses expensive ambient layers on consistently slow devices. Rules,
 * timings and authoritative actions are never changed.
 */
export function useFrameHealth(): PerformanceTier {
  const [tier, setTier] = useState<PerformanceTier>("normal");
  useEffect(() => {
    let raf = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || (navigator.hardwareConcurrency ?? 8) <= 4) {
      raf = requestAnimationFrame(() => setTier("constrained"));
      return () => cancelAnimationFrame(raf);
    }
    let frame = 0;
    const started = performance.now();
    const sample = (now: number) => {
      frame += 1;
      const elapsed = now - started;
      if (elapsed >= 2200) {
        const fps = frame / (elapsed / 1000);
        setTier(fps < 42 ? "constrained" : "normal");
        return;
      }
      raf = requestAnimationFrame(sample);
    };
    raf = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(raf);
  }, []);
  return tier;
}
