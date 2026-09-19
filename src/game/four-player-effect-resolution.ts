import {
  applyFourPlayerBattlefieldDamage,
  createFourPlayerBattlefieldState,
  findFourPlayerBattlefieldObject,
  type FourPlayerBattlefieldObject,
  type FourPlayerBattlefieldState,
} from "./four-player-battlefield";
import type { FourPlayerCombatDestroyedObject } from "./four-player-combat-resolution";
import type { FourPlayerSeat } from "./four-player-general";
import { moveGeneralFromBattlefield } from "./four-player-general-zone";
import {
  FOUR_PLAYER_STARTING_LIFE,
  applyFourPlayerDamage,
  type FourPlayerMatchState,
  updateMatchGeneral,
} from "./four-player-match";
import {
  assertFourPlayerTargetObject,
  assertFourPlayerTargetPlayer,
  type FourPlayerTargetRef,
} from "./four-player-targeting";
import type { CardEffect } from "./types";

export const FOUR_PLAYER_SUPPORTED_EFFECT_KINDS = [
  "damageUnit",
  "damageNexus",
  "healUnit",
  "healNexus",
  "frostbite",
  "stun",
  "killUnit",
] as const;

export type FourPlayerSupportedEffectKind = (typeof FOUR_PLAYER_SUPPORTED_EFFECT_KINDS)[number];

export interface FourPlayerEffectResolutionResult {
  match: FourPlayerMatchState;
  destroyed: readonly FourPlayerCombatDestroyedObject[];
}

function destinationFor(object: FourPlayerBattlefieldObject): FourPlayerCombatDestroyedObject["destination"] {
  if (object.kind === "general") return "general_zone";
  if (object.kind === "token") return "none";
  return "graveyard";
}

function cleanupDestroyed(match: FourPlayerMatchState): FourPlayerEffectResolutionResult {
  const battlefield = match.battlefield ?? createFourPlayerBattlefieldState();
  const dead = battlefield.objects.filter((object) => object.combat && object.combat.health <= 0);
  if (dead.length === 0) return { match, destroyed: [] };

  const destroyed: FourPlayerCombatDestroyedObject[] = dead.map((object) => ({
    id: object.id,
    defId: object.defId,
    ownerSeat: object.ownerSeat,
    kind: object.kind,
    destination: destinationFor(object),
  }));

  let next: FourPlayerMatchState = {
    ...match,
    battlefield: { objects: battlefield.objects.filter((object) => !dead.some((entry) => entry.id === object.id)) },
  };
  for (const object of dead) {
    if (object.kind !== "general") continue;
    const general = next.generals[object.ownerSeat];
    if (general.location === "battlefield") {
      next = updateMatchGeneral(next, object.ownerSeat, moveGeneralFromBattlefield(general, "graveyard", true));
    }
  }
  return { match: next, destroyed };
}

function replaceObject(
  state: FourPlayerBattlefieldState,
  objectId: string,
  update: (object: FourPlayerBattlefieldObject) => FourPlayerBattlefieldObject,
): FourPlayerBattlefieldState {
  const current = findFourPlayerBattlefieldObject(state, objectId);
  return { objects: state.objects.map((object) => object.id === current.id ? update(object) : object) };
}

function resolveSingle(
  match: FourPlayerMatchState,
  actor: FourPlayerSeat,
  effect: CardEffect,
  target: FourPlayerTargetRef | undefined,
  fallbackOpponent?: FourPlayerSeat,
): { result: FourPlayerEffectResolutionResult; fallbackOpponent?: FourPlayerSeat } {
  if (!(FOUR_PLAYER_SUPPORTED_EFFECT_KINDS as readonly string[]).includes(effect.kind)) {
    throw new Error(`4P effect ${effect.kind} is not supported by authoritative effect resolution yet.`);
  }

  if (!Number.isFinite(effect.amount) || effect.amount < 0) {
    throw new Error(`4P effect ${effect.kind} amount must be a non-negative finite number.`);
  }

  if (effect.kind === "damageNexus") {
    const seat = target?.kind === "player"
      ? assertFourPlayerTargetPlayer(match, actor, target, "opponent")
      : fallbackOpponent;
    if (!seat) throw new Error("4P damageNexus requires an explicit opponent target.");
    return { result: { match: applyFourPlayerDamage(match, seat, effect.amount), destroyed: [] }, fallbackOpponent: seat };
  }

  if (effect.kind === "healNexus") {
    if (target?.kind === "player") assertFourPlayerTargetPlayer(match, actor, target, "self");
    const current = match.seats[actor];
    if (current.eliminated) throw new Error(`Eliminated seat ${actor} cannot be healed.`);
    const life = Math.min(FOUR_PLAYER_STARTING_LIFE, current.life + effect.amount);
    return {
      result: {
        match: { ...match, seats: { ...match.seats, [actor]: { ...current, life } } },
        destroyed: [],
      },
      fallbackOpponent,
    };
  }

  const object = assertFourPlayerTargetObject(match, actor, target, effect.target);
  const inferredOpponent = object.controllerSeat !== actor ? object.controllerSeat : fallbackOpponent;
  let battlefield = match.battlefield ?? createFourPlayerBattlefieldState();

  switch (effect.kind) {
    case "damageUnit": {
      battlefield = applyFourPlayerBattlefieldDamage(battlefield, object.id, effect.amount).state;
      break;
    }
    case "healUnit": {
      if (!object.combat) throw new Error(`Target ${object.id} has no combat body.`);
      battlefield = replaceObject(battlefield, object.id, (current) => ({
        ...current,
        combat: current.combat ? { ...current.combat, health: Math.min(current.combat.maxHealth, current.combat.health + effect.amount) } : current.combat,
      }));
      break;
    }
    case "frostbite": {
      if (!object.combat) throw new Error(`Target ${object.id} has no combat body.`);
      battlefield = replaceObject(battlefield, object.id, (current) => ({
        ...current,
        combat: current.combat ? { ...current.combat, frostbitten: true } : current.combat,
      }));
      break;
    }
    case "stun": {
      battlefield = replaceObject(battlefield, object.id, (current) => ({ ...current, stunned: true }));
      break;
    }
    case "killUnit": {
      if (!object.combat) throw new Error(`Target ${object.id} has no combat body.`);
      battlefield = replaceObject(battlefield, object.id, (current) => ({
        ...current,
        combat: current.combat ? { ...current.combat, health: 0 } : current.combat,
      }));
      break;
    }
  }

  const cleaned = cleanupDestroyed({ ...match, battlefield });
  return { result: cleaned, fallbackOpponent: inferredOpponent };
}

export function resolveFourPlayerEffect(
  match: FourPlayerMatchState,
  actor: FourPlayerSeat,
  effect: CardEffect,
  target?: FourPlayerTargetRef,
): FourPlayerEffectResolutionResult {
  let current = match;
  let cursor: CardEffect | undefined = effect;
  let first = true;
  let fallbackOpponent: FourPlayerSeat | undefined;
  const destroyed: FourPlayerCombatDestroyedObject[] = [];

  for (let guard = 0; cursor && guard < 32; guard += 1) {
    const resolved = resolveSingle(current, actor, cursor, first ? target : undefined, fallbackOpponent);
    current = resolved.result.match;
    destroyed.push(...resolved.result.destroyed);
    fallbackOpponent = resolved.fallbackOpponent;
    cursor = cursor.also;
    first = false;
  }
  if (cursor) throw new Error("4P effect chain exceeds the maximum supported depth.");
  return { match: current, destroyed };
}
