import type { FxEvent } from "@/hooks/useGameFx";
import type { CombatPace } from "./GameSettings";

const LABELS: Partial<Record<FxEvent["type"], { kicker: string; icon: string }>> = {
  summon: { kicker: "ENTRADA EM CAMPO", icon: "✦" },
  death: { kicker: "UNIDADE DESTRUÍDA", icon: "☽" },
  levelup: { kicker: "ASCENSÃO", icon: "◆" },
  impact: { kicker: "ATAQUE DECLARADO", icon: "⚔" },
};

export function CombatChoreography({ events, pace }: { events: FxEvent[]; pace: CombatPace }) {
  const event = [...events].reverse().find((item) => item.type in LABELS);
  if (!event) return null;
  const presentation = LABELS[event.type];
  if (!presentation) return null;
  return (
    <div key={event.key} className={`combat-choreography combat-choreography-${event.type}`} data-pace={pace} aria-live="polite">
      <i /><span>{presentation.icon}</span><div><small>{presentation.kicker}</small><b>{event.text}</b></div><i />
    </div>
  );
}
