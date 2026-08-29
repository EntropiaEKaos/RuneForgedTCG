"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { GameState } from "@/game/types";
import type { GameAction } from "@/game/reducer";
import { canonicalizeGuestAction, type PvpConnectionState } from "@/game/client/match-model";
import { classifyPvpPollFailure, deliverPvpAction } from "@/lib/pvp-client";

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
  const [pvpConnection, setPvpConnection] = useState<PvpConnectionState>("offline");
  const [pvpMessage, setPvpMessage] = useState("");
  const [pvpLatency, setPvpLatency] = useState<number | null>(null);
  const pvpSendingRef = useRef(false);
  const isPvp = pvpRoomCode !== null;

  const sendPvpAction = useCallback(async (action: GameAction) => {
    if (!pvpRoomCode || pvpVersion == null || pvpSendingRef.current) return false;
    pvpSendingRef.current = true;
    const requestStarted = performance.now();
    setPvpConnection("sending");
    setPvpMessage("Confirmando ação autoritativa…");
    const canonical = canonicalizeGuestAction(action, pvpGuest);
    const result = await deliverPvpAction({
      code: pvpRoomCode,
      playerName,
      version: pvpVersion,
      actionId: crypto.randomUUID(),
      gameAction: canonical,
      onRetry: () => {
        setPvpConnection("retrying");
        setPvpMessage("Falha transitória; reenviando a mesma ação…");
      },
    });
    pvpSendingRef.current = false;
    setPvpLatency(Math.round(performance.now() - requestStarted));
    if (!result.ok) {
      setPvpConnection(result.status === 409 ? "conflict" : "offline");
      setPvpMessage(result.error || "Ação não confirmada.");
      return false;
    }
    if (result.version != null) setPvpVersion(result.version);
    if (result.gameState) setState(result.gameState);
    actionLogRef.current.push(canonical);
    setPvpConnection("synced");
    setPvpMessage(result.duplicate ? "Ação já confirmada; estado sincronizado." : "Ação confirmada.");
    return true;
  }, [actionLogRef, playerName, pvpGuest, pvpRoomCode, pvpVersion, setState]);

  useEffect(() => {
    if (!pvpRoomCode || screen !== "game") return;
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
        const res = await fetch(`/api/pvp/${encodeURIComponent(pvpRoomCode)}`, { credentials: "include", cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          const failure = classifyPvpPollFailure(res.status, typeof data.error === "string" ? data.error : undefined);
          setPvpConnection("offline");
          setPvpMessage(failure.message);
          if (failure.terminal) return;
          throw new Error(failure.message);
        }
        if (data.room?.gameState) {
          setPvpVersion(data.room.version);
          setPvpLatency(Math.round(performance.now() - pollStarted));
          setState((current) => data.room.gameState ?? current);
          if (!pvpSendingRef.current) {
            setPvpConnection("synced");
            setPvpMessage("Estado sincronizado.");
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
  }, [pvpRoomCode, screen, setState]);

  return {
    isPvp,
    pvpRoomCode,
    pvpVersion,
    pvpGuest,
    pvpConnection,
    pvpMessage,
    pvpLatency,
    setPvpRoomCode,
    setPvpVersion,
    setPvpGuest,
    setPvpConnection,
    setPvpMessage,
    sendPvpAction,
  };
}

export type PvpTransportState = ReturnType<typeof usePvpTransport>;
