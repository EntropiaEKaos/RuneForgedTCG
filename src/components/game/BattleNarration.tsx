"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type BattleNarrationEvent = { id: number; heading: string; message: string };

/** Sequential, non-blocking presentation of engine-confirmed events. */
export function BattleNarration({ events }: { events: BattleNarrationEvent[] }) {
  const [queue, setQueue] = useState<BattleNarrationEvent[]>([]);
  const seen = useRef<Set<number>>(new Set());
  const initialized = useRef(false);
  useEffect(() => {
    // Do not replay historical combat logs when a match view mounts.
    if (!initialized.current) {
      initialized.current = true;
      seen.current = new Set(events.map((event) => event.id));
      return;
    }
    const fresh = events.filter((event) => !seen.current.has(event.id));
    for (const event of events) seen.current.add(event.id);
    if (fresh.length) setQueue((current) => [...current, ...fresh].slice(-8));
  }, [events]);
  const active = queue[0];
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setQueue((current) => current[0]?.id === active.id ? current.slice(1) : current), 2400);
    return () => window.clearTimeout(timer);
  }, [active]);
  if (!active) return null;
  const tone = /ANULADA|DESTRUÍDO|EXILADO/.test(active.heading)
    ? "border-rose-400/70 bg-rose-950/95 shadow-rose-500/20"
    : /CONGELADO|ATORDOADO/.test(active.heading)
      ? "border-sky-300/70 bg-sky-950/95 shadow-sky-500/20"
      : /RESSUSCITADO|RECUPERADO|EVOLUÇÃO/.test(active.heading)
        ? "border-emerald-300/70 bg-emerald-950/95 shadow-emerald-500/20"
        : "border-amber-300/60 bg-slate-950/95 shadow-amber-500/10";
  // Render above the arena rails, outside their stacking and clipping contexts.
  return createPortal(
    <div role="status" aria-live="polite" data-combat-event-feedback="true" data-combat-event-id={active.id} className="pointer-events-none fixed inset-x-2 top-[18%] z-[9999] flex justify-center">
      <div key={active.id} className={`animate-pop max-w-sm rounded-xl border px-4 py-2 text-center shadow-lg ${tone}`}>
        <strong className="block text-sm font-black tracking-wider text-white">{active.heading}</strong>
        <p className="mt-1 text-xs text-white/90">{active.message}</p>
      </div>
    </div>,
    document.body,
  );
}
