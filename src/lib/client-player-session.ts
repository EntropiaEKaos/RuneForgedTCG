"use client";

const RECOVERY_KEY = "runeforge_recovery_code";
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

export async function ensurePlayerSession(preferredName?: string): Promise<PlayerSessionPayload> {
  const current = await fetch("/api/player", { cache: "no-store" });
  if (current.ok) {
    let payload = await json(current);
    const normalized = preferredName?.trim();
    const canRename = normalized && normalized.toLowerCase() !== "challenger" && !normalized.toLowerCase().startsWith("guest-") && normalized !== payload.player?.name;
    if (canRename) {
      const renamedResponse = await fetch("/api/player", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: normalized }) });
      const renamed = await json(renamedResponse);
      if (renamed.ok) payload = renamed;
    }
    if (payload.player?.name) localStorage.setItem(PLAYER_NAME_KEY, payload.player.name);
    return payload;
  }

  const recoveryCode = localStorage.getItem(RECOVERY_KEY);
  if (recoveryCode) {
    const recoveredResponse = await fetch("/api/player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recoveryCode }),
    });
    const recovered = await json(recoveredResponse);
    if (recovered.ok) {
      if (recovered.recoveryCode) localStorage.setItem(RECOVERY_KEY, recovered.recoveryCode);
      if (recovered.player?.name) localStorage.setItem(PLAYER_NAME_KEY, recovered.player.name);
      return recovered;
    }
    if (recoveredResponse.status === 401 || recoveredResponse.status === 400) localStorage.removeItem(RECOVERY_KEY);
  }

  const normalized = preferredName?.trim();
  const displayName = normalized && normalized.toLowerCase() !== "challenger" && !normalized.startsWith("Guest-") ? normalized : undefined;
  const createdResponse = await fetch("/api/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(displayName ? { displayName } : {}),
  });
  const created = await json(createdResponse);
  if (created.ok) {
    if (created.recoveryCode) localStorage.setItem(RECOVERY_KEY, created.recoveryCode);
    if (created.player?.name) localStorage.setItem(PLAYER_NAME_KEY, created.player.name);
  }
  return created;
}

export function storedPlayerName(): string {
  return localStorage.getItem(PLAYER_NAME_KEY) || "";
}

export function storedRecoveryCode(): string | null {
  return localStorage.getItem(RECOVERY_KEY);
}

export async function renamePlayerDisplayName(displayName: string): Promise<PlayerSessionPayload> {
  const response = await fetch("/api/player", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName }) });
  const payload = await json(response);
  if (payload.ok && payload.player?.name) localStorage.setItem(PLAYER_NAME_KEY, payload.player.name);
  return payload;
}

export async function rotatePlayerRecoveryCode(): Promise<PlayerSessionPayload> {
  const response = await fetch("/api/player", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rotateRecoveryCode: true }) });
  const payload = await json(response);
  if (payload.ok && payload.recoveryCode) localStorage.setItem(RECOVERY_KEY, payload.recoveryCode);
  return payload;
}
