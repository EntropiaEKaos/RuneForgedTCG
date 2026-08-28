"use client";

import { useRef, useState } from "react";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import type { MatchPhase } from "@/components/MatchExperience";
import type { PlayerId } from "@/game/types";

interface Cue { key: number; kicker: string; title: string; icon: string }

export function MatchCinematics({ round, activePlayer, phase }: { round: number; activePlayer: PlayerId; phase: MatchPhase }) {
  const previous = useRef({ round, activePlayer });
  const [cue, setCue] = useState<Cue | null>(null);

  useDeferredEffect(() => {
    const before = previous.current;
    previous.current = { round, activePlayer };
    if (phase === "gameover" || (before.round === round && before.activePlayer === activePlayer)) return;
    const next = before.round !== round
      ? { key: Date.now(), kicker: "NOVO CICLO", title: `RODADA ${round}`, icon: "◆" }
      : { key: Date.now(), kicker: "PRIORIDADE", title: activePlayer === "player" ? "SEU TURNO" : "TURNO RIVAL", icon: activePlayer === "player" ? "✦" : "◌" };
    setCue(next);
    import("@/lib/sounds").then(({ sfx }) => sfx.priority()).catch(() => {});
    const timer = window.setTimeout(() => setCue((current) => current?.key === next.key ? null : current), 1150);
    return () => window.clearTimeout(timer);
  }, [round, activePlayer, phase]);

  if (!cue) return null;
  return <div className="match-cinematic" aria-live="polite"><span>{cue.icon}</span><div><small>{cue.kicker}</small><b>{cue.title}</b></div></div>;
}
