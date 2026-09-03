import { getCard } from "./cards";
import type { GameState, PlayerId } from "./types";

/** Why a physical card entered the public graveyard zone. */
export type GraveyardReason =
  | "discard"
  | "mill"
  | "death"
  | "destroy"
  | "spell"
  | "counter"
  | "sacrifice"
  | "overflow";

/**
 * Public deterministic graveyard entry.
 *
 * `instanceId` identifies the zone object, not the former hand/battlefield
 * instance. Reanimation will consume this exact id and create a fresh normal
 * battlefield instance through the engine construction path.
 */
export interface GraveyardEntry {
  instanceId: string;
  defId: string;
  owner: PlayerId;
  roundEntered: number;
  reason: GraveyardReason;
  sourceInstanceId?: string;
}

/**
 * Backwards-compatible state augmentation. Historical authoritative replays do
 * not contain this property; all access must therefore go through graveyardOf.
 */
declare module "./types" {
  interface PlayerState {
    graveyard?: GraveyardEntry[];
  }
}

function nextGraveyardId(state: GameState): string {
  state.idCounter += 1;
  return `gy_${state.idCounter}`;
}

/** Treat missing historical zones as empty and materialize them on first use. */
export function graveyardOf(state: GameState, playerId: PlayerId): GraveyardEntry[] {
  const player = state.players[playerId];
  if (!player.graveyard) player.graveyard = [];
  return player.graveyard;
}

/** Read-only helper that does not mutate historical state. */
export function graveyardEntries(state: GameState, playerId: PlayerId): readonly GraveyardEntry[] {
  return state.players[playerId].graveyard ?? [];
}

/**
 * Graveyard 1.0 deliberately fails closed for generated/transformed definitions
 * that cannot yet be mapped back to one canonical physical collectible card.
 */
export function isGraveyardEligibleDef(defId: string): boolean {
  const def = getCard(defId);
  return def.collectible !== false;
}

export function putInGraveyard(
  state: GameState,
  playerId: PlayerId,
  defId: string,
  reason: GraveyardReason,
  sourceInstanceId?: string,
): GraveyardEntry | null {
  if (!isGraveyardEligibleDef(defId)) {
    state.log.push(`${getCard(defId).name} leaves play without a graveyard entry (non-collectible representation).`);
    return null;
  }

  const entry: GraveyardEntry = {
    instanceId: nextGraveyardId(state),
    defId,
    owner: playerId,
    roundEntered: state.round,
    reason,
    ...(sourceInstanceId ? { sourceInstanceId } : {}),
  };
  graveyardOf(state, playerId).push(entry);
  return entry;
}

/** Move exact selected hand instances into the graveyard atomically. */
export function discardHandInstancesToGraveyard(
  state: GameState,
  playerId: PlayerId,
  instanceIds: readonly string[],
  reason: Extract<GraveyardReason, "discard" | "counter" | "spell" | "overflow"> = "discard",
  sourceInstanceId?: string,
): number {
  if (instanceIds.length === 0) return 0;
  const selected = new Set(instanceIds);
  const player = state.players[playerId];
  const moving = player.hand.filter((card) => selected.has(card.instanceId));
  if (moving.length !== selected.size) return 0;

  for (const card of moving) {
    putInGraveyard(state, playerId, card.defId, reason, sourceInstanceId ?? card.instanceId);
  }
  player.hand = player.hand.filter((card) => !selected.has(card.instanceId));
  return moving.length;
}

/** Mill top cards from one deck into that same player's public graveyard. */
export function millDeckToGraveyard(
  state: GameState,
  playerId: PlayerId,
  count: number,
  sourceInstanceId?: string,
): string[] {
  const player = state.players[playerId];
  const milled: string[] = [];
  const total = Math.max(0, Math.floor(count));
  for (let i = 0; i < total && player.deck.length > 0; i += 1) {
    const defId = player.deck.shift()!;
    milled.push(defId);
    putInGraveyard(state, playerId, defId, "mill", sourceInstanceId);
  }
  return milled;
}

/** Useful invariant for tests, replay audits and future reanimation validation. */
export function graveyardHasUniqueIds(state: GameState): boolean {
  const ids = new Set<string>();
  for (const playerId of ["player", "ai"] as PlayerId[]) {
    for (const entry of graveyardEntries(state, playerId)) {
      if (ids.has(entry.instanceId)) return false;
      ids.add(entry.instanceId);
    }
  }
  return true;
}
