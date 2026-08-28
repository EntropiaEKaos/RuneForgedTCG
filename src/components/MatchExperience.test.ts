import assert from "node:assert/strict";
import { matchGuidance, potentialAttackPressure } from "./match-experience-model";
import type { UnitInstance } from "@/game/types";

const unit = (id: string, power: number): UnitInstance => ({
  instanceId: id, defId: "ember_whelp", owner: "player", power, basePower: power,
  health: 2, maxHealth: 2, keywords: [], barrier: false, frostbitten: false, stunned: false,
  isAttacking: false, hasStruck: false, summonedThisTurn: false, isChampion: false,
  leveled: false, strikes: 0, nexusStrikes: 0, equipment: [], races: [], powerBuffs: 0,
  healthBuffs: 0, permanentHealthModifier: 0, poisonCounters: 0, hasAttackedThisTurn: false,
});

assert.equal(potentialAttackPressure([unit("a", 3), unit("b", 5)], ["b"]), 5);
assert.match(matchGuidance("response", 0, false), /Prioridade/);
assert.match(matchGuidance("main", 0, true), /alvo destacado/);
assert.match(matchGuidance("combat", 2, false), /Ataque preparado/);
console.log("MATCH EXPERIENCE 2.33: PASS");
