import { resolveFourPlayerActivatedAbility } from "./four-player-activated-abilities";
import { createFourPlayerBattlefieldState, placeResolvedGeneralOnBattlefield } from "./four-player-battlefield";
import { resolveFourPlayerCardCast, resolveFourPlayerSpellCast } from "./four-player-card-play";
import { resolveFourPlayerCombat, type FourPlayerCombatDestroyedObject } from "./four-player-combat-resolution";
import type { FourPlayerEffectZoneAction } from "./four-player-effect-resolution";
import { resolveFourPlayerFlow } from "./four-player-flow";
import type { FourPlayerSeat } from "./four-player-general";
import { resolveGeneralToBattlefield } from "./four-player-general-zone";
import { updateMatchGeneral, type FourPlayerMatchState } from "./four-player-match";
import { advanceFourPlayerPhase } from "./four-player-phase-machine";
import { allLivingPlayersPassed, createFourPlayerPriorityState } from "./four-player-priority-manager";
import type { FourPlayerStackItem } from "./four-player-stack";
import { queueFourPlayerRoundStartTriggers, queueFourPlayerTransitionTriggers, resolveFourPlayerTriggeredAbility } from "./four-player-triggers";

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
  return { match: {
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
  }, destroyedObjects: [], drawRequests: {}, counteredStackItems: [], zoneActions: [] };
}

/**
 * Applies one deterministic internal transition that requires no client choice.
 * A complete pass cycle resolves exactly one LIFO stack object when the stack is
 * non-empty. With an empty stack, the same pass cycle advances exactly one phase;
 * ending advances to the next living player's beginning. Priority then reopens
 * with the active living seat, so the pump never skips multiple phases at once.
 */
export function pumpFourPlayerServer(match: FourPlayerMatchState): FourPlayerServerPumpResult {
  if (match.status === "completed") {
    return { match, resolved: [], awaitingClientInput: false, phaseAdvanced: false, turnAdvanced: false };
  }
  if (!allLivingPlayersPassed(match.resolution.priority)) {
    return { match, resolved: [], awaitingClientInput: true, phaseAdvanced: false, turnAdvanced: false };
  }
  if (match.resolution.stack.items.length === 0) {
    if (match.phase === "combat") {
      const combat = resolveFourPlayerCombat(match);
      if (combat.match.status === "completed") {
        return {
          match: combat.match,
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
        match,
        combat.match,
        combat.destroyed,
        `combat:${match.turn.turn}`,
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
      const advanced = advanceFourPlayerPhase(combat.match);
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
    const advanced = advanceFourPlayerPhase(match);
    const roundStarted = advanced.turnAdvanced && advanced.match.turn.round > match.turn.round
      ? queueFourPlayerRoundStartTriggers(advanced.match, `round:${advanced.match.turn.round}`)
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
  );
  nextMatch = triggered.match;
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