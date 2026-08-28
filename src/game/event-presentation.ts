import { getCard } from "./cards";
import type { GameEvent } from "./events";

export interface PresentedGameEvent { icon: string; color: string; label: string; }

function cardName(defId: string): string {
  try { return getCard(defId).name; } catch { return defId || "Carta"; }
}

export function presentGameEvent(event: GameEvent): PresentedGameEvent {
  const owner = event.player === "player" ? "Jogador" : "Oponente";
  switch (event.type) {
    case "UNIT_SUMMONED": return { icon: "⚔️", color: "text-emerald-300", label: `${owner} invoca ${cardName(event.defId)}.` };
    case "UNIT_DAMAGED": return { icon: "💥", color: "text-red-300", label: `Unidade de ${owner.toLowerCase()} sofre ${event.amount} de dano.` };
    case "UNIT_HEALED": return { icon: "✚", color: "text-emerald-300", label: `Unidade de ${owner.toLowerCase()} recupera ${event.amount} de vida.` };
    case "UNIT_DIED": return { icon: "💀", color: "text-slate-400", label: `${cardName(event.defId)} foi destruída.` };
    case "UNIT_LEVELLED_UP": return { icon: "⭐", color: "text-yellow-300", label: `${cardName(event.toDefId)} evoluiu.` };
    case "UNIT_ATTACK_STARTED": return { icon: "⚔️", color: "text-orange-300", label: `${owner} declarou um atacante.` };
    case "STATUS_APPLIED": return { icon: event.status === "barrier" ? "🛡️" : event.status === "frostbitten" ? "❄️" : "✦", color: "text-cyan-300", label: `${owner}: ${event.status} aplicado.` };
    case "STATUS_REMOVED": return { icon: "◇", color: "text-cyan-200", label: `Barreira de ${owner.toLowerCase()} foi rompida.` };
    case "NEXUS_DAMAGED": return { icon: "💠", color: "text-red-300", label: `Nexus de ${owner.toLowerCase()} sofre ${event.amount} de dano.` };
    case "NEXUS_HEALED": return { icon: "💠", color: "text-emerald-300", label: `Nexus de ${owner.toLowerCase()} recupera ${event.amount}.` };
    case "NEXUS_POISONED": return { icon: "🧪", color: "text-lime-300", label: `${owner} recebe ${event.amount} veneno (${event.total}/10).` };
  }
}
