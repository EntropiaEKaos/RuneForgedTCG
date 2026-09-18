"use client";

const PLAYER_NAME_KEY = "runeforge_playername";
const LEGACY_RECOVERY_KEY = ["runeforge", "recovery", "code"].join("_");

export const PLAYER_RECOVERY_KEY_EVENT = "runeforge:recovery-key-issued";
const PENDING_RECOVERY_WINDOW_KEY = "__forged_pending_recovery_code__";
let pendingRecoveryCode: string | null = null;

function browserPendingRecoveryCode(): string | null {
  if (typeof window === "undefined") return null;
  const value = Reflect.get(window, PENDING_RECOVERY_WINDOW_KEY);
  return typeof value === "string" && value.trim() ? value : null;
}

function setBrowserPendingRecoveryCode(code: string | null) {
  if (typeof window === "undefined") return;
  if (code) Reflect.set(window, PENDING_RECOVERY_WINDOW_KEY, code);
  else Reflect.deleteProperty(window, PENDING_RECOVERY_WINDOW_KEY);
}

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
  // Keep the one-time secret in ephemeral browser memory as well as this module.
  // Production chunks can hydrate independently; the window bridge lets the
  // globally-mounted RecoveryKeyNotice reconcile a code issued before its
  // listener is ready without persisting the secret in Web Storage.
  pendingRecoveryCode = normalized;
  setBrowserPendingRecoveryCode(normalized);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PLAYER_RECOVERY_KEY_EVENT, { detail: { code: normalized } }));
  }
}

function rememberPlayerName(payload: PlayerSessionPayload) {
  if (payload.player?.name) localStorage.setItem(PLAYER_NAME_KEY, payload.player.name);
}

export function consumePendingRecoveryCode(): string | null {
  const value = pendingRecoveryCode ?? browserPendingRecoveryCode();
  pendingRecoveryCode = null;
  setBrowserPendingRecoveryCode(null);
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

/**
 * Resolve an existing browser player session without ever creating a player.
 *
 * Identity/Auth 1.0 deliberately keeps this helper non-creating so legacy
 * page effects, prefetches and read-only surfaces cannot silently mint Guest
 * accounts. Guest creation is an explicit user action through
 * createGuestPlayerSession().
 */
export async function ensurePlayerSession(preferredName?: string): Promise<PlayerSessionPayload> {
  clearLegacyRecoverySecret();
  const current = await fetch("/api/player", { cache: "no-store" });
  if (!current.ok) return json(current);

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

/**
 * Explicit Guest fallback for user-driven account creation only.
 * Call this from a deliberate UI action such as "CONTINUAR COMO CONVIDADO".
 */
export async function createGuestPlayerSession(): Promise<PlayerSessionPayload> {
  clearLegacyRecoverySecret();

  // Avoid minting a second player if a session arrived between the entry gate
  // and the explicit Guest click (for example another completed auth tab).
  const current = await fetch("/api/player", { cache: "no-store" });
  if (current.ok) {
    const payload = await json(current);
    rememberPlayerName(payload);
    return payload;
  }

  const created = await createPlayer();
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
