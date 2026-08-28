"use client";

import { useCallback, useEffect, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { getCard } from "@/game/cards";
import { aiChooseAction, aiChooseReaction, aiDefend, applyAiAction, aiResolveTurnEnd, type AiAction } from "@/game/ai";
import { applyStackedActionWithAi, canCastReaction, type CardAction } from "@/game/engine";
import type { GameState } from "@/game/types";
import type { GameAction } from "@/game/reducer";
import type { PendingSpell, ReactionPending } from "@/game/client/match-model";
import type { MatchReward } from "@/components/game/MatchResult";
import type { CombatPace } from "@/components/game/GameSettings";

export function useMatchLifecycle({
  state, setState, reaction, setReaction, setPendingReaction, isPvp, combatPace, reactionMs,
  recordAction, setAiToast, pvpRoomCode, matchToken, actionLogRef, modeAttemptTokenRef, seedRef,
  savedRef, setMatchReward,
}: {
  state: GameState | null;
  setState: Dispatch<SetStateAction<GameState | null>>;
  reaction: ReactionPending | null;
  setReaction: Dispatch<SetStateAction<ReactionPending | null>>;
  setPendingReaction: Dispatch<SetStateAction<PendingSpell | null>>;
  isPvp: boolean;
  combatPace: CombatPace;
  reactionMs: number;
  recordAction: (action: GameAction) => void;
  setAiToast: Dispatch<SetStateAction<string | null>>;
  pvpRoomCode: string | null;
  matchToken: string | null;
  actionLogRef: MutableRefObject<GameAction[]>;
  modeAttemptTokenRef: MutableRefObject<string | null>;
  seedRef: MutableRefObject<number | null>;
  savedRef: MutableRefObject<boolean>;
  setMatchReward: Dispatch<SetStateAction<MatchReward | null>>;
}) {
  const [timeLeft, setTimeLeft] = useState(reactionMs);

  const toastAI = useCallback((react: AiAction) => {
    setAiToast(`⚡ O adversário responde: ${getCard(react.defId).name}`);
    window.setTimeout(() => setAiToast(null), 1900);
  }, [setAiToast]);

  useEffect(() => {
    if (isPvp || !state || reaction || state.phase === "gameover") return;
    if (state.phase === "blocking" && state.combat?.attackerId === "player") {
      const timer = window.setTimeout(() => setState((current) => current ? aiDefend(current) : current), combatPace === "quick" ? 360 : 900);
      return () => window.clearTimeout(timer);
    }
    if (state.phase === "main" && state.activePlayer === "ai") {
      const timer = window.setTimeout(() => {
        const action = aiChooseAction(state);
        if (!action) { setState(aiResolveTurnEnd(state)); return; }
        const canReact = state.players.player.hand.some((card) => canCastReaction(state, "player", card.instanceId, action.kind));
        if (canReact) {
          setReaction({ action: { ...action, player: "ai" }, baseState: state, deadline: Date.now() + reactionMs, pendingHuman: null });
        } else {
          setState(applyAiAction(state, action));
        }
      }, combatPace === "quick" ? 320 : 800);
      return () => window.clearTimeout(timer);
    }
  }, [combatPace, isPvp, reaction, reactionMs, setReaction, setState, state]);

  const finishReaction = useCallback((humanReact?: { instanceId: string; targetId?: string }) => {
    if (!reaction) return;
    const aiReact = (current: GameState, action: CardAction) => aiChooseReaction(current, action);
    if (humanReact) {
      const card = reaction.baseState.players.player.hand.find((entry) => entry.instanceId === humanReact.instanceId);
      if (!card) return;
      recordAction({ type: "cast", player: "player", instanceId: humanReact.instanceId, target: humanReact.targetId });
      const humanAction: CardAction = { player: "player", kind: "spell", instanceId: humanReact.instanceId, defId: card.defId, targetInstanceId: humanReact.targetId };
      const result = applyStackedActionWithAi(reaction.baseState, reaction.action, "react", humanAction, aiReact);
      const aiCounter = aiChooseReaction(result.next, humanAction);
      if (aiCounter) {
        toastAI(aiCounter);
        setReaction({ action: reaction.action, baseState: result.next, deadline: Date.now() + reactionMs, pendingHuman: humanAction });
        setPendingReaction(null);
        return;
      }
      setState(result.next);
      setReaction(null);
      setPendingReaction(null);
      return;
    }
    recordAction({ type: "resolve" });
    const result = applyStackedActionWithAi(reaction.baseState, reaction.action, "skip", null, aiReact);
    setState(result.next);
    setReaction(null);
    setPendingReaction(null);
  }, [reaction, reactionMs, recordAction, setPendingReaction, setReaction, setState, toastAI]);

  useDeferredEffect(() => {
    if (isPvp || !reaction) return;
    setTimeLeft(Math.max(0, reaction.deadline - Date.now()));
    const interval = window.setInterval(() => {
      const left = reaction.deadline - Date.now();
      setTimeLeft(Math.max(0, left));
      if (left <= 0) finishReaction();
    }, 100);
    return () => window.clearInterval(interval);
  }, [finishReaction, isPvp, reaction]);

  useEffect(() => {
    if (!state || state.phase !== "gameover" || savedRef.current) return;
    if (pvpRoomCode) {
      savedRef.current = true;
      void fetch("/api/player/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: state.players.player.name }) })
        .then((response) => response.json()).then((data) => { if (data.ok) setMatchReward(data); }).catch(() => {});
    } else {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get("mode");
      const modeId = params.get("modeId");
      if (mode && modeId) {
        savedRef.current = true;
        void fetch("/api/modes", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: state.players.player.name, modeType: mode, modeId, actions: actionLogRef.current, attemptToken: modeAttemptTokenRef.current }),
        }).catch(() => {});
        return;
      }
      if (!matchToken || !seedRef.current) return;
      savedRef.current = true;
      void (async () => {
        try {
          const matchResponse = await fetch("/api/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchToken, actions: actionLogRef.current }) });
          const matchData = await matchResponse.json().catch(() => null);
          const matchId = matchData?.match?.id;
          if (matchId) {
            const rewardResponse = await fetch("/api/player/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: state.players.player.name, matchId }) });
            const rewardData = await rewardResponse.json().catch(() => null);
            if (rewardData?.ok) setMatchReward(rewardData);
          }
        } catch {
          // Match settlement failure must not crash the client UI.
        }
      })();
    }
    const playerWon = state.winner === "player";
    void import("@/lib/sounds").then(({ sfx }) => playerWon ? sfx.victory() : sfx.defeat()).catch(() => {});
  }, [actionLogRef, matchToken, modeAttemptTokenRef, pvpRoomCode, savedRef, seedRef, setMatchReward, state]);

  return { finishReaction, timeLeft, toastAI };
}
