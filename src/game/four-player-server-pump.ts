import { resolveFourPlayerActivatedAbility } from "./four-player-activated-abilities";
import { createFourPlayerBattlefieldState, placeResolvedGeneralOnBattlefield } from "./four-player-battlefield";
import { markFourPlayerCombatDeclarationTriggersQueued } from "./four-player-combat";
import { resolveFourPlayerCardCast, resolveFourPlayerSpellCast } from "./four-player-card-play";
import { advanceFourPlayerCombatStep, type FourPlayerCombatDestroyedObject } from "./four-player-combat-resolution";
import type { FourPlayerEffectZoneAction } from "./four-player-effect-resolution";
import { resolveFourPlayerFlow } from "./four-player-flow";
import type { FourPlayerSeat } from "./four-player-general";
import { advanceFourPlayerLevelUps } from "./four-player-level-up";
import { resolveGeneralToBattlefield } from "./four-player-general-zone";
import type { FourPlayerMechanicConditionContext } from "./four-player-mechanic-conditions";
import { addFourPlayerProgress, updateMatchGeneral, type FourPlayerMatchState } from "./four-player-match";
import { advanceFourPlayerPhase } from "./four-player-phase-machine";
import { allLivingPlayersPassed, createFourPlayerPriorityState } from "./four-player-priority-manager";
import type { FourPlayerStackItem } from "./four-player-stack";
import { queueFourPlayerCombatDeclarationTriggers, queueFourPlayerCombatImpactTriggers, queueFourPlayerLevelUpTriggers, queueFourPlayerRoundStartTriggers, queueFourPlayerTransitionTriggers, resolveFourPlayerTriggeredAbility } from "./four-player-triggers";

export interface FourPlayerServerPumpResult {
  match: FourPlayerMatchState;
  resolved: readonly FourPlayerStackItem[];
  awaitingClientInput: boolean;
  phaseAdvanced: boolean;
  turnAdvanced: boolean;
  combatResolved?: boolean;
  destroyedObjects?: readonly FourPlayerCombatDestroyedObject[];
  drawRequests?: Partial<Record<FourPlayerSeat, number>>;
  counteredStackItems?: readonly FourPlayerStackItem[];
  zoneActions?: readonly FourPlayerEffectZoneAction[];
}

function applyResolvedStackItem(
  match: FourPlayerMatchState,
  item: FourPlayerStackItem,
): {
  match: FourPlayerMatchState;
  destroyedObjects: readonly FourPlayerCombatDestroyedObject[];
  drawRequests: Partial<Record<FourPlayerSeat, number>>;
  counteredStackItems: readonly FourPlayerStackItem[];
  zoneActions: readonly FourPlayerEffectZoneAction[];
} {
  if (item.kind === "card_cast") {
    const resolved = resolveFourPlayerCardCast(match, item);
    return { match: resolved.match, destroyedObjects: [], drawRequests: {}, counteredStackItems: [], zoneActions: resolved.zoneActions };
  }
  if (item.kind === "spell_cast") {
    const resolved = resolveFourPlayerSpellCast(match, item);
    return { match: resolved.match, destroyedObjects: resolved.destroyed, drawRequests: resolved.draws, counteredStackItems: resolved.countered, zoneActions: resolved.zoneActions ?? [] };
  }
  if (item.kind === "ability_activation") {
    const resolved = resolveFourPlayerActivatedAbility(match, item);
    return { match: resolved.match, destroyedObjects: resolved.destroyed, drawRequests: resolved.draws, counteredStackItems: resolved.countered, zoneActions: resolved.zoneActions ?? [] };
  }
  if (item.kind === "triggered_ability") {
    const resolved = resolveFourPlayerTriggeredAbility(match, item);
    return { match: resolved.match, destroyedObjects: resolved.destroyed, drawRequests: resolved.draws, counteredStackItems: [], zoneActions: resolved.zoneActions ?? [] };
  }
  if (item.kind !== "general_cast") return { match, destroyedObjects: [], drawRequests: {}, counteredStackItems: [], zoneActions: [] };
  const general = match.generals[item.controller];
  if (general.location !== "stack") throw new Error(`Resolved General for ${item.controller} is not on the General stack.`);
  const payload = item.payload as { owner?: string; defId?: string };
  if (payload.owner !== item.controller || payload.defId !== general.defId) {
    throw new Error("Resolved General stack identity does not match authoritative General state.");
  }
  const resolvedGeneral = resolveGeneralToBattlefield(general);
  const withGeneral = updateMatchGeneral(match, item.controller, resolvedGeneral);
  const enteredGeneral: FourPlayerMatchState = {
    ...withGeneral,
    battlefield: placeResolvedGeneralOnBattlefield(
      withGeneral.battlefield ?? createFourPlayerBattlefieldState(),
      item.controller,
      resolvedGeneral.defId,
      resolvedGeneral.castsFromGeneralZone,
      withGeneral.turn.turn,
      withGeneral.generalKeywords?.[item.controller] ?? [],
      withGeneral.generalCombatBodies?.[item.controller],
    ),
  };
  return {
    match: addFourPlayerProgress(enteredGeneral, item.controller, { alliesSummoned: 1 }),
    destroyedObjects: [],
    drawRequests: {},
    counteredStackItems: [],
    zoneActions: [],
  };
}

function convergeFourPlayerLevelUps(
  match: FourPlayerMatchState,
  eventKey: string,
  conditionContext?: FourPlayerMechanicConditionContext,
): { match: FourPlayerMatchState; queued: number } {
  const advanced = advanceFourPlayerLevelUps(match);
  if (advanced.leveled.length === 0) return { match, queued: 0 };
  const triggered = queueFourPlayerLevelUpTriggers(advanced.match, advanced.leveled, eventKey, conditionContext);
  return { match: triggered.match, queued: triggered.queued.length };
}

/**
 * Applies one deterministic internal transition that requires no client choice.
 * A complete pass cycle resolves exactly one LIFO stack object when the stack is
 * non-empty. With an empty stack, the same pass cycle advances exactly one phase;
 * ending advances to the next living player's beginning. Priority then reopens
 * with the active living seat, so the pump never skips multiple phases at once.
 */
export function pumpFourPlayerServer(
  match: FourPlayerMatchState,
  conditionContext?: FourPlayerMechanicConditionContext,
): FourPlayerServerPumpResult {
  if (match.status === "completed") {
    return { match, resolved: [], awaitingClientInput: false, phaseAdvanced: false, turnAdvanced: false };
  }
  if (!allLivingPlayersPassed(match.resolution.priority)) {
    return { match, resolved: [], awaitingClientInput: true, phaseAdvanced: false, turnAdvanced: false };
  }
  if (match.resolution.stack.items.length === 0) {
    if (match.phase === "combat") {
      let combatReady = match;
      if (!match.combat.declarationTriggersQueued) {
        const queuedDeclarations = queueFourPlayerCombatDeclarationTriggers(
          match,
          `combat-declarations:${match.turn.turn}:${match.combat.attackers.length}:${match.combat.blockers.length}`,
          conditionContext,
        );
        combatReady = {
          ...queuedDeclarations.match,
          combat: markFourPlayerCombatDeclarationTriggersQueued(queuedDeclarations.match.combat),
        };
        if (queuedDeclarations.queued.length > 0) {
          return {
            match: combatReady,
            resolved: [],
            awaitingClientInput: true,
            phaseAdvanced: false,
            turnAdvanced: false,
            combatResolved: false,
          };
        }
      }
      let stepping = combatReady;
      for (let combatGuard = 0; combatGuard < 128; combatGuard += 1) {
        const combat = advanceFourPlayerCombatStep(stepping);
        stepping = combat.match;

        if (combat.impacts.length > 0) {
          const impactTriggers = queueFourPlayerCombatImpactTriggers(
            stepping,
            combat.impacts,
            `combat-impact:${stepping.turn.turn}:${combatGuard}`,
            conditionContext,
          );
          stepping = impactTriggers.match;
          if (impactTriggers.queued.length > 0) {
            return {
              match: stepping,
              resolved: [],
              awaitingClientInput: true,
              phaseAdvanced: false,
              turnAdvanced: false,
              combatResolved: false,
            };
          }
        }

        if (!combat.completed) continue;
        if (stepping.status === "completed") {
          return {
            match: stepping,
            resolved: [],
            awaitingClientInput: false,
            phaseAdvanced: false,
            turnAdvanced: false,
            combatResolved: true,
            destroyedObjects: combat.destroyed,
            ...(combat.zoneActions.length > 0 ? { zoneActions: combat.zoneActions } : {}),
          };
        }
        const triggered = queueFourPlayerTransitionTriggers(
          combat.triggerSourceMatch ?? combatReady,
          stepping,
          combat.destroyed,
          `combat:${combatReady.turn.turn}`,
          conditionContext,
        );
        if (triggered.queued.length > 0) {
          return {
            match: triggered.match,
            resolved: [],
            awaitingClientInput: true,
            phaseAdvanced: false,
            turnAdvanced: false,
            combatResolved: true,
            destroyedObjects: combat.destroyed,
            ...(combat.zoneActions.length > 0 ? { zoneActions: combat.zoneActions } : {}),
          };
        }
        const leveled = convergeFourPlayerLevelUps(
          triggered.match,
          `level-up:combat:${combatReady.turn.turn}`,
          conditionContext,
        );
        if (leveled.queued > 0) {
          return {
            match: leveled.match,
            resolved: [],
            awaitingClientInput: true,
            phaseAdvanced: false,
            turnAdvanced: false,
            combatResolved: true,
            destroyedObjects: combat.destroyed,
            ...(combat.zoneActions.length > 0 ? { zoneActions: combat.zoneActions } : {}),
          };
        }
        const advanced = advanceFourPlayerPhase(leveled.match);
        return {
          match: advanced.match,
          resolved: [],
          awaitingClientInput: true,
          phaseAdvanced: true,
          turnAdvanced: advanced.turnAdvanced,
          combatResolved: true,
          destroyedObjects: combat.destroyed,
          ...(combat.zoneActions.length > 0 ? { zoneActions: combat.zoneActions } : {}),
        };
      }
      throw new Error("4P server combat pump exceeded its deterministic safety boundary.");
    }
    const advanced = advanceFourPlayerPhase(match);
    const roundStarted = advanced.turnAdvanced && advanced.match.turn.round > match.turn.round
      ? queueFourPlayerRoundStartTriggers(advanced.match, `round:${advanced.match.turn.round}`, conditionContext)
      : { match: advanced.match, queued: [] };
    return {
      match: roundStarted.match,
      resolved: [],
      awaitingClientInput: true,
      phaseAdvanced: true,
      turnAdvanced: advanced.turnAdvanced,
    };
  }

  const result = resolveFourPlayerFlow(match.resolution);
  if (!result.resolved) {
    return { match, resolved: [], awaitingClientInput: true, phaseAdvanced: false, turnAdvanced: false };
  }
  const priority = createFourPlayerPriorityState(
    match.turn.activeSeat,
    result.flow.priority.eliminatedSeats,
    result.flow.priority.mode,
  );
  let nextMatch: FourPlayerMatchState = { ...match, resolution: { ...result.flow, priority } };
  const beforeResolution = nextMatch;
  const applied = applyResolvedStackItem(nextMatch, result.resolved);
  const triggered = queueFourPlayerTransitionTriggers(
    beforeResolution,
    applied.match,
    applied.destroyedObjects,
    `resolve:${result.resolved.id}`,
    conditionContext,
  );
  nextMatch = triggered.match;
  if (triggered.queued.length === 0 && nextMatch.phase !== "combat") {
    nextMatch = convergeFourPlayerLevelUps(
      nextMatch,
      `level-up:resolve:${result.resolved.id}`,
      conditionContext,
    ).match;
  }
  return {
    match: nextMatch,
    resolved: [result.resolved],
    awaitingClientInput: true,
    phaseAdvanced: false,
    turnAdvanced: false,
    ...(applied.destroyedObjects.length > 0 ? { destroyedObjects: applied.destroyedObjects } : {}),
    ...(Object.keys(applied.drawRequests).length > 0 ? { drawRequests: applied.drawRequests } : {}),
    ...(applied.counteredStackItems.length > 0 ? { counteredStackItems: applied.counteredStackItems } : {}),
    ...(applied.zoneActions.length > 0 ? { zoneActions: applied.zoneActions } : {}),
  };
}