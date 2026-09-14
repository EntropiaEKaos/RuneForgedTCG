"use client";

const TELEMETRY_SESSION_KEY = "runeforge_telemetry_session";
const TELEMETRY_ONCE_PREFIX = "runeforge_telemetry_once:";

type TelemetryPrimitive = string | number | boolean | null;
export type TelemetryProperties = Record<string, TelemetryPrimitive | TelemetryPrimitive[]>;

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `rf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getTelemetrySessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.sessionStorage.getItem(TELEMETRY_SESSION_KEY);
    if (existing) return existing;
    const created = createSessionId();
    window.sessionStorage.setItem(TELEMETRY_SESSION_KEY, created);
    return created;
  } catch {
    return createSessionId();
  }
}

/**
 * First-party product telemetry is deliberately best-effort. Analytics must
 * never block navigation, matchmaking, settlement or any other player action.
 * Player identity is resolved server-side from the existing session; callers
 * must only send low-cardinality, non-sensitive product context.
 */
export function trackTelemetry(eventName: string, properties: TelemetryProperties = {}): void {
  if (typeof window === "undefined") return;
  const sessionId = getTelemetrySessionId();
  void fetch("/api/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    keepalive: true,
    body: JSON.stringify({ eventName, sessionId, properties }),
  }).catch(() => {
    // Telemetry failure is intentionally non-fatal and invisible to gameplay.
  });
}

/** Session-scoped de-duplication for one-shot funnel milestones. */
export function trackTelemetryOnce(eventName: string, properties: TelemetryProperties = {}): void {
  if (typeof window === "undefined") return;
  try {
    const marker = `${TELEMETRY_ONCE_PREFIX}${eventName}`;
    if (window.sessionStorage.getItem(marker) === "1") return;
    window.sessionStorage.setItem(marker, "1");
  } catch {
    // Storage may be unavailable; telemetry remains best-effort.
  }
  trackTelemetry(eventName, properties);
}
