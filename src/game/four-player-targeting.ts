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
  | { kind: "battlefield"; objectId: string }
  | { kind: "graveyard"; seat: FourPlayerSeat; instanceId: string };

export function parseFourPlayerTargetRef(value: unknown): FourPlayerTargetRef | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  if (row.kind === "player" && typeof row.seat === "string" && FOUR_PLAYER_SEATS.includes(row.seat as FourPlayerSeat)) {
    return { kind: "player", seat: row.seat as FourPlayerSeat };
  }
  if (row.kind === "battlefield" && typeof row.objectId === "string" && row.objectId.trim()) {
    return { kind: "battlefield", objectId: row.objectId.trim() };
  }
  if (
    row.kind === "graveyard"
    && typeof row.seat === "string"
    && FOUR_PLAYER_SEATS.includes(row.seat as FourPlayerSeat)
    && typeof row.instanceId === "string"
    && row.instanceId.trim()
  ) {
    return { kind: "graveyard", seat: row.seat as FourPlayerSeat, instanceId: row.instanceId.trim() };
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
  if (object.durability && object.durability.health <= 0) throw new Error(`Destroyed object ${object.id} cannot be targeted.`);
  if (object.kind === "sentinela" && object.loyalty !== undefined && object.loyalty <= 0) {
    throw new Error(`Destroyed Sentinela ${object.id} cannot be targeted.`);
  }

  const allied = object.controllerSeat === actor;
  const isUnit = ["unit", "general", "token"].includes(object.kind);
  const isPermanent = object.kind === "permanent";
  const isSentinela = object.kind === "sentinela";

  if (targetKind === "enemyUnit" && (allied || !isUnit)) throw new Error(`Target ${object.id} is not an enemy unit.`);
  if (targetKind === "allyUnit" && (!allied || !isUnit)) throw new Error(`Target ${object.id} is not an allied unit.`);
  if (targetKind === "anyUnit" && !isUnit) throw new Error(`Target ${object.id} is not a unit combat body.`);
  if (targetKind === "enemyPermanent" && (allied || !isPermanent)) throw new Error(`Target ${object.id} is not an enemy permanent.`);
  if (targetKind === "allyPermanent" && (!allied || !isPermanent)) throw new Error(`Target ${object.id} is not an allied permanent.`);
  if (targetKind === "anyPermanent" && !isPermanent) throw new Error(`Target ${object.id} is not a permanent.`);
  if (targetKind === "enemySentinela" && (allied || !isSentinela)) throw new Error(`Target ${object.id} is not an enemy Sentinela.`);
  if (targetKind === "allySentinela" && (!allied || !isSentinela)) throw new Error(`Target ${object.id} is not an allied Sentinela.`);
  if (targetKind === "anySentinela" && !isSentinela) throw new Error(`Target ${object.id} is not a Sentinela.`);

  if (!allied && object.keywords.includes("Hexproof")) {
    throw new Error(`Enemy target ${object.id} has Hexproof.`);
  }
  return object;
}

export function assertFourPlayerGraveyardTarget(
  match: FourPlayerMatchState,
  actor: FourPlayerSeat,
  target: FourPlayerTargetRef | undefined,
  targetKind: TargetKind,
): { seat: FourPlayerSeat; instanceId: string } {
  if (!target || target.kind !== "graveyard") throw new Error("4P effect requires a graveyard target.");
  if (match.seats[target.seat].eliminated) throw new Error(`Eliminated seat ${target.seat} graveyard cannot be targeted.`);
  const allied = target.seat === actor;
  if (targetKind === "allyGraveyardCard" && !allied) throw new Error("4P effect requires an allied graveyard card.");
  if (targetKind === "allyGraveyardUnit" && !allied) throw new Error("4P effect requires an allied graveyard Unit.");
  if (targetKind === "enemyGraveyardCard" && allied) throw new Error("4P effect requires an enemy graveyard card.");
  if (!["allyGraveyardCard", "allyGraveyardUnit", "enemyGraveyardCard", "anyGraveyardCard"].includes(targetKind)) {
    throw new Error(`4P target kind ${targetKind} is not a graveyard target.`);
  }
  return { seat: target.seat, instanceId: target.instanceId };
}