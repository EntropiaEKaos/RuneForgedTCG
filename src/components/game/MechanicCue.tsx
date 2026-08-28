import type { FxEvent } from "@/hooks/useGameFx";

const CUES: Partial<Record<FxEvent["type"], { title: string; icon: string }>> = {
  poison: { title: "VENENO APLICADO", icon: "🧪" },
  barrier: { title: "BARREIRA ERGUIDA", icon: "🛡" },
  barrierbreak: { title: "BARREIRA ROMPIDA", icon: "◇" },
  frost: { title: "CONGELAMENTO", icon: "❄" },
  stun: { title: "ATORDOAMENTO", icon: "✦" },
  levelup: { title: "EVOLUÇÃO", icon: "★" },
};

export function MechanicCue({ events }: { events: FxEvent[] }) {
  const event = [...events].reverse().find((entry) => CUES[entry.type]);
  if (!event) return null;
  const cue = CUES[event.type]!;
  return <div key={event.key} className={`mechanic-cue mechanic-cue-${event.type}`} aria-live="assertive"><span>{cue.icon}</span><b>{cue.title}</b></div>;
}
