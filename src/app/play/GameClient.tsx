"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MatchReward } from "@/components/game/MatchResult";
import { allCards, getCard } from "@/game/cards";
import { registerCustomCards } from "@/game/custom-registry";
import { DECKS, type DeckDef } from "@/game/decks";
import { aiChooseReaction } from "@/game/ai";
import {
  activateAbility,
  activatedAbilitiesForInstance,
  applyStackedActionWithAi,
  canCastReaction,
  canDeclareAttack,
  canPlayCard,
  declareAttack,
  endTurn,
  isValidTarget,
  mulligan,
  skipMulligan,
  resolveCombat,
  spellNeedsTarget,
  type CardAction,
} from "@/game/engine";
import type { AiDifficulty, BoardEntity, GameState, PermanentInstance, PlayerId, TargetKind, UnitInstance } from "@/game/types";
import type { GameAction } from "@/game/reducer";
import { topOfReactionStack, type PendingSpell, type ReactionPending } from "@/game/client/match-model";
import type { Encounter } from "@/lib/game-modes";
import type { ArchetypeProfile } from "@/game/archetypes";
import { configureRuntimeAiRules, configureRuntimeEngineRules } from "@/game/runtime-config";
import DeckSelect, { type SavedDeck } from "./DeckSelect";
import { useGamePresentation } from "./hooks/useGamePresentation";
import { usePvpTransport } from "./hooks/usePvpTransport";
import { useMatchLauncher, type MatchScreen } from "./hooks/useMatchLauncher";
import { useMatchLifecycle } from "./hooks/useMatchLifecycle";
import { MulliganView } from "./MulliganView";
import { BattleView } from "./BattleView";
import { ensurePlayerSession } from "@/lib/client-player-session";

type Screen = MatchScreen;

const REACTION_MS = 10000;

export default function GameClient() {
  const [screen, setScreen] = useState<Screen>("select");
  const [playerName, setPlayerName] = useState("");
  const [deckKey, setDeckKey] = useState(`preset:${DECKS[0].id}`);
  const [customDecks, setCustomDecks] = useState<SavedDeck[]>([]);
  const [presetDecks, setPresetDecks] = useState<DeckDef[]>(DECKS);
  const [doctrines, setDoctrines] = useState<ArchetypeProfile[]>([]);
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>("tactician");
  const [matchReward, setMatchReward] = useState<MatchReward | null>(null);
  const [activeEncounter, setActiveEncounter] = useState<Encounter | null>(null);

  const [state, setState] = useState<GameState | null>(null);
  const [pendingSpell, setPendingSpell] = useState<PendingSpell | null>(null);
  // Kept under the legacy name for replay/UI compatibility in 2.97; this now
  // represents targeting for any board entity's activated ability.
  const [pendingSentinelaAbility, setPendingSentinelaAbility] = useState<{ sentinelaId: string; abilityIndex: number; targetType: TargetKind } | null>(null);
  const [selectedAttackers, setSelectedAttackers] = useState<string[]>([]);
  const [challenges, setChallenges] = useState<Record<string, string>>({});
  const [sentinelaTargets, setSentinelaTargets] = useState<Record<string, string>>({});
  const [blockAssignments, setBlockAssignments] = useState<Record<string, string>>({});
  const [selectedBlocker, setSelectedBlocker] = useState<string | null>(null);
  const [firstInfo, setFirstInfo] = useState<string>("");
  const [mulliganSelection, setMulliganSelection] = useState<string[]>([]);
  const [matchToken, setMatchToken] = useState<string | null>(null);
  const modeAttemptTokenRef = useRef<string | null>(null);
  const actionLogRef = useRef<GameAction[]>([]);
  const seedRef = useRef<number | null>(null);
  const modePlayerFirstRef = useRef<boolean>(true);

  // Reaction window
  const [reaction, setReaction] = useState<ReactionPending | null>(null);
  const [pendingReaction, setPendingReaction] = useState<PendingSpell | null>(null);
  const [reactionMs, setReactionMs] = useState(REACTION_MS);

  const presentation = useGamePresentation({ state, reaction, setPendingSpell, setPendingReaction, setAiDifficulty });
  const {
    setAiToast, guideOpen, settingsOpen, setFxMode, combatPace,
  } = presentation;

  useEffect(() => {
    void ensurePlayerSession(localStorage.getItem("runeforge_playername") || "").then((profile) => {
      if (profile.player?.name) setPlayerName(String(profile.player.name));
    });
  }, []);

  const savedRef = useRef(false);
  const recordAction = useCallback((action: GameAction) => {
    if (actionLogRef.current.length >= 2000) return;
    actionLogRef.current.push(action);
  }, []);
  const pvp = usePvpTransport({ playerName, screen, setState, actionLogRef });
  const {
    isPvp, pvpRoomCode, pvpVersion,
    setPvpRoomCode, setPvpVersion, setPvpGuest, setPvpConnection, setPvpMessage, sendPvpAction,
  } = pvp;

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("sandbox");
    if (!token) return;
    fetch(`/api/admin/studio/sandbox?token=${encodeURIComponent(token)}`, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok || !data.card?.defId) throw new Error(data.error || "Sandbox unavailable");
        registerCustomCards([data.card]);
        const regionPool = allCards().filter((c) => c.collectible !== false && (c.region === data.card.region || c.regions?.includes(data.card.region))).map((c) => c.defId).filter((id) => id !== data.card.defId);
        const cards = [data.card.defId, data.card.defId];
        let cursor = 0; while (cards.length < 40 && regionPool.length) { cards.push(regionPool[cursor % regionPool.length]); cursor += 1; }
        const sandboxDeck: SavedDeck = { id: -9300, name: `SANDBOX · ${data.card.name}`, emoji: "🧪", cards: cards.slice(0, 40) } as SavedDeck;
        setCustomDecks((current) => [sandboxDeck, ...current.filter((d) => d.id !== -9300)]);
        setDeckKey("custom:-9300");
        setFirstInfo(`🧪 Sandbox Studio carregado: ${data.card.name}. Esta partida não publica nem recompensa.`);
      })
      .catch((error) => setFirstInfo(error instanceof Error ? error.message : "Sandbox unavailable"));
  }, []);

  useEffect(() => {
    if (!playerName) return;
    const q = new URLSearchParams({ owner: playerName });
    fetch(`/api/decks?${q}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setCustomDecks((current) => {
          const sandboxDeck = current.find((deck) => deck.id === -9300);
          return sandboxDeck ? [sandboxDeck, ...(data.decks || []).filter((deck: SavedDeck) => deck.id !== -9300)] : (data.decks || []);
        });
      })
      .catch(() => {});
  }, [playerName]);

  useEffect(() => {
    fetch("/api/catalog", { cache: "no-store" }).then((response) => response.json()).then((data) => {
      if (data.ok && Array.isArray(data.decks) && data.decks.length) setPresetDecks(data.decks);
      if (data.ok && Array.isArray(data.doctrines)) setDoctrines(data.doctrines);
      if (data.ok && data.config) configureRuntimeEngineRules({ nexusStart: data.config.nexusStart, maxMana: data.config.maxMana, maxSpellMana: data.config.maxSpellMana, handCap: data.config.handCap, startHand: data.config.startHand, benchCap: data.config.benchCap, permanentsCap: data.config.permanentsCap, ...(data.config.engine || {}) });
      if (data.ok && data.config?.ai) configureRuntimeAiRules(data.config.ai);
      if (data.ok && Number.isFinite(Number(data.config?.reactionMs))) setReactionMs(Number(data.config.reactionMs));
      if (data.ok && data.visualTheme?.tokens && typeof data.visualTheme.tokens === "object") for (const [key, value] of Object.entries(data.visualTheme.tokens)) if (typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value)) document.documentElement.style.setProperty(`--runtime-${key.replace(/[^a-z0-9-]/gi, "-")}`, value);
      if (data.ok && data.presentation && localStorage.getItem("runeforge_fx_mode") == null && (data.presentation.reduceMotionDefault || Number(data.presentation.fxIntensity) < .5)) setFxMode("reduced");
    }).catch(() => {});
  }, [setFxMode]);

  const startMatch = useMatchLauncher({
    screen, playerName, deckKey, customDecks, presetDecks, aiDifficulty,
    actionLogRef, modeAttemptTokenRef, seedRef, modePlayerFirstRef, savedRef,
    setScreen, setState, setMatchReward, setActiveEncounter, setFirstInfo, setMatchToken,
    setSelectedAttackers, setChallenges, setSentinelaTargets, setBlockAssignments, setSelectedBlocker,
    setPendingSpell, setPendingSentinelaAbility, setReaction, setPendingReaction,
    setPvpRoomCode, setPvpVersion, setPvpGuest, setPvpConnection, setPvpMessage,
  });

  const { finishReaction, timeLeft, toastAI } = useMatchLifecycle({
    state, setState, reaction, setReaction, setPendingReaction, isPvp, combatPace, reactionMs,
    recordAction, setAiToast, pvpRoomCode, matchToken, actionLogRef, modeAttemptTokenRef, seedRef, savedRef, setMatchReward,
  });

  const isPlayerMain = !!state && state.phase === "main" && state.activePlayer === "player";
  const isPlayerBlocking =
    !!state && state.phase === "blocking" && state.combat?.attackerId === "ai";
  const canAttackNow = !!state && canDeclareAttack(state, "player");

  const selectedChallengers = useMemo(() => {
    if (!state) return [];
    return state.players.player.bench.filter(
      (u) => selectedAttackers.includes(u.instanceId) && u.keywords.includes("Challenger"),
    );
  }, [state, selectedAttackers]);

  const commitActivatedAbility = useCallback((sourceInstanceId: string, abilityIndex: number, target?: string) => {
    if (!state) return;
    // Preserve the versioned 2.97 wire opcode. The server now interprets
    // sentinelaId as a generic controlled board-source id.
    const action: GameAction = { type: "sentinela", player: "player", sentinelaId: sourceInstanceId, abilityIndex, target };
    if (isPvp) { void sendPvpAction(action); return; }
    recordAction(action);
    setState(activateAbility(state, "player", sourceInstanceId, abilityIndex, target));
  }, [state, recordAction, isPvp, sendPvpAction]);

  const handleActivatedAbility = useCallback(
    (sourceInstanceId: string, abilityIndex: number) => {
      if (!state) return;
      const ability = activatedAbilitiesForInstance(state, "player", sourceInstanceId)[abilityIndex];
      if (!ability) return;
      if (ability.effect.target === "spellOnStack") {
        setFirstInfo("Esta habilidade exige uma janela de reação e ficará indisponível até a integração com a pilha autoritativa.");
        return;
      }
      if (!["none", "self"].includes(ability.effect.target)) {
        setPendingSentinelaAbility({ sentinelaId: sourceInstanceId, abilityIndex, targetType: ability.effect.target });
        return;
      }
      commitActivatedAbility(sourceInstanceId, abilityIndex);
    },
    [state, commitActivatedAbility],
  );

  const activatedTargetOk = useCallback((entity: BoardEntity) => {
    if (!state || !pendingSentinelaAbility) return false;
    return isValidTarget(state, "player", pendingSentinelaAbility.targetType, entity);
  }, [state, pendingSentinelaAbility]);

  const handleSentinelaClick = useCallback(
    (senInstanceId: string, senOwner: PlayerId) => {
      if (!state) return;
      const sentinela = state.players[senOwner].sentinelas.find((candidate) => candidate.instanceId === senInstanceId);
      if (pendingSentinelaAbility && sentinela && activatedTargetOk({ kind: "sentinela", sen: sentinela, owner: senOwner })) {
        commitActivatedAbility(pendingSentinelaAbility.sentinelaId, pendingSentinelaAbility.abilityIndex, senInstanceId);
        setPendingSentinelaAbility(null);
        return;
      }
      if (!isPlayerMain || !canAttackNow) return;
      // Selecionar sentinela inimiga como alvo de ataque.
      if (senOwner === "ai") {
        setSentinelaTargets((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(next)) {
            if (next[k] === senInstanceId) delete next[k];
          }
          const freeAttacker = selectedAttackers.find((a) => !next[a]);
          if (freeAttacker) next[freeAttacker] = senInstanceId;
          return next;
        });
      }
    },
    [state, pendingSentinelaAbility, activatedTargetOk, commitActivatedAbility, isPlayerMain, canAttackNow, selectedAttackers],
  );

  const reactionTargetOk = useCallback(
    (owner: PlayerId, ent?: { kind: "unit" } | { kind: "permanent" }) => {
      if (!pendingReaction) return false;
      const t = pendingReaction.targetType;
      const isEnemy = owner === "ai";
      const isAlly = owner === "player";
      if (ent) {
        if (ent.kind === "unit") {
          if (t === "enemyUnit" && isEnemy) return true;
          if (t === "allyUnit" && isAlly) return true;
          if (t === "anyUnit") return true;
          return false;
        }
        if (ent.kind === "permanent") {
          if (t === "enemyPermanent" && isEnemy) return true;
          if (t === "allyPermanent" && isAlly) return true;
          if (t === "anyPermanent") return true;
          return false;
        }
      }
      if (t === "enemyUnit" || t === "anyUnit") return isEnemy;
      if (t === "allyUnit") return isAlly;
      return false;
    },
    [pendingReaction],
  );

  const applyWithAiReaction = useCallback(
    (action: CardAction): GameState | null => {
      if (!state) return null;
      if (isPvp) {
        void sendPvpAction({ type: action.kind === "spell" ? "cast" : "play", player: "player", instanceId: action.instanceId, target: action.targetInstanceId });
        return state;
      }
      recordAction({
        type: action.kind === "spell" ? "cast" : "play",
        player: "player",
        instanceId: action.instanceId,
        target: action.targetInstanceId,
      });
      // IMPORTANT: this must run BEFORE the action is resolved against the
      // board — `state` here is the pre-resolution state. If the AI wants to
      // react, we hand `state` (not an already-resolved copy) to `finishReaction`,
      // which drives the real resolution through applyStackedActionWithAi's
      // LIFO stack. Resolving the action here first (as this used to do) meant
      // the AI's "reaction" always arrived too late to matter — the unit was
      // already dead / the spell had already fired — so counterspells and
      // saves never actually worked. See engine.ts's applyStackedAction docs.
      const aiReact = (st: GameState, act: CardAction) => aiChooseReaction(st, act);
      const reactionItem = aiChooseReaction(state, action);
      if (reactionItem) {
        toastAI(reactionItem);
        setReaction({
          action,
          baseState: state,
          deadline: Date.now() + reactionMs,
          pendingHuman: { ...reactionItem, player: "ai" },
        });
        return state;
      }
      const res = applyStackedActionWithAi(state, action, "skip", null, aiReact);
      return res.next;
    },
    [state, toastAI, recordAction, isPvp, sendPvpAction, reactionMs],
  );

  const handleHandClick = useCallback(
    (instanceId: string, defId: string) => {
      if (!state) return;
      import("@/lib/sounds").then(({ sfx }) => sfx.click()).catch(() => {});

      // Reaction window: only reaction spells are playable.
      if (reaction) {
        const top = topOfReactionStack(reaction);
        if (!top) return;
        if (reaction.pendingHuman) return;
        if (!canCastReaction(reaction.baseState, "player", instanceId, top.kind)) return;
        const tt = spellNeedsTarget(defId);
        if (!tt) finishReaction({ instanceId });
        else setPendingReaction({ instanceId, defId, targetType: tt });
        return;
      }

      if (!isPlayerMain) return;
      const def = getCard(defId);
      if (!canPlayCard(state, "player", instanceId)) return;

      if (def.type === "Unit" || def.type === "Enchantment" || def.type === "Artifact" || def.type === "Equipment" || def.type === "Sentinela") {
        if (def.type === "Equipment") {
          const tt = spellNeedsTarget(defId);
          if (tt) {
            setPendingSpell({ instanceId, defId, targetType: tt });
            return;
          }
        }
        setState(
          applyWithAiReaction({
            kind: "unit",
            instanceId,
            defId,
          }),
        );
        return;
      }

      const tt = spellNeedsTarget(defId);
      if (!tt) {
        setState(applyWithAiReaction({ kind: "spell", instanceId, defId }));
      } else {
        setPendingSpell({ instanceId, defId, targetType: tt });
      }
    },
    [state, isPlayerMain, reaction, finishReaction, applyWithAiReaction],
  );

  const isValidSpellTarget = useCallback(
    (owner: PlayerId, ent?: { kind: "unit" } | { kind: "permanent" }) => {
      if (!pendingSpell) return false;
      const t = pendingSpell.targetType;
      const isEnemy = owner === "ai";
      const isAlly = owner === "player";
      if (ent) {
        if (ent.kind === "unit") {
          if (t === "enemyUnit" && isEnemy) return true;
          if (t === "allyUnit" && isAlly) return true;
          if (t === "anyUnit") return true;
          return false;
        }
        if (ent.kind === "permanent") {
          if (t === "enemyPermanent" && isEnemy) return true;
          if (t === "allyPermanent" && isAlly) return true;
          if (t === "anyPermanent") return true;
          return false;
        }
      }
      if (t === "enemyUnit" || t === "anyUnit") return isEnemy;
      if (t === "allyUnit") return isAlly;
      return false;
    },
    [pendingSpell],
  );

  const handlePermanentClick = useCallback(
    (perm: PermanentInstance) => {
      if (!state) return;
      if (pendingSentinelaAbility) {
        if (activatedTargetOk({ kind: "permanent", perm, owner: perm.owner })) {
          commitActivatedAbility(pendingSentinelaAbility.sentinelaId, pendingSentinelaAbility.abilityIndex, perm.instanceId);
          setPendingSentinelaAbility(null);
        }
        return;
      }
      if (reaction) {
        if (pendingReaction && reactionTargetOk(perm.owner, { kind: "permanent" })) {
          finishReaction({ instanceId: pendingReaction.instanceId, targetId: perm.instanceId });
        }
        return;
      }
      if (pendingSpell) {
        const ok =
          (pendingSpell.targetType === "enemyPermanent" && perm.owner === "ai") ||
          (pendingSpell.targetType === "allyPermanent" && perm.owner === "player") ||
          pendingSpell.targetType === "anyPermanent";
        if (ok) {
          setState(
            applyWithAiReaction({
              kind: "spell",
              instanceId: pendingSpell.instanceId,
              defId: pendingSpell.defId,
              targetInstanceId: perm.instanceId,
            }),
          );
          setPendingSpell(null);
        }
        return;
      }
    },
    [state, pendingSentinelaAbility, activatedTargetOk, commitActivatedAbility, reaction, pendingReaction, reactionTargetOk, finishReaction, pendingSpell, applyWithAiReaction],
  );

  const handleUnitClick = useCallback(
    (unit: UnitInstance) => {
      if (!state) return;

      if (pendingSentinelaAbility) {
        if (activatedTargetOk({ kind: "unit", unit, owner: unit.owner })) {
          commitActivatedAbility(pendingSentinelaAbility.sentinelaId, pendingSentinelaAbility.abilityIndex, unit.instanceId);
          setPendingSentinelaAbility(null);
        }
        return;
      }

      if (reaction) {
        if (pendingReaction && reactionTargetOk(unit.owner)) {
          finishReaction({ instanceId: pendingReaction.instanceId, targetId: unit.instanceId });
        }
        return;
      }

      if (pendingSpell) {
        if (isValidSpellTarget(unit.owner, { kind: "unit" })) {
          const pendingDef = getCard(pendingSpell.defId);
          setState(
            applyWithAiReaction({
              kind: pendingDef.type === "Equipment" ? "unit" : "spell",
              instanceId: pendingSpell.instanceId,
              defId: pendingSpell.defId,
              targetInstanceId: unit.instanceId,
            }),
          );
          setPendingSpell(null);
        }
        return;
      }

      if (isPlayerMain && canAttackNow && unit.owner === "ai" && selectedChallengers.length > 0) {
        const free = selectedChallengers.find((c) => !challenges[c.instanceId]);
        const champ = free ?? selectedChallengers[0];
        setChallenges((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(next)) {
            if (next[k] === unit.instanceId) delete next[k];
          }
          next[champ.instanceId] = unit.instanceId;
          return next;
        });
        return;
      }

      if (isPlayerMain && canAttackNow && unit.owner === "player") {
        setSelectedAttackers((prev) => {
          const next = prev.includes(unit.instanceId)
            ? prev.filter((id) => id !== unit.instanceId)
            : [...prev, unit.instanceId];
          setChallenges((ch) => {
            const kept: Record<string, string> = {};
            for (const [k, v] of Object.entries(ch)) if (next.includes(k)) kept[k] = v;
            return kept;
          });
          return next;
        });
        return;
      }

      if (isPlayerBlocking) {
        const locked = state.combat?.locked ?? [];
        if (unit.owner === "player") {
          const alreadyLocked = Object.entries(state.combat?.blocks ?? {}).some(
            ([atk, blk]) => blk === unit.instanceId && locked.includes(atk),
          );
          if (alreadyLocked) return;
          setSelectedBlocker((prev) => (prev === unit.instanceId ? null : unit.instanceId));
        } else if (unit.isAttacking) {
          if (locked.includes(unit.instanceId)) return;
          if (!selectedBlocker) return;
          setBlockAssignments((prev) => {
            const next = { ...prev };
            for (const k of Object.keys(next)) {
              if (next[k] === selectedBlocker) delete next[k];
            }
            if (next[unit.instanceId] === selectedBlocker) delete next[unit.instanceId];
            else next[unit.instanceId] = selectedBlocker;
            return next;
          });
          setSelectedBlocker(null);
        }
      }
    },
    [
      state,
      pendingSentinelaAbility,
      activatedTargetOk,
      commitActivatedAbility,
      reaction,
      pendingReaction,
      reactionTargetOk,
      finishReaction,
      pendingSpell,
      isValidSpellTarget,
      applyWithAiReaction,
      isPlayerMain,
      canAttackNow,
      isPlayerBlocking,
      selectedBlocker,
      selectedChallengers,
      challenges,
    ],
  );

  const confirmAttack = useCallback(() => {
    if (!state || selectedAttackers.length === 0) return;
    import("@/lib/sounds").then(({ sfx }) => sfx.attack()).catch(() => {});
    const action: GameAction = { type: "attack", player: "player", attackerIds: selectedAttackers, challenges, sentinelaTargets: Object.keys(sentinelaTargets).length ? sentinelaTargets : undefined };
    if (isPvp) void sendPvpAction(action);
    else { recordAction(action); setState(declareAttack(state, "player", selectedAttackers, challenges, Object.keys(sentinelaTargets).length ? sentinelaTargets : undefined)); }
    setSelectedAttackers([]);
    setChallenges({});
    setSentinelaTargets({});
  }, [state, selectedAttackers, challenges, sentinelaTargets, recordAction, isPvp, sendPvpAction]);

  const confirmBlocks = useCallback(() => {
    if (!state) return;
    import("@/lib/sounds").then(({ sfx }) => sfx.block()).catch(() => {});
    const locked = state.combat?.blocks ?? {};
    const action: GameAction = { type: "block", blocks: { ...locked, ...blockAssignments } };
    if (isPvp) void sendPvpAction(action);
    else { recordAction(action); setState(resolveCombat(state, { ...locked, ...blockAssignments })); }
    setBlockAssignments({});
    setSelectedBlocker(null);
  }, [state, blockAssignments, recordAction, isPvp, sendPvpAction]);

  const endMyTurn = useCallback(() => {
    if (!state || !isPlayerMain) return;
    setSelectedAttackers([]);
    setChallenges({});
    setPendingSpell(null);
    setPendingSentinelaAbility(null);
    const action: GameAction = { type: "pass", player: "player" };
    if (isPvp) void sendPvpAction(action);
    else { recordAction(action); setState(endTurn(state, "player")); }
  }, [state, isPlayerMain, recordAction, isPvp, sendPvpAction]);

  useEffect(() => {
    const onBattleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input,textarea,select,[contenteditable='true']") || settingsOpen || guideOpen) return;
      if (event.key === "Enter") {
        if (isPlayerBlocking) { event.preventDefault(); confirmBlocks(); }
        else if (selectedAttackers.length > 0 && canAttackNow) { event.preventDefault(); confirmAttack(); }
      }
      if (event.code === "Space") {
        if (reaction) { event.preventDefault(); finishReaction(); }
        else if (isPlayerMain && !pendingSpell && !pendingSentinelaAbility) { event.preventDefault(); endMyTurn(); }
      }
    };
    window.addEventListener("keydown", onBattleKey);
    return () => window.removeEventListener("keydown", onBattleKey);
  }, [settingsOpen, guideOpen, isPlayerBlocking, confirmBlocks, selectedAttackers.length, canAttackNow, confirmAttack, reaction, finishReaction, isPlayerMain, pendingSpell, pendingSentinelaAbility, endMyTurn]);

  if (screen === "select" || !state) {
    return (
      <DeckSelect
        playerName={playerName}
        setPlayerName={setPlayerName}
        deckKey={deckKey}
        setDeckKey={setDeckKey}
        customDecks={customDecks}
        presetDecks={presetDecks}
        doctrines={doctrines}
        aiDifficulty={aiDifficulty}
        onAiDifficulty={(value) => { setAiDifficulty(value); localStorage.setItem("runeforge_ai_difficulty", value); }}
        onStart={startMatch}
      />
    );
  }

  if (!state.mulliganDone.player) {
    return (
      <MulliganView
        state={state}
        selection={mulliganSelection}
        onToggle={(instanceId) => setMulliganSelection((previous) => previous.includes(instanceId) ? previous.filter((id) => id !== instanceId) : [...previous, instanceId])}
        onConfirm={() => {
          void import("@/lib/sounds").then(({ sfx }) => sfx.mulligan()).catch(() => {});
          if (mulliganSelection.length > 0) {
            const action: GameAction = { type: "mulligan", player: "player", cardIds: mulliganSelection };
            if (isPvp) void sendPvpAction(action);
            else { recordAction(action); setState(mulligan(state, "player", mulliganSelection)); }
          } else {
            const action: GameAction = { type: "skipMulligan", player: "player" };
            if (isPvp) void sendPvpAction(action);
            else { recordAction(action); setState(skipMulligan(state, "player")); }
          }
          setMulliganSelection([]);
        }}
      />
    );
  }

  return (
    <BattleView
      state={state}
      presetDecks={presetDecks}
      activeEncounter={activeEncounter}
      matchReward={matchReward}
      reaction={reaction}
      pendingSpell={pendingSpell}
      pendingReaction={pendingReaction}
      pendingSentinelaAbility={pendingSentinelaAbility}
      selectedAttackers={selectedAttackers}
      selectedChallengers={selectedChallengers}
      selectedBlocker={selectedBlocker}
      challenges={challenges}
      blockAssignments={blockAssignments}
      isPlayerMain={isPlayerMain}
      isPlayerBlocking={isPlayerBlocking}
      canAttackNow={canAttackNow}
      timeLeft={timeLeft}
      firstInfo={firstInfo}
      presentation={presentation}
      pvp={pvp}
      isValidSpellTarget={isValidSpellTarget}
      reactionTargetOk={reactionTargetOk}
      activatedTargetOk={activatedTargetOk}
      handlePermanentClick={handlePermanentClick}
      handleSentinelaClick={handleSentinelaClick}
      handleSentinelaActivate={handleActivatedAbility}
      handleUnitClick={handleUnitClick}
      handleHandClick={handleHandClick}
      confirmAttack={confirmAttack}
      confirmBlocks={confirmBlocks}
      endMyTurn={endMyTurn}
      finishReaction={finishReaction}
      replay={startMatch}
      changeDeck={() => setScreen("select")}
      setPendingSpell={setPendingSpell}
      setPendingReaction={setPendingReaction}
      setPendingSentinelaAbility={setPendingSentinelaAbility}
      setSelectedBlocker={setSelectedBlocker}
      setChallenges={setChallenges}
      setSentinelaTargets={setSentinelaTargets}
    />
  );
}
