"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { DECKS, type DeckDef } from "@/game/decks";
import { createCustomGame, createGame } from "@/game/engine";
import { AI_DIFFICULTIES } from "@/game/ai-personality";
import type { AiDifficulty, DeckInput, GameState } from "@/game/types";
import type { GameAction } from "@/game/reducer";
import type { ReactionPending, PendingSpell } from "@/game/client/match-model";
import type { Boss, BrawlMode, Encounter, Puzzle } from "@/lib/game-modes";
import type { MatchReward } from "@/components/game/MatchResult";
import type { SavedDeck } from "../DeckSelect";
import type { TargetKind } from "@/game/types";

export type MatchScreen = "select" | "game";
type PendingSentinelaAbility = { sentinelaId: string; abilityIndex: number; targetType: TargetKind };

export function useMatchLauncher({
  screen, playerName, deckKey, customDecks, presetDecks, aiDifficulty,
  actionLogRef, modeAttemptTokenRef, seedRef, modePlayerFirstRef, savedRef,
  setScreen, setState, setMatchReward, setActiveEncounter, setFirstInfo, setMatchToken,
  setSelectedAttackers, setChallenges, setSentinelaTargets, setBlockAssignments, setSelectedBlocker,
  setPendingSpell, setPendingSentinelaAbility, setReaction, setPendingReaction,
  setPvpRoomCode, setPvpVersion, setPvpGuest, setPvpConnection, setPvpMessage,
}: {
  screen: MatchScreen;
  playerName: string;
  deckKey: string;
  customDecks: SavedDeck[];
  presetDecks: DeckDef[];
  aiDifficulty: AiDifficulty;
  actionLogRef: MutableRefObject<GameAction[]>;
  modeAttemptTokenRef: MutableRefObject<string | null>;
  seedRef: MutableRefObject<number | null>;
  modePlayerFirstRef: MutableRefObject<boolean>;
  savedRef: MutableRefObject<boolean>;
  setScreen: Dispatch<SetStateAction<MatchScreen>>;
  setState: Dispatch<SetStateAction<GameState | null>>;
  setMatchReward: Dispatch<SetStateAction<MatchReward | null>>;
  setActiveEncounter: Dispatch<SetStateAction<Encounter | null>>;
  setFirstInfo: Dispatch<SetStateAction<string>>;
  setMatchToken: Dispatch<SetStateAction<string | null>>;
  setSelectedAttackers: Dispatch<SetStateAction<string[]>>;
  setChallenges: Dispatch<SetStateAction<Record<string, string>>>;
  setSentinelaTargets: Dispatch<SetStateAction<Record<string, string>>>;
  setBlockAssignments: Dispatch<SetStateAction<Record<string, string>>>;
  setSelectedBlocker: Dispatch<SetStateAction<string | null>>;
  setPendingSpell: Dispatch<SetStateAction<PendingSpell | null>>;
  setPendingSentinelaAbility: Dispatch<SetStateAction<PendingSentinelaAbility | null>>;
  setReaction: Dispatch<SetStateAction<ReactionPending | null>>;
  setPendingReaction: Dispatch<SetStateAction<PendingSpell | null>>;
  setPvpRoomCode: Dispatch<SetStateAction<string | null>>;
  setPvpVersion: Dispatch<SetStateAction<number | null>>;
  setPvpGuest: Dispatch<SetStateAction<boolean>>;
  setPvpConnection: Dispatch<SetStateAction<import("@/game/client/match-model").PvpConnectionState>>;
  setPvpMessage: Dispatch<SetStateAction<string>>;
}) {
  const resolvePlayerDeck = useCallback((): DeckInput => {
    if (deckKey.startsWith("custom:")) {
      const id = Number(deckKey.slice(7));
      const custom = customDecks.find((deck) => deck.id === id);
      if (custom && custom.cards.length > 0) return { id: `custom_${custom.id}`, name: custom.name, cards: custom.cards };
    }
    const presetId = deckKey.startsWith("preset:") ? deckKey.slice(7) : deckKey;
    const preset = presetDecks.find((deck) => deck.id === presetId) ?? presetDecks[0] ?? DECKS[0];
    return { id: preset.id, name: preset.name, cards: preset.cards };
  }, [customDecks, deckKey, presetDecks]);

  const resetTransientMatchState = useCallback(() => {
    setSelectedAttackers([]);
    setChallenges({});
    setSentinelaTargets({});
    setBlockAssignments({});
    setSelectedBlocker(null);
    setPendingSpell(null);
    setPendingSentinelaAbility(null);
    setReaction(null);
    setPendingReaction(null);
    actionLogRef.current = [];
    savedRef.current = false;
  }, [actionLogRef, savedRef, setBlockAssignments, setChallenges, setPendingReaction, setPendingSentinelaAbility, setPendingSpell, setReaction, setSelectedAttackers, setSelectedBlocker, setSentinelaTargets]);

  const startMatch = useCallback(() => {
    const playerDeck = resolvePlayerDeck();
    setMatchReward(null);
    setActiveEncounter(null);
    resetTransientMatchState();
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const modeId = params.get("modeId");
    const ranked = params.get("ranked") === "1";
    const roomCode = params.get("pvpRoom");
    const sandbox = params.get("sandbox");

    if (sandbox) {
      const opponent = presetDecks[0] ?? DECKS[0];
      const entropy = new Uint32Array(1); crypto.getRandomValues(entropy); const seed = 930000 + Number(entropy[0] % 9999);
      seedRef.current = seed; modePlayerFirstRef.current = true; setMatchToken(null); modeAttemptTokenRef.current = null;
      setState(createCustomGame(playerName, playerDeck, opponent, { aiName: "Sandbox AI", playerGoesFirst: true, seed, logPrefix: "🧪 Studio Sandbox — " }));
      setFirstInfo("🧪 Sandbox local do Studio · sem rewards, MMR ou persistência de resultado.");
      setScreen("game"); return;
    }

    if (roomCode) {
      setPvpConnection("connecting");
      setPvpMessage("Entrando na sala autoritativa…");
      fetch(`/api/pvp/${encodeURIComponent(roomCode)}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((data) => {
          if (!data.ok || !data.room?.gameState) throw new Error(data.error || "PvP room unavailable");
          const room = data.room;
          setPvpRoomCode(room.code);
          setPvpVersion(room.version);
          setPvpGuest(room.viewerSide === "guest");
          setPvpConnection("synced");
          setPvpMessage("Estado sincronizado.");
          setState(room.gameState);
          setFirstInfo("⚔️ Partida PvP — estado autoritativo do servidor.");
          seedRef.current = room.gameState.seed;
          actionLogRef.current = [];
          savedRef.current = false;
          setScreen("game");
        })
        .catch(() => {
          setPvpRoomCode(null); setPvpVersion(null); setPvpConnection("offline"); setPvpMessage("Sala indisponível.");
          setFirstInfo("Não foi possível entrar na partida PvP.");
        });
      return;
    }

    if (mode && modeId) {
      fetch("/api/modes/attempt", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: playerName, modeType: mode, modeId, deckId: playerDeck.id }),
      })
        .then((response) => response.json())
        .then((attempt) => {
          if (!attempt.ok) throw new Error(attempt.error || "Could not prepare mode attempt");
          const definition = attempt.modeDefinition;
          const puzzle = mode === "puzzle" ? definition as Puzzle : undefined;
          const boss = mode === "boss" ? definition as Boss : undefined;
          const brawl = mode === "brawl" ? definition as BrawlMode : undefined;
          const encounter = mode === "expedition" ? definition as Encounter : undefined;
          if ((mode === "puzzle" && !puzzle) || (mode === "boss" && !boss) || (mode === "brawl" && !brawl) || (mode === "expedition" && !encounter)) throw new Error("Mode not found");
          const authoritativePlayerDeck = attempt.playerDeck as DeckInput;
          const authoritativeOpponent = attempt.opponentDeck as DeckInput;
          const authoritativeSeed = Number(attempt.seed);
          const authoritativeFirst = Boolean(attempt.playerFirst);
          if (!Number.isInteger(authoritativeSeed) || authoritativeSeed <= 0 || !authoritativePlayerDeck?.id || !authoritativeOpponent?.id) throw new Error("Invalid authoritative mode configuration");
          modeAttemptTokenRef.current = attempt.token;
          seedRef.current = authoritativeSeed;
          modePlayerFirstRef.current = authoritativeFirst;
          actionLogRef.current = [];
          savedRef.current = false;
          if (mode === "puzzle" && puzzle) {
            setState(createCustomGame(playerName, authoritativePlayerDeck, authoritativeOpponent, { aiName: "Puzzle", playerNexus: puzzle.playerNexus, aiNexus: puzzle.aiNexus, playerStartingMana: puzzle.playerMana, aiStartingMana: Math.max(1, Math.min(10, puzzle.playerMana - 1)), playerStartingHand: puzzle.playerHand.length, aiStartingHand: puzzle.aiHand.length, playerBench: puzzle.playerBench, aiBench: puzzle.aiBench, playerGoesFirst: true, skipMulligan: true, logPrefix: "🧩 Puzzle — ", seed: authoritativeSeed, rules: attempt.engineRules, aiRules: attempt.aiRules }));
          } else if (mode === "boss" && boss) {
            setState(createCustomGame(playerName, authoritativePlayerDeck, authoritativeOpponent, { aiName: boss.name, playerNexus: boss.playerNexusStart, aiNexus: boss.aiNexusStart, aiBench: boss.aiStartingBench, playerGoesFirst: true, skipMulligan: true, logPrefix: `👹 ${boss.emoji} Boss — `, seed: authoritativeSeed, rules: attempt.engineRules, aiRules: attempt.aiRules }));
          } else if (mode === "brawl" && brawl) {
            const rules = brawl.rules;
            setState(createCustomGame(playerName, authoritativePlayerDeck, authoritativeOpponent, { aiName: "Brawl AI", playerNexus: rules.startingNexus, aiNexus: rules.startingNexus, playerStartingMana: rules.startingMana ?? 1, aiStartingMana: rules.startingMana ?? 1, playerStartingHand: rules.startingHand, aiStartingHand: rules.startingHand, playerGoesFirst: authoritativeFirst, logPrefix: `⚡ ${brawl.name} — `, seed: authoritativeSeed, rules: attempt.engineRules, aiRules: attempt.aiRules }));
          } else if (mode === "expedition" && encounter) {
            setActiveEncounter(encounter);
            setState(createCustomGame(playerName, authoritativePlayerDeck, authoritativeOpponent, { aiName: encounter.name, playerNexus: encounter.playerNexus, aiNexus: encounter.aiNexus, playerStartingMana: encounter.playerMana ?? 1, aiStartingMana: encounter.aiMana ?? 1, playerStartingHand: encounter.playerHand, aiStartingHand: encounter.aiHand, aiBench: encounter.aiBench, playerGoesFirst: true, skipMulligan: true, aiDifficulty: "overlord", logPrefix: `🧭 ${encounter.chapter} — `, seed: authoritativeSeed, rules: attempt.engineRules, aiRules: attempt.aiRules }));
          }
          setFirstInfo(mode === "puzzle" ? "🧩 Puzzle mode — win this turn!" : mode === "boss" ? "👹 Boss battle — survive and destroy the Boss!" : mode === "expedition" ? `🧭 ${encounter?.chapter} — ${encounter?.mutator.label}` : "⚔️ Brawl — special rules active!");
          setScreen("game");
        })
        .catch((error) => { console.error(error); setFirstInfo("Não foi possível preparar a tentativa autoritativa."); setScreen("select"); });
      return;
    }

    if (ranked) { window.location.href = "/ranked"; return; }
    setMatchToken(null);
    modeAttemptTokenRef.current = null;
    setFirstInfo("Preparing an authoritative match…");
    setScreen("select");
    fetch("/api/matches/token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerName, deckId: playerDeck.id, difficulty: aiDifficulty }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error || "Could not prepare match");
        const authoritativeSeed = Number(data.seed);
        const authoritativeFirst = Boolean(data.playerFirst);
        const authoritativeOpponent = data.opponentDeck as DeckInput;
        if (!authoritativeOpponent?.id || !Array.isArray(authoritativeOpponent.cards) || !Number.isInteger(authoritativeSeed) || authoritativeSeed <= 0) throw new Error("Invalid authoritative match configuration");
        seedRef.current = authoritativeSeed;
        modePlayerFirstRef.current = authoritativeFirst;
        actionLogRef.current = [];
        savedRef.current = false;
        setMatchToken(data.token);
        const issuedDifficulty: AiDifficulty = data.difficulty === "apprentice" || data.difficulty === "overlord" ? data.difficulty : "tactician";
        const persona = data.persona?.title ? `${data.persona.title} · ${data.persona.intent}` : AI_DIFFICULTIES[issuedDifficulty].label;
        setFirstInfo(`${authoritativeFirst ? "Você começa com o Token de Ataque" : "O adversário começa"} · IA ${AI_DIFFICULTIES[issuedDifficulty].label} · ${persona}.`);
        setState(createGame(playerName, playerDeck, authoritativeOpponent, authoritativeFirst, authoritativeSeed, issuedDifficulty, data.engineRules, data.aiRules));
        setScreen("game");
      })
      .catch(() => { setFirstInfo("Não foi possível preparar a partida autoritativa."); setScreen("select"); });
  }, [actionLogRef, aiDifficulty, modeAttemptTokenRef, modePlayerFirstRef, playerName, presetDecks, resetTransientMatchState, resolvePlayerDeck, savedRef, seedRef, setActiveEncounter, setFirstInfo, setMatchReward, setMatchToken, setPvpConnection, setPvpGuest, setPvpMessage, setPvpRoomCode, setPvpVersion, setScreen, setState]);

  useDeferredEffect(() => {
    const room = new URLSearchParams(window.location.search).get("pvpRoom");
    if (room && screen === "select") startMatch();
  }, [screen, startMatch]);

  return startMatch;
}
