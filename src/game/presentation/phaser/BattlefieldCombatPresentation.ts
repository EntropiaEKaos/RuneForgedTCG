export type BattlefieldCombatPresentationFrame = {
  phase: "attackers" | "blockers" | "damage" | "complete";
  attackerIds: string[];
  blockerPairs: Array<{ attackerId: string; blockerId: string }>;
  headline: string;
  detail: string;
};
