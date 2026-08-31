"use client";

import { useMemo, useState } from "react";
import { getCard } from "@/game/cards";
import {
  reactionActivatedAbilityOptions,
  validateReactionActivatedAbilityActivation,
  type CardAction,
  type ReactionActivatedAbilityOption,
} from "@/game/engine";
import type { ReactionPending } from "@/game/client/match-model";
import {
  REACTION_ACTIVATED_SUBMIT_EVENT,
  type ReactionActivatedSubmitDetail,
} from "@/game/client/reaction-ui-contract";
import type { GameState, PlayerId } from "@/game/types";

function actionLabel(item: CardAction): string {
  const card = getCard(item.defId);
  const who = item.player === "ai" ? "O adversário" : "Você";
  if (item.responseKind === "activatedAbility") return `${who} ativa uma resposta de ${card.name}`;
  const verb = item.kind === "spell" ? "conjura" : card.type === "Equipment" ? "equipa" : "joga";
  return `${who} ${verb} ${card.name}`;
}

function sourceName(option: ReactionActivatedAbilityOption): string {
  return getCard(option.defId).name;
}

function targetCandidates(
  state: GameState,
  option: ReactionActivatedAbilityOption,
  pending: CardAction,
): Array<{ id: string; label: string }> {
  if (option.targetKind === "none" || option.targetKind === "self" || option.targetKind === "spellOnStack") return [];
  const candidates: Array<{ id: string; label: string }> = [];
  const visit = (owner: PlayerId, id: string, defId: string) => {
    const validation = validateReactionActivatedAbilityActivation(
      state,
      "player",
      option.sourceInstanceId,
      option.abilityIndex,
      pending,
      id,
      option.modeId,
      undefined,
      true,
    );
    if (validation.ok) candidates.push({ id, label: `${owner === "player" ? "Seu" : "Rival"} · ${getCard(defId).name}` });
  };
  for (const owner of ["player", "ai"] as const) {
    for (const unit of state.players[owner].bench) visit(owner, unit.instanceId, unit.defId);
    for (const permanent of state.players[owner].permanents) visit(owner, permanent.instanceId, permanent.defId);
    for (const sentinela of state.players[owner].sentinelas) visit(owner, sentinela.instanceId, sentinela.defId);
  }
  return candidates;
}

function ReactionActivatedPicker({ reaction }: { reaction: ReactionPending }) {
  const pending = reaction.pendingHuman ?? reaction.action;
  const options = useMemo(
    () => reaction.pendingHuman ? [] : reactionActivatedAbilityOptions(reaction.baseState, "player", pending),
    [pending, reaction.baseState, reaction.pendingHuman],
  );
  const [selectedKey, setSelectedKey] = useState("");
  const [targetId, setTargetId] = useState("");
  const [discardIds, setDiscardIds] = useState<string[]>([]);

  const selected = options.find((option) => `${option.sourceInstanceId}:${option.abilityIndex}:${option.modeId ?? "classic"}` === selectedKey) ?? null;
  const targets = useMemo(
    () => selected ? targetCandidates(reaction.baseState, selected, pending) : [],
    [pending, reaction.baseState, selected],
  );
  const ability = selected ? getCard(selected.defId).reactionActivatedAbilities?.[selected.abilityIndex] : undefined;
  const discardCount = ability?.cost?.discardFromHand ?? 0;

  if (options.length === 0) return null;

  const requiredTarget = selected && !["none", "self", "spellOnStack"].includes(selected.targetKind);
  const resolvedTarget = selected?.targetKind === "spellOnStack" ? pending.instanceId : requiredTarget ? targetId : undefined;
  const ready = Boolean(
    selected &&
    (!requiredTarget || targetId) &&
    discardIds.length === discardCount,
  );

  const submit = () => {
    if (!selected || !ability || !ready) return;
    const costDiscardInstanceIds = discardCount > 0 ? [...discardIds] : undefined;
    const action: CardAction = {
      player: "player",
      kind: "sentinela",
      responseKind: "activatedAbility",
      instanceId: selected.sourceInstanceId,
      defId: selected.defId,
      abilityIndex: selected.abilityIndex,
      ...(selected.modeId ? { modeId: selected.modeId } : {}),
      ...(resolvedTarget ? { targetInstanceId: resolvedTarget } : {}),
      ...(costDiscardInstanceIds ? { costDiscardInstanceIds } : {}),
    };
    const detail: ReactionActivatedSubmitDetail = {
      action,
      logAction: {
        type: "react",
        player: "player",
        responseKind: "activatedAbility",
        instanceId: selected.sourceInstanceId,
        abilityIndex: selected.abilityIndex,
        ...(selected.modeId ? { modeId: selected.modeId } : {}),
        ...(resolvedTarget ? { target: resolvedTarget } : {}),
        ...(costDiscardInstanceIds ? { costDiscardInstanceIds } : {}),
      },
    };
    window.dispatchEvent(new CustomEvent<ReactionActivatedSubmitDetail>(REACTION_ACTIVATED_SUBMIT_EVENT, { detail }));
  };

  return (
    <div data-reaction-activated-picker="true" className="mt-3 rounded-xl border border-violet-300/20 bg-violet-950/25 p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-violet-200">Resposta do campo</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
        <select
          className="input text-xs"
          aria-label="Escolher habilidade ativada de reação"
          value={selectedKey}
          onChange={(event) => {
            setSelectedKey(event.target.value);
            setTargetId("");
            setDiscardIds([]);
          }}
        >
          <option value="">Escolha uma habilidade…</option>
          {options.map((option) => {
            const key = `${option.sourceInstanceId}:${option.abilityIndex}:${option.modeId ?? "classic"}`;
            const choice = option.modeDescription ? `${option.description} — ${option.modeDescription}` : option.description;
            return <option key={key} value={key}>{sourceName(option)} · {choice}</option>;
          })}
        </select>
        <span className="self-center text-[10px] text-slate-400">{options.length} opção(ões) legal(is)</span>
      </div>

      {selected && requiredTarget && (
        <label className="mt-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Alvo
          <select className="input mt-1 text-xs normal-case" value={targetId} onChange={(event) => setTargetId(event.target.value)}>
            <option value="">Escolha um alvo legal…</option>
            {targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
          </select>
        </label>
      )}

      {selected?.targetKind === "spellOnStack" && (
        <p className="mt-2 text-[11px] text-cyan-200">Alvo da pilha: <b>{getCard(pending.defId).name}</b></p>
      )}

      {selected && discardCount > 0 && (
        <div className="mt-3" data-reaction-selected-discard="true">
          <div className="text-[10px] font-black uppercase tracking-widest text-amber-200">Descarte como custo · {discardIds.length}/{discardCount}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {reaction.baseState.players.player.hand.map((card) => {
              const selectedCard = discardIds.includes(card.instanceId);
              return (
                <button
                  key={card.instanceId}
                  type="button"
                  onClick={() => setDiscardIds((current) => selectedCard
                    ? current.filter((id) => id !== card.instanceId)
                    : current.length < discardCount ? [...current, card.instanceId] : current)}
                  className={`rounded-lg border px-2 py-1 text-[10px] ${selectedCard ? "border-amber-300 bg-amber-300 text-slate-950" : "border-white/10 text-slate-300"}`}
                >
                  {selectedCard ? "✓ " : ""}{getCard(card.defId).name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selected && (
        <button type="button" disabled={!ready} onClick={submit} className="btn-primary mt-3 text-xs disabled:cursor-not-allowed disabled:opacity-40">
          ⚡ Ativar resposta
        </button>
      )}
    </div>
  );
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
      <ReactionActivatedPicker reaction={reaction} />
      <button onClick={onResolve} className="btn-primary" aria-keyshortcuts="Space">Passar prioridade e resolver</button>
    </section>
  );
}