"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { PendingActivatedDiscard } from "@/components/game/ActivatedDiscardPicker";
import { activateAbility, activatedAbilitiesForInstance } from "@/game/engine";
import type { GameState } from "@/game/types";
import type { GameAction } from "@/game/reducer";
import type { MatchScreen } from "./useMatchLauncher";

export function useActivatedAbilityPayment({
  state,
  screen,
  isPvp,
  setState,
  setFirstInfo,
  recordAction,
  sendPvpAction,
}: {
  state: GameState | null;
  screen: MatchScreen;
  isPvp: boolean;
  setState: Dispatch<SetStateAction<GameState | null>>;
  setFirstInfo: Dispatch<SetStateAction<string>>;
  recordAction: (action: GameAction) => void;
  sendPvpAction: (action: GameAction) => void | Promise<unknown>;
}) {
  const [pendingActivatedDiscard, setPendingActivatedDiscard] = useState<PendingActivatedDiscard | null>(null);

  const cancelActivatedDiscard = useCallback(() => setPendingActivatedDiscard(null), []);

  const commitActivatedAbility = useCallback((
    sourceInstanceId: string,
    abilityIndex: number,
    target?: string,
    modeId?: string,
    costDiscardInstanceIds?: string[],
  ) => {
    if (!state) return;
    const action: GameAction = {
      type: "sentinela",
      player: "player",
      sentinelaId: sourceInstanceId,
      abilityIndex,
      target,
      ...(modeId ? { modeId } : {}),
      ...(costDiscardInstanceIds?.length ? { costDiscardInstanceIds } : {}),
    };
    cancelActivatedDiscard();
    if (isPvp) {
      void sendPvpAction(action);
      return;
    }
    recordAction(action);
    setState(activateAbility(state, "player", sourceInstanceId, abilityIndex, target, modeId, costDiscardInstanceIds));
  }, [state, isPvp, sendPvpAction, recordAction, setState, cancelActivatedDiscard]);

  const beginActivatedAbilityPayment = useCallback((
    sourceInstanceId: string,
    abilityIndex: number,
    target?: string,
    modeId?: string,
  ) => {
    if (!state) return;
    const ability = activatedAbilitiesForInstance(state, "player", sourceInstanceId)[abilityIndex];
    if (!ability) return;
    const required = ability.cost?.discardFromHand ?? 0;
    if (required <= 0) {
      commitActivatedAbility(sourceInstanceId, abilityIndex, target, modeId);
      return;
    }
    if (state.players.player.hand.length < required) {
      setFirstInfo("Cartas insuficientes na mão para pagar o custo de descarte.");
      return;
    }
    setPendingActivatedDiscard({
      sourceInstanceId,
      abilityIndex,
      required,
      selectedIds: [],
      ...(target ? { target } : {}),
      ...(modeId ? { modeId } : {}),
    });
  }, [state, commitActivatedAbility, setFirstInfo]);

  const toggleActivatedDiscard = useCallback((instanceId: string) => {
    setPendingActivatedDiscard((current) => {
      if (!current) return current;
      if (current.selectedIds.includes(instanceId)) {
        return { ...current, selectedIds: current.selectedIds.filter((id) => id !== instanceId) };
      }
      if (current.selectedIds.length >= current.required) return current;
      return { ...current, selectedIds: [...current.selectedIds, instanceId] };
    });
  }, []);

  const confirmActivatedDiscard = useCallback(() => {
    if (!pendingActivatedDiscard || pendingActivatedDiscard.selectedIds.length !== pendingActivatedDiscard.required) return;
    commitActivatedAbility(
      pendingActivatedDiscard.sourceInstanceId,
      pendingActivatedDiscard.abilityIndex,
      pendingActivatedDiscard.target,
      pendingActivatedDiscard.modeId,
      pendingActivatedDiscard.selectedIds,
    );
  }, [pendingActivatedDiscard, commitActivatedAbility]);

  return {
    pendingActivatedDiscard: screen === "select" ? null : pendingActivatedDiscard,
    beginActivatedAbilityPayment,
    toggleActivatedDiscard,
    confirmActivatedDiscard,
    cancelActivatedDiscard,
  };
}
