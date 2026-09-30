export type BattlefieldAttackRoute = {
  unitId: string;
  controllerSeat: number;
  defendingSeat: number;
};

export type BattlefieldBlockRoute = {
  unitId: string;
  controllerSeat: number;
  attackerId: string;
};

export type BattlefieldCombatPresentationFrame = {
  phase: "attackers" | "blockers" | "damage" | "complete";
  attackerIds: string[];
  blockerPairs: Array<{ attackerId: string; blockerId: string }>;
  attackRoutes: BattlefieldAttackRoute[];
  blockRoutes: BattlefieldBlockRoute[];
  headline: string;
  detail: string;
};
