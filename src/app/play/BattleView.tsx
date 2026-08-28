"use client";

import type { Dispatch, SetStateAction } from "react";
import CardTip from "@/components/CardTip";
import { PlayerBar, Row, EmptyHint } from "@/components/GameUI";
import { AttackForecast, FirstMatchGuide, TurnRail, matchGuidance, type MatchPhase } from "@/components/MatchExperience";
import { MatchResult, type MatchReward } from "@/components/game/MatchResult";
import { PvpStatus } from "@/components/game/PvpStatus";
import { ReactionStack } from "@/components/game/ReactionStack";
import { PlayerHand } from "@/components/game/PlayerHand";
import { CombatOutcomePreview } from "@/components/game/CombatOutcomePreview";
import { GameSettings } from "@/components/game/GameSettings";
import { TutorialChecklist } from "@/components/game/TutorialChecklist";
import { CombatLane } from "@/components/game/CombatLane";
import { TargetingHud, type TargetingMode } from "@/components/game/TargetingHud";
import { ArenaIdentity } from "@/components/game/ArenaIdentity";
import { MatchCinematics } from "@/components/game/MatchCinematics";
import { MechanicCue } from "@/components/game/MechanicCue";
import { BoardStatusStrip } from "@/components/game/BoardStatusStrip";
import { CombatFeedback } from "@/components/game/CombatFeedback";
import { ArchetypeTracker } from "@/components/game/ArchetypeTracker";
import { EncounterBanner } from "@/components/game/EncounterBanner";
import { CombatChoreography } from "@/components/game/CombatChoreography";
import SentinelaView from "@/components/SentinelaView";
import { PlayerJourney } from "@/components/game/PlayerJourney";
import { getCard } from "@/game/cards";
import { boardEntityName, topOfReactionStack, type PendingSpell, type ReactionPending } from "@/game/client/match-model";
import { permanentAsUnit } from "@/game/client/card-adapters";
import type { DeckDef } from "@/game/decks";
import type { Encounter } from "@/lib/game-modes";
import type { GameState, PermanentInstance, PlayerId, UnitInstance } from "@/game/types";
import type { GamePresentationState } from "./hooks/useGamePresentation";
import type { PvpTransportState } from "./hooks/usePvpTransport";

type TargetEntity = { kind: "unit" } | { kind: "permanent" };
type PendingSentinelaAbility = { sentinelaId: string; abilityIndex: number; targetType: import("@/game/types").TargetKind };

export interface BattleViewProps {
  state: GameState;
  presetDecks: DeckDef[];
  activeEncounter: Encounter | null;
  matchReward: MatchReward | null;
  reaction: ReactionPending | null;
  pendingSpell: PendingSpell | null;
  pendingReaction: PendingSpell | null;
  pendingSentinelaAbility: PendingSentinelaAbility | null;
  selectedAttackers: string[];
  selectedChallengers: UnitInstance[];
  selectedBlocker: string | null;
  challenges: Record<string, string>;
  blockAssignments: Record<string, string>;
  isPlayerMain: boolean;
  isPlayerBlocking: boolean;
  canAttackNow: boolean;
  timeLeft: number;
  firstInfo: string;
  presentation: GamePresentationState;
  pvp: PvpTransportState;
  isValidSpellTarget: (owner: PlayerId, entity?: TargetEntity) => boolean;
  reactionTargetOk: (owner: PlayerId, entity?: TargetEntity) => boolean;
  handlePermanentClick: (permanent: PermanentInstance) => void;
  handleSentinelaClick: (sentinelaId: string, owner: PlayerId) => void;
  handleSentinelaActivate: (sentinelaId: string, abilityIndex: number) => void;
  handleUnitClick: (unit: UnitInstance) => void;
  handleHandClick: (instanceId: string, defId: string) => void;
  confirmAttack: () => void;
  confirmBlocks: () => void;
  endMyTurn: () => void;
  finishReaction: (humanReact?: { instanceId: string; targetId?: string }) => void;
  replay: () => void;
  changeDeck: () => void;
  setPendingSpell: Dispatch<SetStateAction<PendingSpell | null>>;
  setPendingReaction: Dispatch<SetStateAction<PendingSpell | null>>;
  setPendingSentinelaAbility: Dispatch<SetStateAction<PendingSentinelaAbility | null>>;
  setSelectedBlocker: Dispatch<SetStateAction<string | null>>;
  setChallenges: Dispatch<SetStateAction<Record<string, string>>>;
  setSentinelaTargets: Dispatch<SetStateAction<Record<string, string>>>;
}

export function BattleView(props: BattleViewProps) {
  const {
    state, presetDecks, activeEncounter, matchReward, reaction, pendingSpell, pendingReaction,
    pendingSentinelaAbility, selectedAttackers, selectedChallengers, selectedBlocker, challenges,
    blockAssignments, isPlayerMain, isPlayerBlocking, canAttackNow, timeLeft, firstInfo,
    presentation, pvp, isValidSpellTarget, reactionTargetOk, handlePermanentClick,
    handleSentinelaClick, handleSentinelaActivate, handleUnitClick, handleHandClick,
    confirmAttack, confirmBlocks, endMyTurn, finishReaction, replay, changeDeck,
    setPendingSpell, setPendingReaction, setPendingSentinelaAbility, setSelectedBlocker,
    setChallenges, setSentinelaTargets,
  } = props;
  const {
    fx, shaking, hitStop, nexusFlash, levelBanner, impactFlash, impactLabel, aiToast, setAiToast,
    soundOn, setSoundOn, guideOpen, setGuideOpen, trainingOpen, setTrainingOpen, settingsOpen,
    setSettingsOpen, handExpanded, setHandExpanded, musicOn, setMusicOn, masterVolume,
    setMasterVolumeState, fxMode, setFxMode, uiScale, setUiScale, combatPace, setCombatPace,
    performanceTier,
  } = presentation;
  const { isPvp, pvpConnection, pvpMessage, pvpVersion, pvpLatency } = pvp;

  const player = state.players.player;
  const ai = state.players.ai;
  const gameover = state.phase === "gameover";
  const lockedBlocks = state.combat?.blocks ?? {};
  const lockedAttackers = state.combat?.locked ?? [];
  const banner = gameover
    ? state.winner === "player" ? "🏆 Vitória! O Nexus inimigo caiu." : "💀 Derrota. Seu Nexus foi destruído."
    : isPlayerBlocking ? "🛡️ Defina seus bloqueadores e confirme."
      : isPlayerMain ? pendingSpell ? "🎯 Escolha um alvo para o feitiço."
        : canAttackNow ? selectedChallengers.length > 0 ? "Selecione rivais para desafiá-los e então ataque." : "Seu turno — jogue cartas ou selecione atacantes."
          : "Seu turno — jogue cartas (sem Token de Ataque)."
        : "⏳ O adversário está planejando…";
  const aiAttackers = ai.bench.filter((unit) => unit.isAttacking);
  const playerAttackers = player.bench.filter((unit) => unit.isAttacking);
  const levelFxBusy = new Set(fx.filter((event) => event.type === "levelup").map((event) => event.unitId));
  const unitFxClass = (unit: UnitInstance) => [
    "animate-pop",
    state.phase === "blocking" && unit.isAttacking ? "animate-lunge" : "",
    levelFxBusy.has(unit.instanceId) ? "animate-level" : "",
  ].filter(Boolean).join(" ");
  const stackTop = topOfReactionStack(reaction);
  const reactionTargetName = reaction && stackTop?.targetInstanceId
    ? (() => { const defId = boardEntityName(reaction.baseState, stackTop.targetInstanceId); return defId ? getCard(defId).name : null; })()
    : null;
  const matchPhase: MatchPhase = gameover ? "gameover" : reaction ? "response" : isPlayerBlocking || selectedAttackers.length > 0 ? "combat" : isPlayerMain ? "main" : "opponent";
  const guidance = matchGuidance(matchPhase, selectedAttackers.length, Boolean(pendingSpell || pendingSentinelaAbility || pendingReaction));
  const visualCardId = player.hand[0]?.defId ?? player.bench[0]?.defId ?? player.deck[0];
  const battlefieldRegions = player.deckRegions ?? presetDecks.find((deck) => deck.id === player.deckId)?.regions ?? (visualCardId ? [getCard(visualCardId).region] : []);
  const battlefieldRegion = battlefieldRegions[0]?.toLowerCase() ?? "neutral";
  const targetingMode: TargetingMode | null = pendingReaction ? "reaction" : pendingSpell ? "spell" : pendingSentinelaAbility ? "sentinela" : selectedChallengers.length > 0 ? "challenge" : selectedBlocker ? "block" : null;
  const cancelTargeting = () => {
    setPendingSpell(null);
    setPendingReaction(null);
    setPendingSentinelaAbility(null);
    setSelectedBlocker(null);
    if (targetingMode === "challenge") { setChallenges({}); setSentinelaTargets({}); }
  };

  return (
    <div
      data-region={battlefieldRegion}
      data-region-count={battlefieldRegions.length}
      data-deck-identity={battlefieldRegions.join("-").toLowerCase()}
      data-match-phase={matchPhase}
      data-pvp-busy={isPvp && (pvpConnection === "sending" || pvpConnection === "retrying")}
      data-fx={fxMode}
      data-ui-scale={uiScale}
      data-combat-pace={combatPace}
      data-performance={performanceTier}
      className={["tcg-arena min-h-screen text-slate-100", shaking ? "animate-shake" : "", hitStop && fxMode === "full" ? "combat-hit-stop" : ""].join(" ")}
    >
      <ArenaIdentity region={battlefieldRegion} regions={battlefieldRegions} />
      <div className="arena-ambient arena-ambient-a" aria-hidden="true" />
      <div className="arena-ambient arena-ambient-b" aria-hidden="true" />
      <div className="arena-scanlines" aria-hidden="true" />
      {impactFlash && <div className={["combat-screen-flash", `combat-screen-flash-${impactFlash}`].join(" ")} aria-hidden="true" />}
      <div className="combat-vignette" aria-hidden="true" />
      <MatchCinematics round={state.round} activePlayer={state.activePlayer} phase={matchPhase} />
      <MechanicCue events={fx} />
      <CombatFeedback label={impactLabel} />
      <CombatChoreography events={fx} pace={combatPace} />
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col">
        <div className="tcg-match-header">
          <span className="tcg-match-brand">RUNE<b>FORGE</b><small>ARENA DO NEXUS</small></span>
          {isPvp ? <PvpStatus state={pvpConnection} message={pvpMessage} version={pvpVersion} latency={pvpLatency} /> : <span className="tcg-match-status"><i /> PARTIDA AO VIVO</span>}
          <span className="tcg-round-pill">RODADA {state.round}</span>
        </div>
        <TurnRail phase={matchPhase} guidance={guidance} />
        <BoardStatusStrip state={state} phase={matchPhase} />
        <EncounterBanner encounter={activeEncounter} />
        <ArchetypeTracker state={state} />
        <PlayerBar player={ai} active={state.activePlayer === "ai"} hasToken={state.attackToken === "ai"} top flash={nexusFlash.ai} />

        <div className="tcg-divider" aria-hidden="true" />

        <Row label="CAMPO RIVAL" side="ai">
          {ai.bench.length === 0 && ai.permanents.length === 0 && <EmptyHint text="Sem unidades ou permanentes inimigos" />}
          {ai.permanents.map((permanent) => {
            const clickable = (!!pendingSpell && isValidSpellTarget("ai", { kind: "permanent" })) || !!(reaction && pendingReaction && reactionTargetOk("ai", { kind: "permanent" }));
            return <CardTip key={permanent.instanceId} defId={permanent.defId} unit={permanentAsUnit(permanent)} state={state} size="sm" targetable={clickable} onClick={clickable ? () => handlePermanentClick(permanent) : undefined} />;
          })}
          {ai.sentinelas.map((sentinela) => (
            <div key={sentinela.instanceId} className={isPlayerMain && canAttackNow ? "cursor-pointer hover:ring-2 hover:ring-red-400" : ""} onClick={() => handleSentinelaClick(sentinela.instanceId, "ai")} title={isPlayerMain && canAttackNow ? "Clique para atacar esta Sentinela" : ""}>
              <SentinelaView instance={sentinela} state={state} size="sm" />
            </div>
          ))}
          {ai.bench.map((unit) => {
            const challenged = Object.values(challenges).includes(unit.instanceId);
            const clickable = (!!pendingSpell && isValidSpellTarget("ai")) || (reaction && !!pendingReaction && reactionTargetOk("ai")) || (isPlayerBlocking && unit.isAttacking) || (isPlayerMain && canAttackNow && selectedChallengers.length > 0);
            return (
              <CardTip key={unit.instanceId} defId={unit.defId} unit={unit} state={state} size="sm" className={unitFxClass(unit)} attacking={unit.isAttacking}
                targetable={(!!pendingSpell && isValidSpellTarget("ai")) || !!(reaction && pendingReaction && reactionTargetOk("ai")) || (isPlayerMain && canAttackNow && selectedChallengers.length > 0)}
                selected={challenged || (isPlayerBlocking && unit.isAttacking && !!blockAssignments[unit.instanceId])} onClick={clickable ? () => handleUnitClick(unit) : undefined} />
            );
          })}
        </Row>

        <div className="relative flex-1 border-y border-white/10 bg-black/20 px-3 py-2">
          <div className="arena-center-glow" aria-hidden="true" />
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">Rodada {state.round}</span>
            <p className="text-center text-sm font-bold text-amber-200 drop-shadow">{banner}</p>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">🎴 {player.deckName}</span>
          </div>
          <div className="match-last-action" aria-live="polite"><span>ÚLTIMA AÇÃO</span><p>{state.log.at(-1) ?? "A batalha está pronta."}</p></div>
          <TargetingHud mode={targetingMode} onCancel={cancelTargeting} />
          {reaction && <ReactionStack reaction={reaction} timeLeft={timeLeft} targetName={reactionTargetName} onResolve={() => finishReaction()} />}
          {isPlayerBlocking && aiAttackers.length > 0 && (
            <div className="combat-lanes" data-combat-side="defense">
              {aiAttackers.map((attacker) => {
                const blockerId = lockedAttackers.includes(attacker.instanceId) ? lockedBlocks[attacker.instanceId] : (blockAssignments[attacker.instanceId] ?? lockedBlocks[attacker.instanceId]);
                const blocker = player.bench.find((unit) => unit.instanceId === blockerId);
                const isLocked = lockedAttackers.includes(attacker.instanceId);
                return <CombatLane key={attacker.instanceId} attacker={attacker} blocker={blocker} state={state} locked={isLocked} attackerClassName={unitFxClass(attacker)} onAttackerClick={isLocked ? undefined : () => handleUnitClick(attacker)} />;
              })}
            </div>
          )}
          {!isPlayerBlocking && playerAttackers.length > 0 && (
            <div className="combat-lanes" data-combat-side="attack">
              {playerAttackers.map((attacker) => {
                const blockerId = state.combat?.blocks[attacker.instanceId];
                const blocker = ai.bench.find((unit) => unit.instanceId === blockerId);
                return <CombatLane key={attacker.instanceId} attacker={attacker} blocker={blocker} state={state} attackerClassName={unitFxClass(attacker)} />;
              })}
            </div>
          )}
        </div>

        <Row label="SEU CAMPO" side="player">
          {player.bench.length === 0 && player.permanents.length === 0 && <EmptyHint text="Jogue unidades ou permanentes" />}
          {player.permanents.map((permanent) => {
            const clickable = (!!pendingSpell && isValidSpellTarget("player", { kind: "permanent" })) || !!(reaction && pendingReaction && reactionTargetOk("player", { kind: "permanent" }));
            return <CardTip key={permanent.instanceId} defId={permanent.defId} unit={permanentAsUnit(permanent)} state={state} size="sm" targetable={clickable} onClick={clickable ? () => handlePermanentClick(permanent) : undefined} />;
          })}
          {player.sentinelas.map((sentinela) => <SentinelaView key={sentinela.instanceId} instance={sentinela} state={state} size="md" onActivate={(index) => handleSentinelaActivate(sentinela.instanceId, index)} />)}
          {player.bench.map((unit) => {
            const selectable = (!!pendingSpell && isValidSpellTarget("player")) || (reaction && !!pendingReaction && reactionTargetOk("player")) || (isPlayerMain && canAttackNow) || isPlayerBlocking;
            return (
              <CardTip key={unit.instanceId} defId={unit.defId} unit={unit} state={state} size="sm" className={unitFxClass(unit)}
                selected={selectedAttackers.includes(unit.instanceId) || selectedBlocker === unit.instanceId || Object.values(blockAssignments).includes(unit.instanceId) || Object.values(lockedBlocks).includes(unit.instanceId)}
                targetable={(!!pendingSpell && isValidSpellTarget("player")) || !!(reaction && pendingReaction && reactionTargetOk("player"))}
                onClick={selectable ? () => handleUnitClick(unit) : undefined} />
            );
          })}
        </Row>

        <div className="tcg-divider" aria-hidden="true" />
        <PlayerBar player={player} active={state.activePlayer === "player"} hasToken={state.attackToken === "player"} flash={nexusFlash.player} />
        <PlayerHand state={state} reaction={reaction} pendingSpell={pendingSpell} pendingReaction={pendingReaction} isPlayerMain={isPlayerMain} expanded={handExpanded} onToggle={() => setHandExpanded((value) => !value)} onCardClick={handleHandClick} />

        <div className="tcg-actions flex flex-wrap items-center justify-center gap-3 border-t border-white/10 px-3 py-3">
          <AttackForecast state={state} selectedIds={selectedAttackers} />
          {isPlayerBlocking && <CombatOutcomePreview state={state} blocks={{ ...lockedBlocks, ...blockAssignments }} />}
          {gameover ? <span className="text-sm font-semibold text-amber-200">Partida concluída</span>
            : pendingSpell ? <button onClick={() => setPendingSpell(null)} className="btn-ghost">✖ Cancelar feitiço</button>
              : isPlayerBlocking ? <button onClick={confirmBlocks} className="btn-primary">✅ Confirmar bloqueios</button>
                : isPlayerMain ? <>{canAttackNow && selectedAttackers.length > 0 && <button onClick={confirmAttack} className="btn-attack">⚔️ Atacar com {selectedAttackers.length}</button>}<button onClick={endMyTurn} className="btn-primary">⏭️ Encerrar turno</button></>
                  : <span className="text-sm text-slate-400">Aguardando o adversário…</span>}
        </div>

        <details className="tcg-log bg-slate-950/80 px-4 py-2 text-xs text-slate-300">
          <summary className="cursor-pointer select-none font-semibold text-slate-200">Registro da batalha</summary>
          <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto">{[...state.log].slice(-30).reverse().map((line, index) => <li key={index} className="opacity-80">• {line}</li>)}</ul>
        </details>
      </div>

      {gameover && <MatchResult state={state} reward={matchReward} onReplay={replay} onChangeDeck={changeDeck} />}
      {fx.map((event) => event.pos && <div key={event.key} className={["fx-pop", `fx-pop-${event.type}`].join(" ")} data-fx-event={event.type} style={{ left: event.pos.x, top: event.pos.y, color: event.color }}>{event.text}</div>)}
      {levelBanner && <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"><div className="level-banner rounded-2xl border-2 border-amber-400 bg-black/85 px-10 py-5 text-center"><div className="text-4xl">✨</div><div className="level-banner-text mt-1 text-2xl font-black">{levelBanner} EVOLUIU!</div></div></div>}
      {aiToast && <div className="pointer-events-none fixed inset-x-0 top-28 z-50 flex justify-center"><div className="rounded-full bg-violet-950/90 px-4 py-2 text-sm font-bold text-violet-100 ring-1 ring-violet-400/60">{aiToast}</div></div>}
      {firstInfo && state.round === 1 && !gameover && <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center"><div className="pointer-events-auto rounded-full bg-black/70 px-4 py-2 text-xs font-semibold text-amber-200 ring-1 ring-amber-400/40">{firstInfo}</div></div>}

      <FirstMatchGuide open={guideOpen && !gameover} onClose={() => setGuideOpen(false)} />
      <TutorialChecklist state={state} open={trainingOpen} onClose={() => setTrainingOpen(false)} />
      <PlayerJourney state={state} />
      <GameSettings
        open={settingsOpen} soundOn={soundOn} musicOn={musicOn} volume={masterVolume} fxMode={fxMode} uiScale={uiScale} combatPace={combatPace} performanceTier={performanceTier}
        onClose={() => setSettingsOpen(false)}
        onSound={(value) => { setSoundOn(value); void import("@/lib/sounds").then(({ setSoundEnabled }) => setSoundEnabled(value)); }}
        onMusic={(value) => { setMusicOn(value); void import("@/lib/sounds").then(({ setMusicEnabled }) => setMusicEnabled(value)); }}
        onVolume={(value) => { setMasterVolumeState(value); void import("@/lib/sounds").then(({ setMasterVolume }) => setMasterVolume(value)); }}
        onFxMode={(value) => { setFxMode(value); localStorage.setItem("runeforge_fx_mode", value); }}
        onUiScale={(value) => { setUiScale(value); localStorage.setItem("runeforge_ui_scale", value); }}
        onCombatPace={(value) => { setCombatPace(value); localStorage.setItem("runeforge_combat_pace", value); }}
      />
      <button onClick={() => setGuideOpen(true)} className="match-help-button" title="Abrir guia rápido da partida" aria-label="Abrir guia rápido da partida" aria-keyshortcuts="?">?</button>
      <button onClick={() => { setSettingsOpen(true); setAiToast(null); }} className="match-settings-button" title="Configurar som e interface" aria-label="Abrir configurações da partida"><span>{soundOn ? "⚙" : "🔇"}</span></button>
    </div>
  );
}
