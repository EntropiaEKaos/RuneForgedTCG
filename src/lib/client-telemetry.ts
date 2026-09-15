"use client";

import { PRODUCT_BRAND } from "./product-brand";

const SESSION_KEY = `${PRODUCT_BRAND.storagePrefix}_telemetry_session`;

function telemetrySessionId() {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return null;
  }
}

export function trackClientEvent(eventName: string, properties: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    eventName,
    sessionId: telemetrySessionId(),
    properties: {
      schemaVersion: 1,
      brand: PRODUCT_BRAND.displayName,
      path: window.location.pathname,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      ...properties,
    },
  });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon("/api/telemetry", blob)) return;
  }

  void fetch("/api/telemetry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    keepalive: true,
    body: payload,
  }).catch(() => undefined);
}
