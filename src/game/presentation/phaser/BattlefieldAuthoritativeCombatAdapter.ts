import type { BattlefieldCombatPresentationFrame } from "./BattlefieldCombatPresentation";

export type AuthoritativeCombatProjection = {
  revision: number;
  attackers: Array<{ unitId: string; defenderId?: string | null }>;
  blockers: Array<{ unitId: string; attackerId: string }>;
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
  const frames: BattlefieldCombatPresentationFrame[] = [];

  if (current.attackers.some((entry) => !previousAttackers.has(entry.unitId))) {
    frames.push({ phase: "attackers", attackerIds, blockerPairs: [], headline: "ATTACKERS DECLARED", detail: `${attackerIds.length} authoritative attacker${attackerIds.length === 1 ? "" : "s"}` });
  }

  if (current.blockers.some((entry) => !previousBlockers.has(`${entry.attackerId}:${entry.unitId}`))) {
    frames.push({ phase: "blockers", attackerIds, blockerPairs, headline: "BLOCKERS DECLARED", detail: `${blockerPairs.length} authoritative block${blockerPairs.length === 1 ? "" : "s"}` });
  }

  if (!previous?.resolution && current.resolution) {
    frames.push({ phase: "damage", attackerIds, blockerPairs, headline: "COMBAT DAMAGE", detail: "Authoritative combat resolution received" });
    frames.push({ phase: "complete", attackerIds, blockerPairs, headline: "COMBAT COMPLETE", detail: "Authoritative combat revision resolved" });
  }

  return frames.length ? { revision: current.revision, frames } : null;
}
