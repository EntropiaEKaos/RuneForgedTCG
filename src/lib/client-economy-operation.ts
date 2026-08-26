const PREFIX = "rf_economy_op:";

function safeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try { return window.sessionStorage; } catch { return null; }
}

/**
 * Keep a mutation id stable across a lost/5xx response. A deterministic server
 * response clears the pending id so a later user intent gets a fresh operation.
 */
export function pendingEconomyOperationId(fingerprint: string): string {
  const storage = safeStorage();
  const key = `${PREFIX}${fingerprint}`;
  const existing = storage?.getItem(key)?.trim();
  if (existing && /^[A-Za-z0-9._:-]{16,100}$/.test(existing)) return existing;
  const created = crypto.randomUUID();
  storage?.setItem(key, created);
  return created;
}

export function settleEconomyOperation(fingerprint: string, responseStatus: number) {
  // A 4xx is a deterministic business/request outcome and 2xx is committed or
  // safely replayed. Keep the id on 5xx/network uncertainty for the next retry.
  if (responseStatus < 500) safeStorage()?.removeItem(`${PREFIX}${fingerprint}`);
}
