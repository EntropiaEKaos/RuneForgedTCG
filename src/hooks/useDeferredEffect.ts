"use client";

import { useEffect, type DependencyList } from "react";

type DeferredCleanup = void | (() => void);
type DeferredCallback = () => DeferredCleanup | Promise<DeferredCleanup>;

/**
 * Runs hydration/data-loading effects after the current render has committed.
 * Cancellation covers both the deferred callback and any cleanup it returns.
 */
export function useDeferredEffect(callback: DeferredCallback, dependencies: DependencyList) {
  useEffect(() => {
    let active = true;
    let cleanup: DeferredCleanup;
    const timer = window.setTimeout(() => {
      if (!active) return;
      Promise.resolve(callback()).then((result) => {
        if (typeof result !== "function") return;
        if (active) cleanup = result;
        else result();
      }).catch(() => {});
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
      if (typeof cleanup === "function") cleanup();
    };
    // The caller owns the dependency contract, matching React.useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}
