import type { FxEvent } from "@/hooks/useGameFx";
import type { CombatPace } from "./GameSettings";

// All cues are derived from authoritative game events, never from predicted actions.
const LABELS: Partial<Record<FxEvent["type"], { kicker: string; icon: string }>> = {
  summon: { kicker: "ENTRADA EM CAMPO", icon: "✦" },
  death: { kicker: "UNIDADE DESTRUÍDA", icon: "☽" },
  levelup: { kicker: "ASCENSÃO", icon: "◆" },
  impact: { kicker: "ATAQUE DECLARADO", icon: "⚔" },
  dmg: { kicker: "IMPACTO CONFIRMADO", icon: "✹" },
  heal: { kicker: "ENERGIA RESTAURADA", icon: "✚" },
  barrier: { kicker: "DEFESA ATIVADA", icon: "⬡" },
  barrierbreak: { kicker: "BARREIRA ROMPIDA", icon: "◇" },
  frost: { kicker: "GELO ARCANO", icon: "❄" },
  stun: { kicker: "CONTROLE APLICADO", icon: "✧" },
  poison: { kicker: "VENENO APLICADO", icon: "☣" },
  nexushit: { kicker: "NEXUS AFETADO", icon: "✷" },
};

export function CombatChoreography({ events, pace }: { events: FxEvent[]; pace: CombatPace }) {
  const event = [...events].reverse().find((item) => item.type in LABELS);
  if (!event) return null;
  const presentation = LABELS[event.type];
  if (!presentation) return null;
  return (
    <div key={event.key} className={`combat-choreography combat-choreography-${event.type}`} data-pace={pace} data-cinematic-cue="true" aria-live="polite">
      <i /><span aria-hidden="true">{presentation.icon}</span><div><small>{presentation.kicker}</small><b>{event.text}</b></div><i />
    </div>
  );
}
