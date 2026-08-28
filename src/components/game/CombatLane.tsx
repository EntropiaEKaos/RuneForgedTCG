import CardTip from "@/components/CardTip";
import { previewCombatLane } from "@/game/client/match-model";
import type { GameState, UnitInstance } from "@/game/types";

const OUTCOME = {
  unblocked: "LIVRE",
  trade: "TROCA",
  favorable: "VANTAGEM",
  danger: "RISCO",
  clash: "CHOQUE",
} as const;

export function CombatLane({ attacker, blocker, state, locked = false, attackerClassName, onAttackerClick }: {
  attacker: UnitInstance;
  blocker?: UnitInstance;
  state: GameState;
  locked?: boolean;
  attackerClassName?: string;
  onAttackerClick?: () => void;
}) {
  const preview = previewCombatLane(attacker, blocker);
  return (
    <article className="combat-lane" data-outcome={preview.outcome} aria-label={`${attacker.defId}: ${OUTCOME[preview.outcome]}`}>
      <header><span>{locked ? "DESAFIADO" : "ATACANTE"}</span><b>{OUTCOME[preview.outcome]}</b></header>
      <CardTip defId={attacker.defId} unit={attacker} state={state} size="sm" className={attackerClassName} attacking onClick={onAttackerClick} />
      <div className="combat-lane-vector" aria-hidden="true"><i /><span>⚔</span><i /></div>
      {blocker ? <CardTip defId={blocker.defId} unit={blocker} state={state} size="sm" /> : <div className="combat-nexus-target"><span>◆</span><b>{preview.nexusDamage}</b><small>NEXUS</small></div>}
      <footer>
        {blocker ? <><span>{preview.attackerFalls ? "Atacante cai" : `Recebe ${preview.attackerDamage}`}</span><span>{preview.blockerFalls ? "Bloqueador cai" : `Causa ${preview.blockerDamage}`}</span></> : <span>Dano direto previsto</span>}
        {preview.nexusDamage > 0 && blocker && <strong>+{preview.nexusDamage} excedente</strong>}
      </footer>
    </article>
  );
}
