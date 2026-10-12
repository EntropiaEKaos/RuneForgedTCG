import assert from "node:assert/strict";
import test from "node:test";
import type { UnitInstance } from "@/game/types";
import { summarizeVisualStackStatus } from "./visual-stack-status";

function unit(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    instanceId: "wolf-1", defId: "wolf", races: [], power: 2, basePower: 2,
    health: 3, maxHealth: 3, keywords: [], barrier: false, frostbitten: false,
    stunned: false, isAttacking: false, hasStruck: false, summonedThisTurn: false,
    owner: "player", isChampion: false, leveled: false, strikes: 0,
    nexusStrikes: 0, equipment: [], powerBuffs: 0, healthBuffs: 0,
    permanentHealthModifier: 0, poisonCounters: 0, hasAttackedThisTurn: false,
    ...overrides,
  };
}

test("summarizes actual engine fields and preserves individual state", () => {
  const units = [
    unit({ instanceId: "a", isAttacking: true, hasAttackedThisTurn: true, health: 1, powerBuffs: 1 }),
    unit({ instanceId: "b", stunned: true, auraHealthBonus: 2 }),
    unit({ instanceId: "c", poisonCounters: 1, health: 2 }),
  ];
  const snapshot = JSON.stringify(units);
  assert.deepEqual(summarizeVisualStackStatus(units), {
    total: 3, attacking: 1, spentAttack: 1, damaged: 2, buffed: 2, impaired: 2,
  });
  assert.equal(JSON.stringify(units), snapshot);
});

test("empty stacks have zero indicators", () => {
  assert.deepEqual(summarizeVisualStackStatus([]), {
    total: 0, attacking: 0, spentAttack: 0, damaged: 0, buffed: 0, impaired: 0,
  });
});
