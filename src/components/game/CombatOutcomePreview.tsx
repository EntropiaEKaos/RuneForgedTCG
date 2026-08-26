import { previewCombat } from "@/game/client/match-model";
import type { GameState } from "@/game/types";

export function CombatOutcomePreview({ state, blocks }: { state: GameState; blocks: Record<string, string> }) {
  const result = previewCombat(state, blocks);
  if (!state.combat) return null;
  const defender = state.combat.attackerId === "player" ? "ai" : "player";
  const nexusAfter = Math.max(0, state.players[defender].nexusHealth - result.nexusDamage);
  const lethal = result.nexusDamage >= state.players[defender].nexusHealth;
  const risk = lethal ? "lethal" : result.attackerDeaths > result.blockerDeaths ? "danger" : result.nexusDamage > 0 || result.blockerDeaths > 0 ? "pressure" : "neutral";
  return (
    <aside className="combat-outcome-preview" data-risk={risk} aria-live="polite" aria-label="Estimativa do combate">
      <span><small>DANO NO NEXUS</small><b>{result.nexusDamage}</b></span>
      <span><small>NEXUS APÓS IMPACTO</small><b>{nexusAfter}</b></span>
      <span><small>ATACANTES EM RISCO</small><b>{result.attackerDeaths}</b></span>
      <span><small>BLOQUEADORES EM RISCO</small><b>{result.blockerDeaths}</b></span>
      <p>{lethal ? "☠ DANO LETAL PREVISTO" : result.unblocked > 0 ? `${result.unblocked} atacante(s) sem bloqueio` : "Todas as linhas estão cobertas"}</p>
      <em>Estimativa visual; o motor autoritativo resolve efeitos e gatilhos.</em>
    </aside>
  );
}
