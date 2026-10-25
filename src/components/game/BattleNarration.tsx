"use client";

import { useEffect, useState } from "react";

export type BattleNarrationEvent = { id: number; heading: string; message: string };

/** Brief, non-interactive narration for events confirmed by the engine log. */
export function BattleNarration({ events }: { events: BattleNarrationEvent[] }) {
  const latest = events.at(-1);
  const [visibleId, setVisibleId] = useState<number | null>(null);
  useEffect(() => {
    if (!latest) return;
    setVisibleId(latest.id);
    const timer = window.setTimeout(() => setVisibleId((id) => id === latest.id ? null : id), 3600);
    return () => window.clearTimeout(timer);
  }, [latest?.id]);
  if (!latest || visibleId !== latest.id) return null;
  const tone = /ANULADA|DESTRUÍDO|EXILADO/.test(latest.heading)
    ? "border-rose-400/70 bg-rose-950/95 shadow-rose-500/20"
    : /CONGELADO|ATORDOADO/.test(latest.heading)
      ? "border-sky-300/70 bg-sky-950/95 shadow-sky-500/20"
      : /RESSUSCITADO|RECUPERADO|EVOLUÇÃO/.test(latest.heading)
        ? "border-emerald-300/70 bg-emerald-950/95 shadow-emerald-500/20"
        : "border-amber-300/60 bg-slate-950/95 shadow-amber-500/10";
  return (
    <div role="status" aria-live="polite" data-combat-event-feedback="true" className="pointer-events-none absolute inset-x-2 top-12 z-30 flex justify-center" >
      <div key={latest.id} className={`animate-pop max-w-sm rounded-xl border px-4 py-2 text-center shadow-lg ${tone}`}>
        <strong className="block text-sm font-black tracking-wider text-white">{latest.heading}</strong>
        <p className="mt-1 text-xs text-white/90">{latest.message}</p>
      </div>
    </div>
  );
}
