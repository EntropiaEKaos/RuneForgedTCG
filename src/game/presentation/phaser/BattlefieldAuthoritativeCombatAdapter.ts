import type { BattlefieldCombatPresentationFrame } from "./BattlefieldCombatPresentation";

export type AuthoritativeCombatProjection = {
  revision: number;
  attackers: Array<{ unitId: string; controllerSeat: number; defendingSeat: number }>;
  blockers: Array<{ unitId: string; controllerSeat: number; attackerId: string }>;
  resolution?: unknown | null;
};

export type AuthoritativeCombatDelta = {
  revision: number;
  frames: BattlefieldCombatPresentationFrame[];
};

export function projectAuthoritativeCombatDelta(
  previous: AuthoritativeCombatProjection | null,
  current: AuthoritativeCombatProjection,
): AuthoritativeCombatDelta | null {
  if (previous && current.revision <= previous.revision) return null;

  const previousAttackers = new Set(previous?.attackers.map((entry) => entry.unitId) ?? []);
  const previousBlockers = new Set((previous?.blockers ?? []).map((entry) => `${entry.attackerId}:${entry.unitId}`));
  const attackerIds = current.attackers.map((entry) => entry.unitId);
  const blockerPairs = current.blockers.map((entry) => ({ attackerId: entry.attackerId, blockerId: entry.unitId }));
  const attackRoutes = current.attackers.map((entry) => ({
    unitId: entry.unitId,
    controllerSeat: entry.controllerSeat,
    defendingSeat: entry.defendingSeat,
  }));
  const blockRoutes = current.blockers.map((entry) => ({
    unitId: entry.unitId,
    controllerSeat: entry.controllerSeat,
    attackerId: entry.attackerId,
  }));
  const frames: BattlefieldCombatPresentationFrame[] = [];

  if (current.attackers.some((entry) => !previousAttackers.has(entry.unitId))) {
    frames.push({
      phase: "attackers",
      attackerIds,
      blockerPairs: [],
      attackRoutes,
      blockRoutes: [],
      headline: "ATTACKERS DECLARED",
      detail: `${attackerIds.length} authoritative attacker${attackerIds.length === 1 ? "" : "s"}`,
    });
  }

  if (current.blockers.some((entry) => !previousBlockers.has(`${entry.attackerId}:${entry.unitId}`))) {
    frames.push({
      phase: "blockers",
      attackerIds,
      blockerPairs,
      attackRoutes,
      blockRoutes,
      headline: "BLOCKERS DECLARED",
      detail: `${blockerPairs.length} authoritative block${blockerPairs.length === 1 ? "" : "s"}`,
    });
  }

  if (!previous?.resolution && current.resolution) {
    const shared = { attackerIds, blockerPairs, attackRoutes, blockRoutes };
    frames.push({ phase: "damage", ...shared, headline: "COMBAT DAMAGE", detail: "Authoritative combat resolution received" });
    frames.push({ phase: "complete", ...shared, headline: "COMBAT COMPLETE", detail: "Authoritative combat revision resolved" });
  }

  return frames.length ? { revision: current.revision, frames } : null;
}
