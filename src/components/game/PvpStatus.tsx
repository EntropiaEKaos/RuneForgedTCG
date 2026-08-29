"use client";

import { useEffect, useState } from "react";
import type { PvpConnectionState } from "@/game/client/match-model";

const LABEL: Record<PvpConnectionState, string> = {
  offline: "Sem conexão",
  connecting: "Conectando",
  synced: "Sincronizado",
  sending: "Confirmando ação",
  retrying: "Reconectando",
  conflict: "Ressincronizando",
};

export function PvpStatus({ state, message, version, latency }: { state: PvpConnectionState; message?: string; version?: number | null; latency?: number | null }) {
  const quality = latency == null ? null : latency < 120 ? "ÓTIMA" : latency < 260 ? "ESTÁVEL" : "ALTA";
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [concedeMessage, setConcedeMessage] = useState("");

  useEffect(() => {
    setRoomCode(new URLSearchParams(window.location.search).get("pvpRoom"));
  }, []);

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
      setConfirming(false);
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
      {roomCode && !confirming && !concedeMessage && (
        <button
          type="button"
          className="rounded-lg border border-red-300/20 bg-red-400/[.06] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[.1em] text-red-200 transition hover:bg-red-400/[.12] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setConfirming(true)}
          disabled={submitting || state === "sending" || state === "retrying"}
        >
          🏳 Render-se
        </button>
      )}
      {roomCode && confirming && (
        <div className="relative">
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
                onClick={() => setConfirming(false)}
                disabled={submitting}
              >
                Continuar partida
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
