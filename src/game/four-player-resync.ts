import type { FourPlayerSeat } from "./four-player-general";
import type { FourPlayerSeatProjection } from "./four-player-projection";

export interface FourPlayerResyncSnapshot {
  matchId: string;
  revision: number;
  viewer: FourPlayerSeat;
  projection: FourPlayerSeatProjection;
}

export interface FourPlayerClientRevision {
  matchId: string;
  revision: number;
}

export type FourPlayerResyncDecision =
  | { type: "current" }
  | { type: "snapshot_required"; reason: "behind" | "ahead" | "wrong_match" };

export function decideFourPlayerResync(
  serverMatchId: string,
  serverRevision: number,
  client: FourPlayerClientRevision,
): FourPlayerResyncDecision {
  if (client.matchId !== serverMatchId) return { type: "snapshot_required", reason: "wrong_match" };
  if (client.revision < serverRevision) return { type: "snapshot_required", reason: "behind" };
  if (client.revision > serverRevision) return { type: "snapshot_required", reason: "ahead" };
  return { type: "current" };
}

export function createFourPlayerResyncSnapshot(
  matchId: string,
  revision: number,
  projection: FourPlayerSeatProjection,
): FourPlayerResyncSnapshot {
  if (revision < 0) throw new Error("Revision cannot be negative.");
  return { matchId, revision, viewer: projection.viewer, projection };
}
