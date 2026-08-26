import { createHash } from "node:crypto";

export const RECOVERY_TTL_MS = 180 * 24 * 60 * 60_000;

export function recoveryHash(code: string): string {
  return createHash("sha256").update(`runeforge-recovery-v1:${code}`).digest("hex");
}

export function recoveryExpiresAt(nowMs = Date.now()): Date {
  return new Date(nowMs + RECOVERY_TTL_MS);
}

export function recoveryCredentialUsable(
  candidate: { recoveryKeyHash: string | null; recoveryKeyExpiresAt: Date | null },
  presentedCode: string,
  nowMs = Date.now(),
): boolean {
  if (!candidate.recoveryKeyHash || !candidate.recoveryKeyExpiresAt || !presentedCode) return false;
  return candidate.recoveryKeyHash === recoveryHash(presentedCode)
    && candidate.recoveryKeyExpiresAt.getTime() > nowMs;
}
