const DEFAULT_DB_CONNECTION_TIMEOUT_MS = 20_000;
const MIN_DB_CONNECTION_TIMEOUT_MS = 1_000;
const MAX_DB_CONNECTION_TIMEOUT_MS = 60_000;

export function certificationDbConnectionTimeoutMs(): number {
  const configured = Number(process.env.DB_POOL_CONNECTION_TIMEOUT_MS ?? DEFAULT_DB_CONNECTION_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_DB_CONNECTION_TIMEOUT_MS;
  return Math.max(MIN_DB_CONNECTION_TIMEOUT_MS, Math.min(MAX_DB_CONNECTION_TIMEOUT_MS, Math.trunc(configured)));
}
