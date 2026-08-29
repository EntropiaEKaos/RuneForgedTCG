"use client";

import { useState, useSyncExternalStore } from "react";
import type { PvpConnectionState } from "@/game/client/match-model";

const LABEL: Record<PvpConnectionState, string> = {
  offline: "Sem conexão",
  connecting: "Conectando",
  synced: "Sincronizado",
  sending: "Confirmando ação",
  retrying: "Reconectando",
  conflict: "Ressincronizando",
};

const subscribeLocation = () => () => {};
const readRoomCode = () => new URLSearchParams(window.location.search).get("pvpRoom");
const readServerRoomCode = () => null;

export function PvpStatus({ state, message, version, latency }: { state: PvpConnectionState; message?: string; version?: number | null; latency?: number | null }) {
  const quality = latency == null ? null : latency < 120 ? "ÓTIMA" : latency < 260 ? "ESTÁVEL" : "ALTA";
  const roomCode = useSyncExternalStore(subscribeLocation, readRoomCode, readServerRoomCode);
  const [submitting, setSubmitting] = useState(false);
  const [concedeMessage, setConcedeMessage] = useState("");

  const concede = async () => {
    if (!roomCode || submitting) return;
    setSubmitting(true);
    setConcedeMessage("");
    try {
      const response = await fetch(`/api/pvp/${encodeURIComponent(roomCode)}`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "Não foi possível registrar a rendição.");
      setConcedeMessage(data.forfeited ? "Rendição confirmada; sincronizando resultado…" : "Partida encerrada; sincronizando resultado…");
    } catch (error) {
      setConcedeMessage(error instanceof Error ? error.message : "Não foi possível registrar a rendição.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`pvp-status pvp-status-${state}`} role="status" title={concedeMessage || message || LABEL[state]}>
        <i />
        <span>
          {concedeMessage || message || LABEL[state]}
          {version != null && <small>v{version}</small>}
          {latency != null && <small>{latency} ms</small>}
          {quality && <small data-quality={quality.toLowerCase()}>{quality}</small>}
        </span>
      </div>
      {roomCode && !concedeMessage && (
        <details className="relative">
          <summary
            role="button"
            aria-label="Render-se"
            aria-disabled={submitting || state === "sending" || state === "retrying"}
            className={`inline-flex list-none items-center gap-1.5 rounded-lg border border-red-300/20 bg-red-400/[.06] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[.1em] text-red-200 transition hover:bg-red-400/[.12] [&::-webkit-details-marker]:hidden ${submitting || state === "sending" || state === "retrying" ? "pointer-events-none cursor-not-allowed opacity-50" : "cursor-pointer"}`}
            onClick={(event) => {
              event.preventDefault();
              if (submitting || state === "sending" || state === "retrying") return;
              event.currentTarget.parentElement?.setAttribute("open", "");
            }}
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3 fill-current" focusable="false">
              <path d="M3 1.5a.75.75 0 0 1 .75.75v.5h7.1c.55 0 .9.58.64 1.06L10.3 6l1.19 2.19c.26.48-.09 1.06-.64 1.06h-7.1v5a.75.75 0 0 1-1.5 0v-12A.75.75 0 0 1 3 1.5Z" />
            </svg>
            Render-se
          </summary>
          <div className="absolute right-0 top-full z-[120] mt-2 w-72 rounded-2xl border border-red-300/20 bg-slate-950/95 p-3 text-left shadow-2xl backdrop-blur">
            <strong className="block text-xs text-white">Encerrar esta partida?</strong>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">A rendição é registrada pelo servidor como derrota e encerra a sala para os dois jogadores.</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="rounded-lg border border-red-300/25 bg-red-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-red-100 disabled:opacity-50"
                onClick={() => void concede()}
                disabled={submitting}
              >
                {submitting ? "Registrando…" : "Confirmar rendição"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-300"
                onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
                disabled={submitting}
              >
                Continuar partida
              </button>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
