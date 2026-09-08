"use client";

import { publishPendingRecoveryKey } from "./recovery-key-memory";

const LEGACY_RECOVERY_KEY = "runeforge_recovery_code";
const PLAYER_NAME_KEY = "runeforge_playername";

export interface PlayerSessionPayload {
  ok: boolean;
  player?: { id: number; name: string; [key: string]: unknown };
  recoveryCode?: string;
  created?: boolean;
  recovered?: boolean;
  error?: string;
  [key: string]: unknown;
}

async function json(response: Response): Promise<PlayerSessionPayload> {
  return response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
}

function takeLegacyRecoveryCode(): string | null {
  // Migration only: old builds persisted the recovery credential in localStorage.
  // Consume it once, delete the persistent copy immediately, then either surface
  // it to the user or use it once to recover/rotate an expired browser session.
  const legacy = localStorage.getItem(LEGACY_RECOVERY_KEY)?.trim() || "";
  localStorage.removeItem(LEGACY_RECOVERY_KEY);
  return legacy || null;
}

function acceptSessionPayload(payload: PlayerSessionPayload) {
  if (payload.recoveryCode) publishPendingRecoveryKey(payload.recoveryCode);
  if (payload.player?.name) localStorage.setItem(PLAYER_NAME_KEY, payload.player.name);
  return payload;
}

export async function ensurePlayerSession(preferredName?: string): Promise<PlayerSessionPayload> {
  const legacyRecoveryCode = takeLegacyRecoveryCode();

  const current = await fetch("/api/player", { cache: "no-store" });
  if (current.ok) {
    let payload = await json(current);
    const normalized = preferredName?.trim();
    const canRename = normalized
      && normalized.toLowerCase() !== "challenger"
      && !normalized.toLowerCase().startsWith("guest-")
      && normalized !== payload.player?.name;
    if (canRename) {
      const renamedResponse = await fetch("/api/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: normalized }),
      });
      const renamed = await json(renamedResponse);
      if (renamed.ok) payload = renamed;
    }
    if (legacyRecoveryCode) publishPendingRecoveryKey(legacyRecoveryCode);
    return acceptSessionPayload(payload);
  }

  if (legacyRecoveryCode) {
    const migratedRecovery = await fetch("/api/player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recoveryCode: legacyRecoveryCode }),
    });
    const migrated = await json(migratedRecovery);
    if (migrated.ok) return acceptSessionPayload(migrated);
  }

  const normalized = preferredName?.trim();
  const displayName = normalized
    && normalized.toLowerCase() !== "challenger"
    && !normalized.toLowerCase().startsWith("guest-")
    ? normalized
    : undefined;

  const createdResponse = await fetch("/api/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(displayName ? { displayName } : {}),
  });
  return acceptSessionPayload(await json(createdResponse));
}

export function storedPlayerName(): string {
  return localStorage.getItem(PLAYER_NAME_KEY) || "";
}

export async function renamePlayerDisplayName(displayName: string): Promise<PlayerSessionPayload> {
  const response = await fetch("/api/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  return acceptSessionPayload(await json(response));
}

export async function rotatePlayerRecoveryCode(): Promise<PlayerSessionPayload> {
  const response = await fetch("/api/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rotateRecoveryCode: true }),
  });
  return acceptSessionPayload(await json(response));
}

export async function recoverPlayerSession(recoveryCode: string): Promise<PlayerSessionPayload> {
  takeLegacyRecoveryCode();
  const response = await fetch("/api/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recoveryCode: recoveryCode.trim() }),
  });
  return acceptSessionPayload(await json(response));
}
