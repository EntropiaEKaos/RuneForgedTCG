import { cloneFourPlayerCombatBody, type FourPlayerCombatBody } from "./four-player-combat-body";
import { cleanupObjectsForEliminatedSeat, type FourPlayerOwnedObject } from "./four-player-elimination";
import type { FourPlayerSeat } from "./four-player-general";
import type { Keyword } from "./types";

export const FOUR_PLAYER_BATTLEFIELD_KINDS = ["unit", "general", "permanent", "sentinela", "token"] as const;
export type FourPlayerBattlefieldKind = (typeof FOUR_PLAYER_BATTLEFIELD_KINDS)[number];

export interface FourPlayerBattlefieldObject {
  id: string;
  defId: string;
  kind: FourPlayerBattlefieldKind;
  ownerSeat: FourPlayerSeat;
  controllerSeat: FourPlayerSeat;
  zone: "battlefield";
  enteredTurn: number;
  keywords: readonly Keyword[];
  combat?: FourPlayerCombatBody;
  stunned: boolean;
  attackedThisTurn: boolean;
}

export interface FourPlayerBattlefieldObjectInput {
  id: string;
  defId: string;
  kind: FourPlayerBattlefieldKind;
  ownerSeat: FourPlayerSeat;
  controllerSeat?: FourPlayerSeat;
  enteredTurn: number;
  keywords?: readonly Keyword[];
  combat?: FourPlayerCombatBody;
  stunned?: boolean;
  attackedThisTurn?: boolean;
}

export interface FourPlayerBattlefieldState {
  objects: readonly FourPlayerBattlefieldObject[];
}

export interface FourPlayerBattlefieldCleanup {
  state: FourPlayerBattlefieldState;
  removedObjectIds: readonly string[];
  returnedToOwnerControlIds: readonly string[];
}

export function createFourPlayerBattlefieldState(): FourPlayerBattlefieldState {
  return { objects: [] };
}

function assertObjectIdentity(input: FourPlayerBattlefieldObjectInput): void {
  if (!String(input.id || "").trim()) throw new Error("4P battlefield object id is required.");
  if (!String(input.defId || "").trim()) throw new Error("4P battlefield defId is required.");
  if (!Number.isInteger(input.enteredTurn) || input.enteredTurn < 0) {
    throw new Error("4P battlefield enteredTurn must be a non-negative integer.");
  }
}

function isCombatBody(kind: FourPlayerBattlefieldKind): boolean {
  return kind === "unit" || kind === "general" || kind === "token";
}

export function putFourPlayerBattlefieldObject(
  state: FourPlayerBattlefieldState,
  input: FourPlayerBattlefieldObjectInput,
): FourPlayerBattlefieldState {
  assertObjectIdentity(input);
  const id = input.id.trim();
  if (state.objects.some((object) => object.id === id)) {
    throw new Error(`4P battlefield object ${id} already exists.`);
  }
  const object: FourPlayerBattlefieldObject = {
    id,
    defId: input.defId.trim(),
    kind: input.kind,
    ownerSeat: input.ownerSeat,
    controllerSeat: input.controllerSeat ?? input.ownerSeat,
    zone: "battlefield",
    enteredTurn: input.enteredTurn,
    keywords: [...(input.keywords ?? [])],
    ...(input.combat ? { combat: cloneFourPlayerCombatBody(input.combat) } : {}),
    stunned: Boolean(input.stunned),
    attackedThisTurn: Boolean(input.attackedThisTurn),
  };
  return { objects: [...state.objects, object] };
}

export function findFourPlayerBattlefieldObject(
  state: FourPlayerBattlefieldState,
  objectId: string,
): FourPlayerBattlefieldObject {
  const id = String(objectId || "").trim();
  const object = state.objects.find((candidate) => candidate.id === id);
  if (!object) throw new Error(`4P battlefield object ${id || "<empty>"} is not present.`);
  return object;
}

export function assertFourPlayerAttackerObject(
  state: FourPlayerBattlefieldState,
  actor: FourPlayerSeat,
  objectId: string,
  currentTurn: number,
): FourPlayerBattlefieldObject {
  const object = findFourPlayerBattlefieldObject(state, objectId);
  if (!isCombatBody(object.kind)) throw new Error(`4P battlefield object ${object.id} cannot attack.`);
  if (object.combat && object.combat.health <= 0) throw new Error(`Destroyed object ${object.id} cannot attack.`);
  if (object.controllerSeat !== actor) throw new Error(`Seat ${actor} does not control attacker ${object.id}.`);
  if (object.stunned) throw new Error(`Stunned object ${object.id} cannot attack.`);
  if (object.attackedThisTurn) throw new Error(`Object ${object.id} has already attacked this turn.`);
  if (object.enteredTurn >= currentTurn && !object.keywords.includes("Haste")) {
    throw new Error(`Object ${object.id} has summoning sickness and cannot attack this turn.`);
  }
  return object;
}

export function assertFourPlayerBlockerObject(
  state: FourPlayerBattlefieldState,
  actor: FourPlayerSeat,
  objectId: string,
): FourPlayerBattlefieldObject {
  const object = findFourPlayerBattlefieldObject(state, objectId);
  if (!isCombatBody(object.kind)) throw new Error(`4P battlefield object ${object.id} cannot block.`);
  if (object.combat && object.combat.health <= 0) throw new Error(`Destroyed object ${object.id} cannot block.`);
  if (object.controllerSeat !== actor) throw new Error(`Seat ${actor} does not control blocker ${object.id}.`);
  if (object.stunned) throw new Error(`Stunned object ${object.id} cannot block.`);
  return object;
}


export interface FourPlayerBattlefieldDamageResult {
  state: FourPlayerBattlefieldState;
  damageDealt: number;
  barrierConsumed: boolean;
  destroyed: boolean;
}

export function applyFourPlayerBattlefieldDamage(
  state: FourPlayerBattlefieldState,
  targetId: string,
  amount: number,
  sourceId?: string,
): FourPlayerBattlefieldDamageResult {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("4P battlefield damage must be a non-negative finite number.");
  const target = findFourPlayerBattlefieldObject(state, targetId);
  if (!target.combat) throw new Error(`4P battlefield object ${target.id} has no combat body.`);
  if (target.combat.health <= 0) throw new Error(`4P battlefield object ${target.id} is already destroyed.`);

  const source = sourceId ? findFourPlayerBattlefieldObject(state, sourceId) : undefined;
  let damageDealt = amount;
  let barrierConsumed = false;
  let combat = cloneFourPlayerCombatBody(target.combat)!;

  if (combat.barrier && damageDealt > 0) {
    combat.barrier = false;
    damageDealt = 0;
    barrierConsumed = true;
  } else {
    if (target.keywords.includes("Tough")) damageDealt = Math.max(0, damageDealt - 1);
    if (source?.keywords.includes("Deathtouch") && damageDealt > 0) {
      combat.health = 0;
    } else {
      combat.health = Math.max(0, combat.health - damageDealt);
    }
    if (source?.keywords.includes("Wither") && damageDealt > 0) {
      combat.maxHealth = Math.max(0, combat.maxHealth - damageDealt);
      combat.health = Math.min(combat.health, combat.maxHealth);
    }
  }

  const objects = state.objects.map((object) => object.id === target.id ? { ...object, combat } : object);
  return {
    state: { objects },
    damageDealt,
    barrierConsumed,
    destroyed: combat.health <= 0,
  };
}

export function markFourPlayerBattlefieldObjectAttacked(
  state: FourPlayerBattlefieldState,
  objectId: string,
): FourPlayerBattlefieldState {
  const object = findFourPlayerBattlefieldObject(state, objectId);
  return {
    objects: state.objects.map((candidate) => candidate.id === object.id
      ? { ...candidate, attackedThisTurn: true }
      : candidate),
  };
}

export function resetFourPlayerBattlefieldForTurn(
  state: FourPlayerBattlefieldState,
  activeSeat: FourPlayerSeat,
): FourPlayerBattlefieldState {
  return {
    objects: state.objects.map((object) => object.controllerSeat === activeSeat
      ? { ...object, attackedThisTurn: false }
      : object),
  };
}

export function placeResolvedGeneralOnBattlefield(
  state: FourPlayerBattlefieldState,
  seat: FourPlayerSeat,
  defId: string,
  castCount: number,
  enteredTurn: number,
  keywords: readonly Keyword[] = [],
  combat?: FourPlayerCombatBody,
): FourPlayerBattlefieldState {
  if (!Number.isInteger(castCount) || castCount < 1) throw new Error("Resolved General cast count must be positive.");
  const withoutPriorGeneral = {
    objects: state.objects.filter((object) => !(object.kind === "general" && object.ownerSeat === seat)),
  };
  return putFourPlayerBattlefieldObject(withoutPriorGeneral, {
    id: `general:${seat}:${castCount}`,
    defId,
    kind: "general",
    ownerSeat: seat,
    controllerSeat: seat,
    enteredTurn,
    keywords,
    combat,
  });
}

function eliminationKind(object: FourPlayerBattlefieldObject): FourPlayerOwnedObject["kind"] {
  return object.kind === "general" ? "card" : object.kind;
}

export function cleanupFourPlayerBattlefieldForElimination(
  state: FourPlayerBattlefieldState,
  eliminatedSeat: FourPlayerSeat,
): FourPlayerBattlefieldCleanup {
  const sourceById = new Map(state.objects.map((object) => [object.id, object]));
  const generic: FourPlayerOwnedObject[] = state.objects.map((object) => ({
    id: object.id,
    kind: eliminationKind(object),
    owner: object.ownerSeat,
    controller: object.controllerSeat,
    ...(object.kind === "token" ? { token: true } : {}),
  }));
  const cleanup = cleanupObjectsForEliminatedSeat(generic, eliminatedSeat);
  const survivingObjects = cleanup.survivingObjects.map((object) => {
    const source = sourceById.get(object.id);
    if (!source) throw new Error(`Missing battlefield source object ${object.id} during elimination cleanup.`);
    return { ...source, controllerSeat: object.controller };
  });
  return {
    state: { objects: survivingObjects },
    removedObjectIds: cleanup.removedObjectIds,
    returnedToOwnerControlIds: cleanup.returnedToOwnerControlIds,
  };
}
