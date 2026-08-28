import type { Encounter } from "@/lib/game-modes";
import { ModeMissionHud } from "@/components/game/ModeMissionHud";

export function EncounterBanner({ encounter }: { encounter: Encounter | null }) {
  return (
    <>
      <ModeMissionHud />
      {encounter && (
        <aside className="encounter-banner" data-region={encounter.region.toLowerCase()} aria-label={`Expedição: ${encounter.name}`}>
          <span>{encounter.emoji}</span>
          <div><small>EXPEDIÇÃO · {encounter.chapter}</small><b>{encounter.name}</b><p>{encounter.objective}</p></div>
          <strong><small>MODIFICADOR</small>{encounter.mutator.label}<em>{encounter.mutator.description}</em></strong>
        </aside>
      )}
    </>
  );
}
