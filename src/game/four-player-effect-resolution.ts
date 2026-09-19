import {
  applyFourPlayerBattlefieldDamage,
  applyFourPlayerPermanentDamage,
  createFourPlayerBattlefieldState,
  findFourPlayerBattlefieldObject,
  putFourPlayerBattlefieldObject,
  type FourPlayerBattlefieldObject,
  type FourPlayerBattlefieldState,
} from "./four-player-battlefield";
import { createFourPlayerCombatBodySnapshot } from "./four-player-combat-body";
import { getCard } from "./cards";
import type { FourPlayerCombatDestroyedObject } from "./four-player-combat-resolution";
import type { FourPlayerSeat } from "./four-player-general";
import { moveGeneralFromBattlefield, returnGeneralToZone } from "./four-player-general-zone";
import {
  FOUR_PLAYER_POISON_LETHAL,
  FOUR_PLAYER_STARTING_LIFE,
  applyFourPlayerDamage,
  eliminateFourPlayerMatchSeat,
  type FourPlayerMatchState,
  updateMatchGeneral,
} from "./four-player-match";
import {
  assertFourPlayerTargetObject,
  assertFourPlayerTargetPlayer,
  type FourPlayerTargetRef,
} from "./four-player-targeting";
import type { CardEffect } from "./types";
import { FOUR_PLAYER_RESOLVER_EFFECT_KINDS } from "./four-player-spell-contract";

export const FOUR_PLAYER_SUPPORTED_EFFECT_KINDS = FOUR_PLAYER_RESOLVER_EFFECT_KINDS;

export type FourPlayerSupportedEffectKind = (typeof FOUR_PLAYER_SUPPORTED_EFFECT_KINDS)[number];

export interface FourPlayerEffectResolutionContext {
  tokenNamespace?: string;
}

export type FourPlayerEffectZoneAction =
  | { kind: "draw"; seat: FourPlayerSeat; amount: number }
  | { kind: "mill"; seat: FourPlayerSeat; amount: number }
  | { kind: "return_to_hand"; card: { instanceId: string; defId: string; ownerSeat: FourPlayerSeat } };

export interface FourPlayerEffectResolutionResult {
  match: FourPlayerMatchState;
  destroyed: readonly FourPlayerCombatDestroyedObject[];
  draws: Partial<Record<FourPlayerSeat, number>>;
  zoneActions?: readonly FourPlayerEffectZoneAction[];
}

interface FourPlayerEffectRuntime {
  tokenNamespace: string;
  tokenOrdinal: number;
}

function destinationFor(object: FourPlayerBattlefieldObject): FourPlayerCombatDestroyedObject["destination"] {
  if (object.kind === "general") return "general_zone";
  if (object.kind === "token") return "none";
  return "graveyard";
}

function cleanupDestroyed(match: FourPlayerMatchState): FourPlayerEffectResolutionResult {
  const battlefield = match.battlefield ?? createFourPlayerBattlefieldState();
  const dead = battlefield.objects.filter((object) =>
    Boolean((object.combat && object.combat.health <= 0) || (object.durability && object.durability.health <= 0)),
  );
  if (dead.length === 0) return { match, destroyed: [], draws: {} };

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
  return { match: next, destroyed, draws: {} };
}

function replaceObject(
  state: FourPlayerBattlefieldState,
  objectId: string,
  update: (object: FourPlayerBattlefieldObject) => FourPlayerBattlefieldObject,
): FourPlayerBattlefieldState {
  const current = findFourPlayerBattlefieldObject(state, objectId);
  return { objects: state.objects.map((object) => object.id === current.id ? update(object) : object) };
}

function matchesEffectRace(object: FourPlayerBattlefieldObject, effect: CardEffect): boolean {
  const races = effect.races ?? (effect.race ? [effect.race] : undefined);
  if (!races?.length) return true;
  return Boolean(object.combat?.races.some((race) => races.includes(race)));
}

function matchesEffectClass(object: FourPlayerBattlefieldObject, effect: CardEffect): boolean {
  const classes = effect.classKeys ?? (effect.classKey ? [effect.classKey] : undefined);
  if (!classes?.length) return true;
  return Boolean(object.combat?.classes.some((classKey) => classes.includes(classKey)));
}

function buffCombatObject(object: FourPlayerBattlefieldObject, effect: CardEffect): FourPlayerBattlefieldObject {
  if (!object.combat) return object;
  const powerDelta = effect.buffPower ?? 0;
  const healthDelta = effect.buffHealth ?? 0;
  if (!Number.isFinite(powerDelta) || !Number.isFinite(healthDelta)) {
    throw new Error(`4P ${effect.kind} requires finite stat deltas.`);
  }
  const maxHealth = Math.max(0, object.combat.maxHealth + healthDelta);
  const health = healthDelta >= 0
    ? Math.min(maxHealth, object.combat.health + healthDelta)
    : Math.min(object.combat.health, maxHealth);
  return {
    ...object,
    combat: {
      ...object.combat,
      power: Math.max(0, object.combat.power + powerDelta),
      maxHealth,
      health,
    },
  };
}

function addKeyword(object: FourPlayerBattlefieldObject, keyword: NonNullable<CardEffect["keyword"]>): FourPlayerBattlefieldObject {
  const keywords = object.keywords.includes(keyword) ? object.keywords : [...object.keywords, keyword];
  return {
    ...object,
    keywords,
    ...(keyword === "Barrier" && object.combat ? { combat: { ...object.combat, barrier: true } } : {}),
  };
}

function applyPoison(match: FourPlayerMatchState, seat: FourPlayerSeat, amount: number): FourPlayerMatchState {
  if (match.seats[seat].eliminated) throw new Error(`Eliminated seat ${seat} cannot receive poison.`);
  const poisonCounters = match.seats[seat].poisonCounters + Math.max(1, amount);
  let next: FourPlayerMatchState = {
    ...match,
    seats: {
      ...match.seats,
      [seat]: { ...match.seats[seat], poisonCounters },
    },
  };
  if (poisonCounters >= FOUR_PLAYER_POISON_LETHAL) next = eliminateFourPlayerMatchSeat(next, seat);
  return next;
}

function resolveSingle(
  match: FourPlayerMatchState,
  actor: FourPlayerSeat,
  effect: CardEffect,
  target: FourPlayerTargetRef | undefined,
  fallbackOpponent: FourPlayerSeat | undefined,
  runtime: FourPlayerEffectRuntime,
): { result: FourPlayerEffectResolutionResult; fallbackOpponent?: FourPlayerSeat } {
  if (!(FOUR_PLAYER_SUPPORTED_EFFECT_KINDS as readonly string[]).includes(effect.kind)) {
    throw new Error(`4P effect ${effect.kind} is not supported by authoritative effect resolution yet.`);
  }

  if (!Number.isFinite(effect.amount) || effect.amount < 0) {
    throw new Error(`4P effect ${effect.kind} amount must be a non-negative finite number.`);
  }

  if (effect.kind === "draw") {
    if (!Number.isInteger(effect.amount)) throw new Error("4P draw amount must be a non-negative integer.");
    return {
      result: {
        match,
        destroyed: [],
        draws: effect.amount > 0 ? { [actor]: effect.amount } : {},
        ...(effect.amount > 0 ? { zoneActions: [{ kind: "draw" as const, seat: actor, amount: effect.amount }] } : {}),
      },
      fallbackOpponent,
    };
  }

  if (effect.kind === "mill") {
    if (!Number.isInteger(effect.amount)) throw new Error("4P mill amount must be a non-negative integer.");
    const seat = target?.kind === "player"
      ? assertFourPlayerTargetPlayer(match, actor, target, "opponent")
      : fallbackOpponent;
    if (!seat) throw new Error("4P mill requires an explicit opponent target.");
    return {
      result: {
        match,
        destroyed: [],
        draws: {},
        ...(effect.amount > 0 ? { zoneActions: [{ kind: "mill" as const, seat, amount: effect.amount }] } : {}),
      },
      fallbackOpponent: seat,
    };
  }

  if (effect.kind === "summonToken") {
    if (effect.target !== "none") throw new Error("4P summonToken does not accept an explicit target.");
    if (!Number.isInteger(effect.amount) || effect.amount < 1) throw new Error("4P summonToken amount must be a positive integer.");
    const tokenDefId = String(effect.tokenDefId || "").trim();
    if (!tokenDefId) throw new Error("4P summonToken requires an authoritative tokenDefId.");
    const definition = getCard(tokenDefId);
    if (definition.type !== "Unit") throw new Error(`4P token ${tokenDefId} must resolve to a Unit definition.`);
    const combat = createFourPlayerCombatBodySnapshot(definition);
    if (!combat) throw new Error(`4P token ${tokenDefId} has no combat body.`);
    let battlefield = match.battlefield ?? createFourPlayerBattlefieldState();
    for (let index = 0; index < effect.amount; index += 1) {
      runtime.tokenOrdinal += 1;
      let tokenId = `token:${actor}:${runtime.tokenNamespace}:${runtime.tokenOrdinal}`;
      while (battlefield.objects.some((object) => object.id === tokenId)) {
        runtime.tokenOrdinal += 1;
        tokenId = `token:${actor}:${runtime.tokenNamespace}:${runtime.tokenOrdinal}`;
      }
      battlefield = putFourPlayerBattlefieldObject(battlefield, {
        id: tokenId,
        defId: definition.defId,
        kind: "token",
        ownerSeat: actor,
        controllerSeat: actor,
        enteredTurn: match.turn.turn,
        keywords: definition.keywords ?? [],
        combat,
      });
    }
    return {
      result: { match: { ...match, battlefield }, destroyed: [], draws: {} },
      fallbackOpponent,
    };
  }

  if (effect.kind === "damageNexus") {
    const seat = target?.kind === "player"
      ? assertFourPlayerTargetPlayer(match, actor, target, "opponent")
      : fallbackOpponent;
    if (!seat) throw new Error("4P damageNexus requires an explicit opponent target.");
    return { result: { match: applyFourPlayerDamage(match, seat, effect.amount), destroyed: [], draws: {} }, fallbackOpponent: seat };
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
        draws: {},
      },
      fallbackOpponent,
    };
  }

  if (effect.kind === "poison") {
    const seat = target?.kind === "player"
      ? assertFourPlayerTargetPlayer(match, actor, target, "opponent")
      : fallbackOpponent;
    if (!seat) throw new Error("4P poison requires an explicit opponent target.");
    return { result: { match: applyPoison(match, seat, effect.amount), destroyed: [], draws: {} }, fallbackOpponent: seat };
  }

  if (effect.kind === "manaRefund") {
    const current = match.seats[actor];
    if (current.eliminated) throw new Error(`Eliminated seat ${actor} cannot receive mana.`);
    const mana = Math.min(current.maxMana, current.mana + effect.amount);
    return {
      result: { match: { ...match, seats: { ...match.seats, [actor]: { ...current, mana } } }, destroyed: [], draws: {} },
      fallbackOpponent,
    };
  }

  if (effect.kind === "buffAllies" || effect.kind === "buffRace" || effect.kind === "buffClass") {
    if (effect.target !== "none") throw new Error(`4P ${effect.kind} must use target none.`);
    const battlefield = match.battlefield ?? createFourPlayerBattlefieldState();
    const objects = battlefield.objects.map((object) => {
      if (object.controllerSeat !== actor || !object.combat || object.combat.health <= 0) return object;
      if ((effect.kind === "buffAllies" || effect.kind === "buffRace") && !matchesEffectRace(object, effect)) return object;
      if (effect.kind === "buffClass" && !matchesEffectClass(object, effect)) return object;
      return buffCombatObject(object, effect);
    });
    return { result: { match: { ...match, battlefield: { objects } }, destroyed: [], draws: {} }, fallbackOpponent };
  }

  if (effect.kind === "aoeEnemy") {
    let battlefield = match.battlefield ?? createFourPlayerBattlefieldState();
    const targetIds = battlefield.objects
      .filter((object) => object.controllerSeat !== actor && !match.seats[object.controllerSeat].eliminated && object.combat && object.combat.health > 0)
      .map((object) => object.id);
    for (const objectId of targetIds) {
      battlefield = applyFourPlayerBattlefieldDamage(battlefield, objectId, effect.amount).state;
    }
    const cleaned = cleanupDestroyed({ ...match, battlefield });
    return { result: cleaned, fallbackOpponent };
  }

  if ((effect.kind === "grantBarrier" || effect.kind === "grantKeyword") && effect.target === "none") {
    if (effect.kind === "grantKeyword" && !effect.keyword) throw new Error("4P grantKeyword requires an authoritative keyword.");
    const battlefield = match.battlefield ?? createFourPlayerBattlefieldState();
    const objects = battlefield.objects.map((object) => {
      if (object.controllerSeat !== actor || !object.combat || object.combat.health <= 0 || !matchesEffectRace(object, effect)) return object;
      return effect.kind === "grantBarrier"
        ? addKeyword(object, "Barrier")
        : addKeyword(object, effect.keyword!);
    });
    return { result: { match: { ...match, battlefield: { objects } }, destroyed: [], draws: {} }, fallbackOpponent };
  }

  const object = assertFourPlayerTargetObject(match, actor, target, effect.target);
  const inferredOpponent = object.controllerSeat !== actor ? object.controllerSeat : fallbackOpponent;
  let battlefield = match.battlefield ?? createFourPlayerBattlefieldState();

  if (effect.kind === "recall") {
    let next: FourPlayerMatchState = {
      ...match,
      battlefield: { objects: battlefield.objects.filter((candidate) => candidate.id !== object.id) },
    };
    if (object.kind === "general") {
      const general = next.generals[object.ownerSeat];
      if (general.location === "battlefield") next = updateMatchGeneral(next, object.ownerSeat, returnGeneralToZone(general));
      return { result: { match: next, destroyed: [], draws: {} }, fallbackOpponent: inferredOpponent };
    }
    if (object.kind === "token") {
      return { result: { match: next, destroyed: [], draws: {} }, fallbackOpponent: inferredOpponent };
    }
    return {
      result: {
        match: next,
        destroyed: [],
        draws: {},
        zoneActions: [{ kind: "return_to_hand", card: { instanceId: object.id, defId: object.defId, ownerSeat: object.ownerSeat } }],
      },
      fallbackOpponent: inferredOpponent,
    };
  }

  switch (effect.kind) {
    case "damageUnit": {
      battlefield = applyFourPlayerBattlefieldDamage(battlefield, object.id, effect.amount).state;
      break;
    }
    case "damagePermanent": {
      battlefield = applyFourPlayerPermanentDamage(battlefield, object.id, effect.amount).state;
      break;
    }
    case "destroyPermanent": {
      if (!object.durability) throw new Error(`Target ${object.id} has no permanent durability.`);
      battlefield = applyFourPlayerPermanentDamage(battlefield, object.id, object.durability.health).state;
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
    case "buffUnit": {
      if (!object.combat) throw new Error(`Target ${object.id} has no combat body.`);
      battlefield = replaceObject(battlefield, object.id, (current) => buffCombatObject(current, effect));
      break;
    }
    case "grantBarrier": {
      if (!object.combat) throw new Error(`Target ${object.id} has no combat body.`);
      battlefield = replaceObject(battlefield, object.id, (current) => addKeyword(current, "Barrier"));
      break;
    }
    case "grantKeyword": {
      if (!effect.keyword) throw new Error("4P grantKeyword requires an authoritative keyword.");
      if (!object.combat) throw new Error(`Target ${object.id} has no combat body.`);
      battlefield = replaceObject(battlefield, object.id, (current) => addKeyword(current, effect.keyword!));
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
  context: FourPlayerEffectResolutionContext = {},
): FourPlayerEffectResolutionResult {
  let current = match;
  let cursor: CardEffect | undefined = effect;
  let first = true;
  let fallbackOpponent: FourPlayerSeat | undefined;
  const destroyed: FourPlayerCombatDestroyedObject[] = [];
  const draws: Partial<Record<FourPlayerSeat, number>> = {};
  const zoneActions: FourPlayerEffectZoneAction[] = [];
  const namespace = String(context.tokenNamespace || `preview:${actor}:${match.turn.turn}`).trim() || `preview:${actor}:${match.turn.turn}`;
  const runtime: FourPlayerEffectRuntime = { tokenNamespace: namespace, tokenOrdinal: 0 };

  for (let guard = 0; cursor && guard < 32; guard += 1) {
    const resolved = resolveSingle(current, actor, cursor, first ? target : undefined, fallbackOpponent, runtime);
    current = resolved.result.match;
    destroyed.push(...resolved.result.destroyed);
    for (const [seat, amount] of Object.entries(resolved.result.draws)) {
      if (!amount) continue;
      const seatKey = seat as FourPlayerSeat;
      draws[seatKey] = (draws[seatKey] ?? 0) + amount;
    }
    zoneActions.push(...(resolved.result.zoneActions ?? []));
    fallbackOpponent = resolved.fallbackOpponent;
    cursor = cursor.also;
    first = false;
  }
  if (cursor) throw new Error("4P effect chain exceeds the maximum supported depth.");
  return { match: current, destroyed, draws, ...(zoneActions.length > 0 ? { zoneActions } : {}) };
}
