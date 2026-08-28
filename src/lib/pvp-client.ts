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

export async function deliverPvpAction(request: PvpDeliveryRequest): Promise<PvpDeliveryResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6500);
    try {
      const response = await fetch(`/api/pvp/${encodeURIComponent(request.code)}`, {
        method: "POST",
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
        return {
          ok: true,
          status: response.status,
          duplicate: Boolean(data.duplicate),
          version: data.room?.version,
          gameState: data.gameState ?? data.room?.gameState,
        };
      }
      if (response.status === 409) return { ok: false, status: 409, error: data.error || "Estado da partida desatualizado." };
      if (response.status < 500 || attempt === 1) return { ok: false, status: response.status, error: data.error || "Ação recusada pelo servidor." };
    } catch {
      if (attempt === 1) return { ok: false, status: 0, error: "Não foi possível confirmar a ação." };
    } finally {
      window.clearTimeout(timeout);
    }
    request.onRetry?.();
  }
  return { ok: false, status: 0, error: "Não foi possível confirmar a ação." };
}
