"use client";

const LEGACY_RECOVERY_KEY = "runeforge_recovery_code";
const PLAYER_NAME_KEY = "runeforge_playername";

export interface PlayerSessionPayload {
  ok: boolean;
  player?: { id: number; name: string; [key: string]: unknown };
  recoveryCode?: string;
  recoveryConfigured?: boolean;
  recoveryRotated?: boolean;
  created?: boolean;
  recovered?: boolean;
  error?: string;
  [key: string]: unknown;
}

async function json(response: Response): Promise<PlayerSessionPayload> {
  return response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
}

function rememberPlayerName(payload: PlayerSessionPayload) {
  if (payload.ok && payload.player?.name) {
    localStorage.setItem(PLAYER_NAME_KEY, payload.player.name);
  }
}

export async function ensurePlayerSession(preferredName?: string): Promise<PlayerSessionPayload> {
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

  const createdResponse = await fetch("/api/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(displayName ? { displayName } : {}),
  });
  const created = await json(createdResponse);
  rememberPlayerName(created);
  return created;
}

export function storedPlayerName(): string {
  return localStorage.getItem(PLAYER_NAME_KEY) || "";
}

/**
 * Recovery Key 2.0 never persists new recovery credentials in browser storage.
 *
 * This check only exists so installations created before Recovery Key 2.0 can
 * explicitly migrate the legacy localStorage credential from the Profile UI.
 */
export function legacyRecoveryCodeAvailable(): boolean {
  return Boolean(localStorage.getItem(LEGACY_RECOVERY_KEY));
}

export function discardLegacyRecoveryCode(): void {
  localStorage.removeItem(LEGACY_RECOVERY_KEY);
}

export async function recoverPlayerSession(recoveryCode: string): Promise<PlayerSessionPayload> {
  const normalized = recoveryCode.trim();
  if (!normalized) return { ok: false, error: "Informe uma chave de recuperação." };

  const response = await fetch("/api/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recoveryCode: normalized }),
  });
  const payload = await json(response);

  if (payload.ok) {
    rememberPlayerName(payload);
    // Any browser-persisted v1 credential is stale after successful recovery,
    // because server recovery always rotates the credential.
    discardLegacyRecoveryCode();
  }

  return payload;
}

export async function migrateLegacyRecoveryCode(): Promise<PlayerSessionPayload> {
  const recoveryCode = localStorage.getItem(LEGACY_RECOVERY_KEY);
  if (!recoveryCode) return { ok: false, error: "Nenhuma chave antiga foi encontrada neste navegador." };
  return recoverPlayerSession(recoveryCode);
}

export async function renamePlayerDisplayName(displayName: string): Promise<PlayerSessionPayload> {
  const response = await fetch("/api/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  const payload = await json(response);
  rememberPlayerName(payload);
  return payload;
}

export async function rotatePlayerRecoveryCode(): Promise<PlayerSessionPayload> {
  const response = await fetch("/api/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rotateRecoveryCode: true }),
  });
  const payload = await json(response);
  rememberPlayerName(payload);
  // Deliberately do not persist payload.recoveryCode. The caller must display
  // it explicitly and the player must save it outside the browser.
  return payload;
}
