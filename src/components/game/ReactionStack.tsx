"use client";

import { getCard } from "@/game/cards";
import type { CardAction } from "@/game/engine";
import type { ReactionPending } from "@/game/client/match-model";

function actionLabel(item: CardAction): string {
  const card = getCard(item.defId);
  const who = item.player === "ai" ? "O adversário" : "Você";
  const verb = item.kind === "spell" ? "conjura" : card.type === "Equipment" ? "equipa" : "joga";
  return `${who} ${verb} ${card.name}`;
}

export function ReactionStack({ reaction, timeLeft, targetName, onResolve }: {
  reaction: ReactionPending;
  timeLeft: number;
  targetName: string | null;
  onResolve: () => void;
}) {
  const frames = [reaction.action, ...(reaction.pendingHuman ? [reaction.pendingHuman] : [])];
  const progress = Math.max(0, Math.min(100, (timeLeft / 10_000) * 100));
  return (
    <section className="reaction-stack" aria-label="Pilha de respostas" aria-live="assertive">
      <div className="reaction-stack-heading">
        <div><span>PRIORIDADE ABERTA</span><h3>Pilha de respostas</h3></div>
        <strong>{Math.ceil(timeLeft / 1000)}s</strong>
      </div>
      <div className="reaction-timer"><i style={{ width: `${progress}%` }} /></div>
      {targetName && <p className="reaction-target">Alvo atual: <b>{targetName}</b></p>}
      <div className="reaction-frames">
        {frames.map((item, index) => {
          const card = getCard(item.defId);
          const top = index === frames.length - 1;
          return (
            <div key={`${item.instanceId}_${index}`} className={top ? "top" : ""} title={actionLabel(item)}>
              <span className="reaction-owner">{item.player === "ai" ? "RIVAL" : "VOCÊ"}</span>
              <span className="reaction-cost">{card.cost}</span>
              <b>{card.emoji}</b>
              <small>{card.name}</small>
              {top && <em>RESOLVE PRIMEIRO</em>}
            </div>
          );
        })}
      </div>
      <button onClick={onResolve} className="btn-primary" aria-keyshortcuts="Space">Passar prioridade e resolver</button>
    </section>
  );
}
