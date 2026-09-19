import type { FourPlayerSeat } from "./four-player-general";

export type FourPlayerObjectKind = "card" | "unit" | "permanent" | "sentinela" | "token" | "stack" | "delayed_trigger";

export interface FourPlayerOwnedObject {
  id: string;
  kind: FourPlayerObjectKind;
  owner: FourPlayerSeat;
  controller: FourPlayerSeat;
  token?: boolean;
}

export interface FourPlayerEliminationCleanup {
  removedObjectIds: string[];
  returnedToOwnerControlIds: string[];
  survivingObjects: FourPlayerOwnedObject[];
}

/**
 * Multiplayer elimination invariant:
 * - objects owned by the eliminated seat leave the match;
 * - tokens owned by that seat leave the match;
 * - objects owned by living seats but controlled by the eliminated seat revert to owner control;
 * - no object may retain an eliminated controller after cleanup.
 *
 * Zone-specific movement remains an adapter concern when this contract is wired to the existing engine.
 */
export function cleanupObjectsForEliminatedSeat(
  objects: readonly FourPlayerOwnedObject[],
  eliminatedSeat: FourPlayerSeat,
): FourPlayerEliminationCleanup {
  const removedObjectIds: string[] = [];
  const returnedToOwnerControlIds: string[] = [];
  const survivingObjects: FourPlayerOwnedObject[] = [];

  for (const object of objects) {
    if (object.owner === eliminatedSeat) {
      removedObjectIds.push(object.id);
      continue;
    }

    if (object.controller === eliminatedSeat) {
      returnedToOwnerControlIds.push(object.id);
      survivingObjects.push({ ...object, controller: object.owner });
      continue;
    }

    survivingObjects.push(object);
  }

  return { removedObjectIds, returnedToOwnerControlIds, survivingObjects };
}

export function assertNoEliminatedController(
  objects: readonly FourPlayerOwnedObject[],
  eliminatedSeat: FourPlayerSeat,
): void {
  if (objects.some((object) => object.controller === eliminatedSeat)) {
    throw new Error(`Elimination cleanup left controller ${eliminatedSeat} in the match.`);
  }
}
