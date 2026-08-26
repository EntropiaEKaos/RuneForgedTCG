"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameState } from "@/game/types";

const JOURNEY = [
  { id: "summon", title: "Primeiro vínculo", test: (state: GameState) => state.players.player.stats.alliesSummoned > 0 },
  { id: "spell", title: "Conhecer a magia", test: (state: GameState) => state.players.player.stats.spellsCast > 0 },
  { id: "nexus", title: "Tocar o Nexus", test: (state: GameState) => state.players.player.stats.nexusDamageDealt > 0 },
  { id: "round-five", title: "Resistir ao quinto ciclo", test: (state: GameState) => state.round >= 5 },
  { id: "victory", title: "Vencer no Nexus", test: (state: GameState) => state.phase === "gameover" && state.winner === "player" },
] as const;

function readJourneyRecord(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("runeforge_journey_progress");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((id): id is string => JOURNEY.some((milestone) => milestone.id === id));
    const legacyCount = Number(raw);
    return Number.isFinite(legacyCount) ? JOURNEY.slice(0, Math.max(0, legacyCount)).map((milestone) => milestone.id) : [];
  } catch {
    return [];
  }
}

export function PlayerJourney({ state }: { state: GameState }) {
  const achievedNow = useMemo(() => JOURNEY.filter((milestone) => milestone.test(state)).map((milestone) => milestone.id), [state]);
  const [record] = useState<string[]>(readJourneyRecord);
  const [open, setOpen] = useState(false);
  const achievedList = useMemo(() => [...new Set([...record, ...achievedNow])], [record, achievedNow]);
  const achievedSnapshot = JSON.stringify(achievedList);
  useEffect(() => {
    try { localStorage.setItem("runeforge_journey_progress", achievedSnapshot); } catch {}
  }, [achievedSnapshot]);
  const achieved = new Set(achievedList);
  return (
    <aside className="player-journey" data-open={open} aria-label="Jornada do jogador">
      <button onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span>✦</span><div><small>JORNADA DO NEXUS</small><b>{achieved.size}/{JOURNEY.length} marcos</b></div><i>{open ? "−" : "+"}</i>
      </button>
      {open && <ol>{JOURNEY.map((milestone, index) => <li key={milestone.id} className={achieved.has(milestone.id) ? "done" : ""}><span>{achieved.has(milestone.id) ? "✓" : index + 1}</span>{milestone.title}</li>)}</ol>}
    </aside>
  );
}
