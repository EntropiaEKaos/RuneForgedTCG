"use client";

import type { CSSProperties } from "react";
import CardTip from "@/components/CardTip";
import { EmptyHint } from "@/components/GameUI";
import { getCard } from "@/game/cards";
import { canCastReaction, canPlayCard, effectiveCost } from "@/game/engine";
import { topOfReactionStack, type PendingSpell, type ReactionPending } from "@/game/client/match-model";
import type { GameState } from "@/game/types";

type HandFanStyle = CSSProperties & {
  "--hand-angle": string;
  "--hand-lift": string;
  "--hand-z": number;
};

function handFanStyle(index: number, count: number): HandFanStyle {
  const center = (count - 1) / 2;
  const delta = index - center;
  const angle = Math.max(-14, Math.min(14, delta * 3.1));
  const lift = Math.min(18, Math.abs(delta) * 2.4);
  return {
    "--hand-angle": `${angle.toFixed(2)}deg`,
    "--hand-lift": `${lift.toFixed(2)}px`,
    "--hand-z": index + 1,
  };
}

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
        {hand.map((cardInstance, index) => {
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
            <div key={cardInstance.instanceId} className="tcg-hand-card" style={handFanStyle(index, hand.length)}>
              <CardTip
                defId={cardInstance.defId}
                state={state}
                size="md"
                dimmed={dim}
                costOverride={cost !== definition.cost ? cost : undefined}
                className={glow ? "glow-playable" : ""}
                selected={pendingSpell?.instanceId === cardInstance.instanceId || pendingReaction?.instanceId === cardInstance.instanceId}
                onClick={clickable ? () => onCardClick(cardInstance.instanceId, cardInstance.defId) : undefined}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
