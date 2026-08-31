"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { GameState } from "@/game/types";
import type { GameAction } from "@/game/reducer";
import { canonicalizeGuestAction, type PvpConnectionState } from "@/game/client/match-model";
import {
  PVP_REACTION_ACTION_EVENT,
  publishPvpReactionState,
  type PvpReactionActionDetail,
} from "@/game/client/pvp-reaction-events";
import type { PvpReactionPriorityState } from "@/lib/pvp-reaction-priority";
import { classifyPvpPollFailure, deliverPvpAction } from "@/lib/pvp-client";

function requestedPvpRoomCode(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("pvpRoom")?.trim().toUpperCase();
  return value || null;
}

export function usePvpTransport({
  playerName,
  screen,
  setState,
  actionLogRef,
}: {
  playerName: string;
  screen: "select" | "game";
  setState: Dispatch<SetStateAction<GameState | null>>;
  actionLogRef: MutableRefObject<GameAction[]>;
}) {
  const [pvpRoomCode, setPvpRoomCode] = useState<string | null>(null);
  const [pvpVersion, setPvpVersion] = useState<number | null>(null);
  const [pvpGuest, setPvpGuest] = useState(false);
  const [pvpReaction, setPvpReaction] = useState<PvpReactionPriorityState | null>(null);
  const [pvpConnection, setPvpConnection] = useState<PvpConnectionState>("offline");
  const [pvpMessage, setPvpMessage] = useState("");
  const [pvpLatency, setPvpLatency] = useState<number | null>(null);
  const pvpSendingRef = useRef(false);
  const requestedRoomCode = requestedPvpRoomCode();
  // A /play?pvpRoom=... route is always PvP, even before React has hydrated
  // the room/version state. Never let that brief transport gap fall through to
  // local engine authority.
  const isPvp = pvpRoomCode !== null || requestedRoomCode !== null;

  const applyProjection = useCallback((projection: {
    code?: string;
    version?: number;
    viewerSide?: "host" | "guest";
    gameState?: GameState | null;
    reactionState?: PvpReactionPriorityState | null;
  }, fallbackRoomCode?: string) => {
    if (projection.code || fallbackRoomCode) setPvpRoomCode(projection.code || fallbackRoomCode || null);
    if (Number.isInteger(projection.version)) setPvpVersion(projection.version!);
    if (projection.viewerSide) setPvpGuest(projection.viewerSide === "guest");
    if (projection.gameState) setState(projection.gameState);
    if ("reactionState" in projection) {
      const nextReaction = projection.reactionState ?? null;
      setPvpReaction(nextReaction);
      if (projection.gameState) publishPvpReactionState({ gameState: projection.gameState, reactionState: nextReaction });
    }
  }, [setState]);

  const sendPvpAction = useCallback(async (action: GameAction) => {
    const effectiveRoomCode = pvpRoomCode ?? requestedPvpRoomCode();
    if (!effectiveRoomCode || pvpSendingRef.current) return false;

    pvpSendingRef.current = true;
    const requestStarted = performance.now();
    let effectiveVersion = pvpVersion;
    let effectiveGuest = pvpGuest;

    // If the UI reached an actionable PvP screen before the hook state was
    // fully hydrated, recover the current authoritative room first instead of
    // silently returning or mutating the local game state.
    if (effectiveVersion == null || pvpRoomCode == null) {
      setPvpConnection("connecting");
      setPvpMessage("Sincronizando a sala antes de confirmar a ação…");
      try {
        const response = await fetch(`/api/pvp/${encodeURIComponent(effectiveRoomCode)}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok || !data.room?.gameState || !Number.isInteger(data.room.version)) {
          const failure = classifyPvpPollFailure(response.status, typeof data.error === "string" ? data.error : undefined);
          setPvpConnection("offline");
          setPvpMessage(failure.message);
          pvpSendingRef.current = false;
          return false;
        }
        effectiveVersion = data.room.version;
        effectiveGuest = data.room.viewerSide === "guest";
        applyProjection({
          code: data.room.code || effectiveRoomCode,
          version: data.room.version,
          viewerSide: data.room.viewerSide,
          gameState: data.room.gameState,
          reactionState: data.room.reactionState ?? null,
        }, effectiveRoomCode);
      } catch (error) {
        setPvpConnection("offline");
        setPvpMessage(error instanceof Error ? error.message : "Não foi possível sincronizar a sala PvP.");
        pvpSendingRef.current = false;
        return false;
      }
    }

    if (effectiveVersion == null) {
      setPvpConnection("offline");
      setPvpMessage("A versão autoritativa da sala ainda não está disponível.");
      pvpSendingRef.current = false;
      return false;
    }

    setPvpConnection("sending");
    setPvpMessage("Confirmando ação autoritativa…");
    const canonical = canonicalizeGuestAction(action, effectiveGuest);
    const result = await deliverPvpAction({
      code: effectiveRoomCode,
      playerName,
      version: effectiveVersion,
      actionId: crypto.randomUUID(),
      gameAction: canonical,
      onRetry: () => {
        setPvpConnection("retrying");
        setPvpMessage("Falha transitória; reenviando a mesma ação…");
      },
    });
    pvpSendingRef.current = false;
    setPvpLatency(Math.round(performance.now() - requestStarted));

    if (result.version != null || result.gameState || result.reactionState !== undefined) {
      applyProjection({
        version: result.version,
        gameState: result.gameState,
        reactionState: result.reactionState,
      }, effectiveRoomCode);
    }

    if (!result.ok) {
      setPvpConnection(result.status === 409 ? "conflict" : "offline");
      setPvpMessage(result.error || "Ação não confirmada.");
      return false;
    }
    actionLogRef.current.push(canonical);
    setPvpConnection("synced");
    setPvpMessage(result.duplicate ? "Ação já confirmada; estado sincronizado." : "Ação confirmada.");
    return true;
  }, [actionLogRef, applyProjection, playerName, pvpGuest, pvpRoomCode, pvpVersion]);

  useEffect(() => {
    const onReactionAction = (event: Event) => {
      if (!isPvp) return;
      const detail = (event as CustomEvent<PvpReactionActionDetail>).detail;
      if (!detail?.action) return;
      void sendPvpAction(detail.action);
    };
    window.addEventListener(PVP_REACTION_ACTION_EVENT, onReactionAction as EventListener);
    return () => window.removeEventListener(PVP_REACTION_ACTION_EVENT, onReactionAction as EventListener);
  }, [isPvp, sendPvpAction]);

  useEffect(() => {
    const effectiveRoomCode = pvpRoomCode ?? requestedPvpRoomCode();
    if (!effectiveRoomCode || screen !== "game") return;
    let cancelled = false;
    let timer = 0;
    const poll = async () => {
      if (cancelled) return;
      if (!navigator.onLine) {
        setPvpConnection("offline");
        setPvpMessage("Sem conexão; aguardando a rede voltar.");
        timer = window.setTimeout(poll, 2500);
        return;
      }
      try {
        const pollStarted = performance.now();
        const res = await fetch(`/api/pvp/${encodeURIComponent(effectiveRoomCode)}`, { credentials: "include", cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          const failure = classifyPvpPollFailure(res.status, typeof data.error === "string" ? data.error : undefined);
          setPvpConnection("offline");
          setPvpMessage(failure.message);
          if (failure.terminal) return;
          throw new Error(failure.message);
        }
        if (data.room?.gameState) {
          applyProjection({
            code: data.room.code || effectiveRoomCode,
            version: data.room.version,
            viewerSide: data.room.viewerSide,
            gameState: data.room.gameState,
            reactionState: data.room.reactionState ?? null,
          }, effectiveRoomCode);
          setPvpLatency(Math.round(performance.now() - pollStarted));
          if (!pvpSendingRef.current) {
            setPvpConnection("synced");
            setPvpMessage(data.room.reactionState ? "Prioridade de reação sincronizada." : "Estado sincronizado.");
          }
        }
      } catch (error) {
        setPvpConnection("offline");
        setPvpMessage(error instanceof Error ? error.message : "Conexão instável; tentando novamente.");
      }
      if (!cancelled) timer = window.setTimeout(poll, document.hidden ? 3500 : 1200);
    };
    const online = () => {
      setPvpConnection("connecting");
      setPvpMessage("Rede restaurada; sincronizando…");
    };
    const offline = () => {
      setPvpConnection("offline");
      setPvpMessage("Sem conexão; aguardando a rede voltar.");
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    void poll();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [applyProjection, pvpRoomCode, screen]);

  return {
    isPvp,
    pvpRoomCode,
    pvpVersion,
    pvpGuest,
    pvpReaction,
    pvpConnection,
    pvpMessage,
    pvpLatency,
    setPvpRoomCode,
    setPvpVersion,
    setPvpGuest,
    setPvpReaction,
    setPvpConnection,
    setPvpMessage,
    sendPvpAction,
  };
}

export type PvpTransportState = ReturnType<typeof usePvpTransport>;
