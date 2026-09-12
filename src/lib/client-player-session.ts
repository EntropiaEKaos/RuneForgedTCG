"use client";

const PLAYER_NAME_KEY = "runeforge_playername";
const LEGACY_RECOVERY_KEY = ["runeforge", "recovery", "code"].join("_");

export const PLAYER_RECOVERY_KEY_EVENT = "runeforge:recovery-key-issued";
let pendingRecoveryCode: string | null = null;

export interface PlayerSessionPayload {
  ok: boolean;
  player?: { id: number; name: string; [key: string]: unknown };
  recoveryCode?: string;
  created?: boolean;
  recovered?: boolean;
  recoveryRotated?: boolean;
  error?: string;
  [key: string]: unknown;
}

function clearLegacyRecoverySecret() {
  if (typeof window !== "undefined") localStorage.removeItem(LEGACY_RECOVERY_KEY);
}

async function json(response: Response): Promise<PlayerSessionPayload> {
  return response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
}

function publishRecoveryCode(code: string | undefined) {
  const normalized = code?.trim();
  if (!normalized) return;
  pendingRecoveryCode = normalized;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PLAYER_RECOVERY_KEY_EVENT, { detail: { code: normalized } }));
  }
}

function rememberPlayerName(payload: PlayerSessionPayload) {
  if (payload.player?.name) localStorage.setItem(PLAYER_NAME_KEY, payload.player.name);
}

export function consumePendingRecoveryCode(): string | null {
  const value = pendingRecoveryCode;
  pendingRecoveryCode = null;
  return value;
}

async function createPlayer(displayName?: string): Promise<{ response: Response; payload: PlayerSessionPayload }> {
  const response = await fetch("/api/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(displayName ? { displayName } : {}),
  });
  return { response, payload: await json(response) };
}

export async function ensurePlayerSession(preferredName?: string): Promise<PlayerSessionPayload> {
  clearLegacyRecoverySecret();
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
    rememberPlayerName(payload);
    return payload;
  }

  const normalized = preferredName?.trim();
  const displayName = normalized
    && normalized.toLowerCase() !== "challenger"
    && !normalized.toLowerCase().startsWith("guest-")
    ? normalized
    : undefined;

  let created = await createPlayer(displayName);

  // A browser that lost its HttpOnly session may still remember the old public
  // display name. Never block onboarding on that non-secret local preference:
  // if the name is already owned, create a temporary guest and let the player
  // explicitly recover the original account with their recovery key.
  if (created.response.status === 409 && displayName) {
    created = await createPlayer();
  }

  if (created.payload.ok) {
    rememberPlayerName(created.payload);
    publishRecoveryCode(created.payload.recoveryCode);
  }
  return created.payload;
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
  const payload = await json(response);
  if (payload.ok) rememberPlayerName(payload);
  return payload;
}

export async function recoverPlayerSession(recoveryCode: string): Promise<PlayerSessionPayload> {
  clearLegacyRecoverySecret();
  const normalized = recoveryCode.trim();
  if (normalized.length < 24 || normalized.length > 128) {
    return { ok: false, error: "Chave de recuperação inválida." };
  }

  const response = await fetch("/api/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recoveryCode: normalized }),
  });
  const payload = await json(response);
  if (payload.ok) {
    rememberPlayerName(payload);
    publishRecoveryCode(payload.recoveryCode);
  }
  return payload;
}

export async function rotatePlayerRecoveryCode(): Promise<PlayerSessionPayload> {
  clearLegacyRecoverySecret();
  const response = await fetch("/api/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rotateRecoveryCode: true }),
  });
  const payload = await json(response);
  if (payload.ok) {
    rememberPlayerName(payload);
    publishRecoveryCode(payload.recoveryCode);
  }
  return payload;
}
