import assert from "node:assert/strict";
import test from "node:test";
import type { UnitInstance } from "@/game/types";
import { summarizeVisualStackStatus } from "./visual-stack-status";
import { groupVisualUnits } from "./visual-unit-stacks";

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

test("large swarm counts only living members after casualties", () => {
  const swarm = Array.from({ length: 24 }, (_, index) => unit({
    instanceId: `wolf-${index}`,
    isAttacking: index < 12,
    hasAttackedThisTurn: index < 12,
    health: index % 4 === 0 ? 2 : 3,
    stunned: index % 6 === 0,
  }));
  const survivors = swarm.filter((_, index) => index >= 3);
  assert.deepEqual(summarizeVisualStackStatus(survivors), {
    total: 21,
    attacking: 9,
    spentAttack: 9,
    damaged: 5,
    buffed: 0,
    impaired: 3,
  });
  assert.equal(summarizeVisualStackStatus([]).total, 0);
});

test("attack, damage and negative statuses are independent across identical cards", () => {
  const units = [
    unit({ instanceId: "first", isAttacking: true, health: 3 }),
    unit({ instanceId: "second", health: 2, frostbitten: true }),
    unit({ instanceId: "third", powerBuffs: 2, hasAttackedThisTurn: true }),
  ];
  assert.deepEqual(summarizeVisualStackStatus(units), {
    total: 3, attacking: 1, spentAttack: 1, damaged: 1, buffed: 1, impaired: 1,
  });
  assert.deepEqual(units.map(unit => unit.instanceId), ["first", "second", "third"]);
});


test("compact, expanded and separated stacks preserve combat indicators and identities", () => {
  const units = [
    unit({ instanceId: "wolf-a", isAttacking: true, health: 2 }),
    unit({ instanceId: "wolf-b", stunned: true, powerBuffs: 1 }),
    unit({ instanceId: "wolf-c", hasAttackedThisTurn: true }),
  ];
  const before = JSON.stringify(units);
  const compact = groupVisualUnits(units);
  const expanded = groupVisualUnits(units, { expandedIds: new Set(["def:wolf"]) });
  const separated = groupVisualUnits(units, { separatedIds: new Set(["wolf-b"]) });
  assert.equal(compact.length, 1);
  assert.equal(expanded.length, 1);
  assert.equal(expanded[0].expanded, true);
  assert.equal(separated.length, 2);
  assert.deepEqual(compact[0].members.map(member => member.instanceId), ["wolf-a", "wolf-b", "wolf-c"]);
  assert.deepEqual(summarizeVisualStackStatus(compact[0].members), summarizeVisualStackStatus(expanded[0].members));
  assert.equal(separated.flatMap(group => group.members).length, units.length);
  assert.deepEqual(separated.map(group => summarizeVisualStackStatus(group.members).total), [2, 1]);
  assert.equal(JSON.stringify(units), before);
  assert.equal(compact[0].members[0], units[0]);
});


test("swarm casualty and regrouping recalculate badges from surviving unit instances", () => {
  const units = [
    unit({ instanceId: "a", isAttacking: true, health: 1 }),
    unit({ instanceId: "b", stunned: true }),
    unit({ instanceId: "c", powerBuffs: 2 }),
    unit({ instanceId: "d", hasAttackedThisTurn: true, poisonCounters: 1 }),
  ];
  const before = summarizeVisualStackStatus(groupVisualUnits(units)[0].members);
  assert.deepEqual(before, { total: 4, attacking: 1, spentAttack: 1, damaged: 1, buffed: 1, impaired: 2 });
  const survivors = units.filter(member => member.instanceId !== "a" && member.instanceId !== "b");
  const regrouped = groupVisualUnits(survivors, { separatedIds: new Set(["b"]) });
  assert.equal(regrouped.length, 1);
  assert.deepEqual(regrouped[0].members.map(member => member.instanceId), ["c", "d"]);
  assert.deepEqual(summarizeVisualStackStatus(regrouped[0].members), {
    total: 2, attacking: 0, spentAttack: 1, damaged: 0, buffed: 1, impaired: 1,
  });
  assert.equal(units.length, 4);
});
