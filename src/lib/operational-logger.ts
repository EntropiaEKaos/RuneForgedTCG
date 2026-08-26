type LogLevel = "info" | "warn" | "error";
const SECRET_KEY = /(authorization|cookie|password|secret|token|mfa)/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.slice(0, 50).map((entry) => sanitize(entry, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, SECRET_KEY.test(key) ? "[redacted]" : sanitize(entry, depth + 1)]));
  }
  return typeof value === "string" && value.length > 500 ? `${value.slice(0, 500)}…` : value;
}

export function operationalLog(level: LogLevel, event: string, details: Record<string, unknown> = {}) {
  const record = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...sanitize(details) as object });
  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else console.info(record);
}

export function sanitizedLogDetails(details: Record<string, unknown>): Record<string, unknown> {
  return sanitize(details) as Record<string, unknown>;
}
