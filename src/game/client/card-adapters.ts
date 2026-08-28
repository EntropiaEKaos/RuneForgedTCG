import type { PermanentInstance, UnitInstance } from "../types";

/** Presentation adapter for rendering a permanent in the shared card frame. */
export function permanentAsUnit(permanent: PermanentInstance): UnitInstance {
  return {
    instanceId: permanent.instanceId,
    defId: permanent.defId,
    power: permanent.power,
    basePower: permanent.power,
    health: permanent.health,
    maxHealth: permanent.maxHealth,
    keywords: [],
    barrier: false,
    frostbitten: false,
    stunned: false,
    isAttacking: false,
    hasStruck: false,
    summonedThisTurn: false,
    owner: permanent.owner,
    isChampion: false,
    leveled: false,
    strikes: 0,
    nexusStrikes: 0,
    races: [],
    equipment: [],
    powerBuffs: 0,
    healthBuffs: 0,
    permanentHealthModifier: 0,
    poisonCounters: 0,
    hasAttackedThisTurn: false,
  };
}
