import {
  createFourPlayerBattlefieldState,
  findFourPlayerBattlefieldObject,
  type FourPlayerBattlefieldObject,
} from "./four-player-battlefield";
import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";
import type { FourPlayerMatchState } from "./four-player-match";
import type { TargetKind } from "./types";

export type FourPlayerTargetRef =
  | { kind: "player"; seat: FourPlayerSeat }
  | { kind: "battlefield"; objectId: string };

export function parseFourPlayerTargetRef(value: unknown): FourPlayerTargetRef | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  if (row.kind === "player" && typeof row.seat === "string" && FOUR_PLAYER_SEATS.includes(row.seat as FourPlayerSeat)) {
    return { kind: "player", seat: row.seat as FourPlayerSeat };
  }
  if (row.kind === "battlefield" && typeof row.objectId === "string" && row.objectId.trim()) {
    return { kind: "battlefield", objectId: row.objectId.trim() };
  }
  return undefined;
}

export function assertFourPlayerTargetPlayer(
  match: FourPlayerMatchState,
  actor: FourPlayerSeat,
  target: FourPlayerTargetRef | undefined,
  relation: "self" | "opponent" | "any",
): FourPlayerSeat {
  if (!target || target.kind !== "player") throw new Error("4P effect requires a player target.");
  const seat = target.seat;
  if (match.seats[seat].eliminated) throw new Error(`Eliminated seat ${seat} cannot be targeted.`);
  if (relation === "self" && seat !== actor) throw new Error(`Seat ${actor} may only target its own Nexus for this effect.`);
  if (relation === "opponent" && seat === actor) throw new Error(`Seat ${actor} must target an opponent for this effect.`);
  return seat;
}

export function assertFourPlayerTargetObject(
  match: FourPlayerMatchState,
  actor: FourPlayerSeat,
  target: FourPlayerTargetRef | undefined,
  targetKind: TargetKind,
): FourPlayerBattlefieldObject {
  if (!target || target.kind !== "battlefield") throw new Error("4P effect requires a battlefield target.");
  const battlefield = match.battlefield ?? createFourPlayerBattlefieldState();
  const object = findFourPlayerBattlefieldObject(battlefield, target.objectId);
  if (object.combat && object.combat.health <= 0) throw new Error(`Destroyed object ${object.id} cannot be targeted.`);

  const allied = object.controllerSeat === actor;
  if (targetKind === "enemyUnit" && allied) throw new Error(`Target ${object.id} is not an enemy unit.`);
  if (targetKind === "allyUnit" && !allied) throw new Error(`Target ${object.id} is not an allied unit.`);
  if (
    (targetKind === "enemyUnit" || targetKind === "allyUnit" || targetKind === "anyUnit")
    && !["unit", "general", "token"].includes(object.kind)
  ) {
    throw new Error(`Target ${object.id} is not a unit combat body.`);
  }

  if (!allied && object.keywords.includes("Hexproof")) {
    throw new Error(`Enemy target ${object.id} has Hexproof.`);
  }
  return object;
}
