import { getCard } from "./cards";
import { graveyardEntries, graveyardOf, putInGraveyard, type GraveyardEntry } from "./graveyard";
import type { GameState, PlayerId, TargetKind } from "./types";

export type GraveyardTargetKind =
  | "allyGraveyardCard"
  | "enemyGraveyardCard"
  | "anyGraveyardCard"
  | "allyGraveyardUnit";

const GRAVEYARD_TARGETS = new Set<GraveyardTargetKind>([
  "allyGraveyardCard",
  "enemyGraveyardCard",
  "anyGraveyardCard",
  "allyGraveyardUnit",
]);

export function isGraveyardTargetKind(target: TargetKind): target is GraveyardTargetKind {
  return GRAVEYARD_TARGETS.has(target as GraveyardTargetKind);
}

export function findGraveyardEntry(
  state: GameState,
  instanceId: string,
): { owner: PlayerId; entry: GraveyardEntry } | null {
  for (const owner of ["player", "ai"] as PlayerId[]) {
    const entry = graveyardEntries(state, owner).find((candidate) => candidate.instanceId === instanceId);
    if (entry) return { owner, entry };
  }
  return null;
}

export function isValidGraveyardTarget(
  state: GameState,
  playerId: PlayerId,
  targetKind: TargetKind,
  entry: GraveyardEntry,
): boolean {
  if (!isGraveyardTargetKind(targetKind)) return false;
  const owner = entry.owner;
  if (!graveyardEntries(state, owner).some((candidate) => candidate.instanceId === entry.instanceId)) return false;

  if (targetKind === "allyGraveyardUnit") {
    return owner === playerId && getCard(entry.defId).type === "Unit";
  }
  if (targetKind === "allyGraveyardCard") return owner === playerId;
  if (targetKind === "enemyGraveyardCard") return owner !== playerId;
  return true;
}

/**
 * Atomically remove exactly one authoritative graveyard object. The returned
 * entry can then be moved to hand, reanimated, or banished. A stale/missing id
 * is a no-op, so repeated or racing resolutions cannot duplicate a card.
 */
export function consumeGraveyardEntry(
  state: GameState,
  owner: PlayerId,
  instanceId: string,
): GraveyardEntry | null {
  const graveyard = graveyardOf(state, owner);
  const index = graveyard.findIndex((entry) => entry.instanceId === instanceId);
  if (index < 0) return null;
  const [entry] = graveyard.splice(index, 1);
  return entry ?? null;
}

export function graveyardTargetScore(entry: GraveyardEntry): number {
  const def = getCard(entry.defId);
  return def.cost * 20 + (def.power ?? 0) * 6 + (def.health ?? def.maxHealth ?? 0) * 3;
}

/**
 * Studio sandbox helper. Seed one real collectible Unit for the player and one
 * real collectible card for the opponent by MOVING them from their deck into
 * the graveyard. No synthetic duplicate is created, so zone invariants remain
 * representative of an actual match.
 */
export function seedStudioSandboxGraveyards(state: GameState): GameState {
  const seedOne = (owner: PlayerId, requireUnit: boolean) => {
    const deck = state.players[owner].deck;
    const index = deck.findIndex((defId) => {
      const def = getCard(defId);
      return def.collectible !== false && (!requireUnit || def.type === "Unit");
    });
    if (index < 0) return;
    const [defId] = deck.splice(index, 1);
    if (defId) putInGraveyard(state, owner, defId, "discard", "studio-sandbox-seed");
  };

  seedOne("player", true);
  seedOne("ai", false);
  state.log.push("🧪 Studio Sandbox — graveyards seeded with physical deck cards for recursion testing.");
  return state;
}
