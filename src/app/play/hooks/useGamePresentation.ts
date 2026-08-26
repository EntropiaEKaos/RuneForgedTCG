"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { AiDifficulty, GameState } from "@/game/types";
import type { PendingSpell, ReactionPending } from "@/game/client/match-model";
import type { CombatPace, FxMode, UiScale } from "@/components/game/GameSettings";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { useGameFx } from "@/hooks/useGameFx";
import { useFrameHealth } from "@/hooks/useFrameHealth";
import { getGameConfigSync } from "@/game/settings";

export function useGamePresentation({
  state,
  reaction,
  setPendingSpell,
  setPendingReaction,
  setAiDifficulty,
}: {
  state: GameState | null;
  reaction: ReactionPending | null;
  setPendingSpell: Dispatch<SetStateAction<PendingSpell | null>>;
  setPendingReaction: Dispatch<SetStateAction<PendingSpell | null>>;
  setAiDifficulty: Dispatch<SetStateAction<AiDifficulty>>;
}) {
  const fxState = useGameFx(state);
  const [aiToast, setAiToast] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [handExpanded, setHandExpanded] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [masterVolume, setMasterVolumeState] = useState(0.7);
  const [fxMode, setFxMode] = useState<FxMode>("full");
  const [uiScale, setUiScale] = useState<UiScale>("comfortable");
  const [combatPace, setCombatPace] = useState<CombatPace>("cinematic");
  const performanceTier = useFrameHealth();

  useDeferredEffect(() => {
    if (localStorage.getItem("runeforge_first_match_guide") !== "complete") setGuideOpen(true);
    if (localStorage.getItem("runeforge_training_checklist") !== "complete") setTrainingOpen(true);
    setFxMode(localStorage.getItem("runeforge_fx_mode") === "reduced" ? "reduced" : "full");
    setUiScale(localStorage.getItem("runeforge_ui_scale") === "compact" ? "compact" : "comfortable");
    setCombatPace(localStorage.getItem("runeforge_combat_pace") === "quick" ? "quick" : "cinematic");
    const savedDifficulty = localStorage.getItem("runeforge_ai_difficulty");
    if (savedDifficulty === "apprentice" || savedDifficulty === "overlord" || savedDifficulty === "tactician") {
      setAiDifficulty(savedDifficulty);
    }
    import("@/lib/sounds")
      .then(({ isSoundEnabled, isMusicEnabled, getMasterVolume, setMasterVolume }) => {
        setSoundOn(isSoundEnabled());
        setMusicOn(isMusicEnabled());
        if (localStorage.getItem("runeforge_volume") === null) setMasterVolume(getGameConfigSync().advanced.presentation.masterVolume);
        setMasterVolumeState(getMasterVolume());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPendingSpell(null);
        setPendingReaction(null);
        setSettingsOpen(false);
        setGuideOpen(false);
      }
      if (event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey) setGuideOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPendingReaction, setPendingSpell]);

  useEffect(() => {
    if (!state) return;
    const phase = state.phase === "gameover"
      ? "gameover"
      : reaction
        ? "response"
        : state.phase === "blocking"
          ? "combat"
          : state.activePlayer === "player"
            ? "main"
            : "opponent";
    import("@/lib/sounds")
      .then(({ syncAmbience }) => syncAmbience(phase, state.players.player.deckRegions))
      .catch(() => {});
  }, [musicOn, reaction, state]);

  useEffect(() => () => {
    void import("@/lib/sounds").then(({ stopAmbience }) => stopAmbience()).catch(() => {});
  }, []);

  return {
    ...fxState,
    aiToast,
    setAiToast,
    soundOn,
    setSoundOn,
    guideOpen,
    setGuideOpen,
    trainingOpen,
    setTrainingOpen,
    settingsOpen,
    setSettingsOpen,
    handExpanded,
    setHandExpanded,
    musicOn,
    setMusicOn,
    masterVolume,
    setMasterVolumeState,
    fxMode,
    setFxMode,
    uiScale,
    setUiScale,
    combatPace,
    setCombatPace,
    performanceTier,
  };
}

export type GamePresentationState = ReturnType<typeof useGamePresentation>;
