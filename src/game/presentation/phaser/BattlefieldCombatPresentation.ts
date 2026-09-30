import type { BattlefieldLabScenario } from "../battlefield-lab-scenario";

export type BattlefieldCombatPresentationFrame = {
  phase: "attackers" | "blockers" | "damage" | "complete";
  attackerIds: string[];
  blockerPairs: Array<{ attackerId: string; blockerId: string }>;
  headline: string;
  detail: string;
};

export function buildDeterministicCombatTimeline(scenario: BattlefieldLabScenario): BattlefieldCombatPresentationFrame[] {
  const players = scenario.players.slice(0, 4);
  const attackerPlayer = players[0];
  const defenderPlayer = players[1];
  if (!attackerPlayer || !defenderPlayer) return [];

  const attackers = scenario.entities.filter((entity) => entity.controllerId === attackerPlayer.id).slice(0, 2);
  const blockers = scenario.entities.filter((entity) => entity.controllerId === defenderPlayer.id).slice(0, 2);
  if (attackers.length === 0) return [];

  const pairs = attackers.flatMap((attacker, index) => blockers[index] ? [{ attackerId: attacker.id, blockerId: blockers[index]!.id }] : []);
  return [
    { phase: "attackers", attackerIds: attackers.map((entity) => entity.id), blockerPairs: [], headline: "ATTACKERS DECLARED", detail: `${attackerPlayer.label} attacks ${defenderPlayer.label}` },
    { phase: "blockers", attackerIds: attackers.map((entity) => entity.id), blockerPairs: pairs, headline: "BLOCKERS DECLARED", detail: pairs.length ? `${pairs.length} combat lane${pairs.length === 1 ? "" : "s"} blocked` : "No blockers declared" },
    { phase: "damage", attackerIds: attackers.map((entity) => entity.id), blockerPairs: pairs, headline: "COMBAT DAMAGE", detail: "Authoritative damage presentation" },
    { phase: "complete", attackerIds: attackers.map((entity) => entity.id), blockerPairs: pairs, headline: "COMBAT COMPLETE", detail: "Waiting for next authoritative phase" },
  ];
}
