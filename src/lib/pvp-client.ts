import type { GameAction } from "@/game/reducer";
import type { GameState } from "@/game/types";

export interface PvpDeliveryRequest {
  code: string;
  playerName: string;
  version: number;
  actionId: string;
  gameAction: GameAction;
  onRetry?: () => void;
}

export interface PvpDeliveryResult {
  ok: boolean;
  status: number;
  error?: string;
  duplicate?: boolean;
  version?: number;
  gameState?: GameState;
}

export interface PvpPollFailure {
  terminal: boolean;
  message: string;
}

export interface PvpClientStatusDetail {
  state: "sending" | "retrying" | "confirmed" | "error";
  message: string;
  status: number | null;
  actionType: GameAction["type"];
}

export const PVP_CLIENT_STATUS_EVENT = "runeforge:pvp-client-status";

function publishPvpClientStatus(detail: PvpClientStatusDetail): void {
  if (
    typeof window === "undefined"
    || typeof window.dispatchEvent !== "function"
    || typeof CustomEvent !== "function"
  ) return;
  window.dispatchEvent(new CustomEvent<PvpClientStatusDetail>(PVP_CLIENT_STATUS_EVENT, { detail }));
}

export function classifyPvpPollFailure(status: number, serverError?: string): PvpPollFailure {
  if (status === 401) return { terminal: true, message: "Sua sessão de jogador expirou. Reautentique antes de retomar esta sala." };
  if (status === 403) return { terminal: true, message: "Esta sessão não tem mais acesso a esta sala PvP." };
  if (status === 404) return { terminal: true, message: "A sala PvP foi encerrada ou expirou." };
  return { terminal: false, message: serverError?.trim() || "Conexão instável; tentando novamente." };
}

export async function deliverPvpAction(request: PvpDeliveryRequest): Promise<PvpDeliveryResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6500);
    publishPvpClientStatus({
      state: attempt === 0 ? "sending" : "retrying",
      message: attempt === 0 ? "Confirmando ação com o servidor…" : "Falha transitória; reenviando a mesma ação…",
      status: null,
      actionType: request.gameAction.type,
    });
    try {
      const response = await fetch(`/api/pvp/${encodeURIComponent(request.code)}`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          action: "gameAction",
          actionId: request.actionId,
          playerName: request.playerName,
          version: request.version,
          gameAction: request.gameAction,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.ok) {
        publishPvpClientStatus({
          state: "confirmed",
          message: data.duplicate ? "Ação já confirmada; estado sincronizado." : "Ação confirmada pelo servidor.",
          status: response.status,
          actionType: request.gameAction.type,
        });
        return {
          ok: true,
          status: response.status,
          duplicate: Boolean(data.duplicate),
          version: data.room?.version,
          gameState: data.gameState ?? data.room?.gameState,
        };
      }
      const error = response.status === 409
        ? data.error || "Estado da partida desatualizado."
        : data.error || "Ação recusada pelo servidor.";
      if (response.status === 409 || response.status < 500 || attempt === 1) {
        publishPvpClientStatus({ state: "error", message: error, status: response.status, actionType: request.gameAction.type });
        return { ok: false, status: response.status, error };
      }
    } catch {
      if (attempt === 1) {
        const error = "Não foi possível confirmar a ação.";
        publishPvpClientStatus({ state: "error", message: error, status: 0, actionType: request.gameAction.type });
        return { ok: false, status: 0, error };
      }
    } finally {
      window.clearTimeout(timeout);
    }
    request.onRetry?.();
  }
  const error = "Não foi possível confirmar a ação.";
  publishPvpClientStatus({ state: "error", message: error, status: 0, actionType: request.gameAction.type });
  return { ok: false, status: 0, error };
}
