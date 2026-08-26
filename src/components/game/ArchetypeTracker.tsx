import { archetypeForDeck, archetypeMomentum } from "@/game/archetypes";
import type { GameState } from "@/game/types";

export function ArchetypeTracker({ state }: { state: GameState }) {
  const profile = archetypeForDeck(state.players.player.deckId);
  if (!profile) return null;
  const momentum = archetypeMomentum(state, profile.deckId);
  return (
    <aside className="archetype-tracker" data-region={profile.region.toLowerCase()} aria-label={`Plano de jogo: ${profile.name}`}>
      <span className="archetype-tracker-icon">{profile.icon}</span>
      <div><small>{profile.name} · {profile.meterLabel}</small><b>{momentum.detail}</b><i><span style={{ width: `${momentum.value}%` }} /></i></div>
      <strong>{momentum.value}</strong>
    </aside>
  );
}
