"use client";

import CardTip from "@/components/CardTip";
import { EmptyHint } from "@/components/GameUI";
import { getCard } from "@/game/cards";
import { canCastReaction, canPlayCard, effectiveCost } from "@/game/engine";
import { topOfReactionStack, type PendingSpell, type ReactionPending } from "@/game/client/match-model";
import type { GameState } from "@/game/types";

export function PlayerHand({ state, reaction, pendingSpell, pendingReaction, isPlayerMain, expanded, onToggle, onCardClick }: {
  state: GameState;
  reaction: ReactionPending | null;
  pendingSpell: PendingSpell | null;
  pendingReaction: PendingSpell | null;
  isPlayerMain: boolean;
  expanded: boolean;
  onToggle: () => void;
  onCardClick: (instanceId: string, defId: string) => void;
}) {
  const hand = state.players.player.hand;
  return (
    <section className={`player-hand-shell ${expanded ? "expanded" : ""}`} aria-label="Sua mão">
      <button className="mobile-hand-toggle" onClick={onToggle} aria-expanded={expanded} aria-controls="player-hand-cards">
        <span>🎴 Sua mão</span><b>{hand.length}</b><i>{expanded ? "Recolher" : "Expandir"}</i>
      </button>
      <div id="player-hand-cards" className="tcg-hand relative flex items-end justify-center gap-1.5 overflow-x-auto px-4 pb-4 pt-5">
        {hand.length === 0 && <EmptyHint text="Sua mão está vazia" />}
        {hand.map((cardInstance) => {
          let clickable = false;
          let glow = false;
          let dim = false;
          if (reaction) {
            const top = topOfReactionStack(reaction);
            const alreadyStacked = reaction.pendingHuman?.instanceId === cardInstance.instanceId;
            const canReact = !!top && !alreadyStacked && canCastReaction(reaction.baseState, "player", cardInstance.instanceId, top.kind);
            clickable = canReact;
            glow = canReact;
            dim = !canReact;
          } else if (isPlayerMain) {
            const playable = canPlayCard(state, "player", cardInstance.instanceId);
            clickable = playable && !pendingSpell;
            glow = playable;
            dim = !playable && !pendingSpell;
          } else {
            dim = true;
          }
          const definition = getCard(cardInstance.defId);
          const cost = effectiveCost(state, "player", definition);
          return (
            <CardTip
              key={cardInstance.instanceId}
              defId={cardInstance.defId}
              state={state}
              size="md"
              dimmed={dim}
              costOverride={cost !== definition.cost ? cost : undefined}
              className={glow ? "glow-playable" : ""}
              selected={pendingSpell?.instanceId === cardInstance.instanceId || pendingReaction?.instanceId === cardInstance.instanceId}
              onClick={clickable ? () => onCardClick(cardInstance.instanceId, cardInstance.defId) : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}
