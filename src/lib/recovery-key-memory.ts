let pendingRecoveryKey: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function publishPendingRecoveryKey(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim() : "";
  pendingRecoveryKey = normalized || null;
  emit();
}

export function getPendingRecoveryKey(): string | null {
  return pendingRecoveryKey;
}

export function clearPendingRecoveryKey() {
  if (!pendingRecoveryKey) return;
  pendingRecoveryKey = null;
  emit();
}

export function subscribePendingRecoveryKey(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
