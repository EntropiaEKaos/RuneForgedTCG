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
  return <div className={`pvp-status pvp-status-${state}`} role="status" title={message || LABEL[state]}><i /><span>{message || LABEL[state]}{version != null && <small>v{version}</small>}{latency != null && <small>{latency} ms</small>}{quality && <small data-quality={quality.toLowerCase()}>{quality}</small>}</span></div>;
}
