import assert from "node:assert/strict";
import test from "node:test";
import {
  createFourPlayerCombatState,
  declareFourPlayerAttacker,
  declareFourPlayerBlocker,
  blockersForFourPlayerAttacker,
  planFourPlayerBlockerDamage,
  planFourPlayerSimultaneousBlockExchange,
  cleanupFourPlayerCombatForElimination,
} from "./four-player-combat";

test("Commander blocker lane projection preserves declaration and ownership", () => {
  let combat = createFourPlayerCombatState("p1");
  combat = declareFourPlayerAttacker(combat, "attacker-a", "p2");
  combat = declareFourPlayerAttacker(combat, "attacker-b", "p3");
  combat = declareFourPlayerBlocker(combat, "p2", "blocker-a", "attacker-a");
  combat = declareFourPlayerBlocker(combat, "p3", "blocker-b", "attacker-b");
  assert.deepEqual(blockersForFourPlayerAttacker(combat, "attacker-a").map((blocker) => blocker.unitId), ["blocker-a"]);
  assert.deepEqual(blockersForFourPlayerAttacker(combat, "attacker-b").map((blocker) => blocker.unitId), ["blocker-b"]);
  assert.deepEqual(blockersForFourPlayerAttacker(combat, "missing"), []);
  assert.throws(() => declareFourPlayerBlocker(combat, "p2", "blocker-c", "attacker-a"), /multi-block ordering is not enabled/);
  assert.throws(() => declareFourPlayerBlocker(combat, "p3", "blocker-c", "attacker-a"), /cannot block/);
  assert.throws(() => declareFourPlayerBlocker(combat, "p2", "blocker-a", "attacker-a"), /already blocking/);
  const eliminated = cleanupFourPlayerCombatForElimination(combat, "p2");
  assert.deepEqual(blockersForFourPlayerAttacker(eliminated, "attacker-a"), []);
  assert.deepEqual(blockersForFourPlayerAttacker(eliminated, "attacker-b").map((blocker) => blocker.unitId), ["blocker-b"]);
});

test("lane projection preserves order without mutating future multi-block declarations", () => {
  let combat = createFourPlayerCombatState("p1");
  combat = declareFourPlayerAttacker(combat, "attacker-a", "p2");
  const futureDeclarations = {
    ...combat,
    blockers: [
      { unitId: "blocker-1", controller: "p2" as const, attackerId: "attacker-a" },
      { unitId: "blocker-2", controller: "p2" as const, attackerId: "attacker-a" },
      { unitId: "blocker-3", controller: "p2" as const, attackerId: "attacker-a" },
    ],
  };
  const before = JSON.stringify(futureDeclarations);
  assert.deepEqual(
    blockersForFourPlayerAttacker(futureDeclarations, "attacker-a").map((blocker) => blocker.unitId),
    ["blocker-1", "blocker-2", "blocker-3"],
  );
  assert.equal(JSON.stringify(futureDeclarations), before);
  assert.deepEqual(
    blockersForFourPlayerAttacker(cleanupFourPlayerCombatForElimination(futureDeclarations, "p2"), "attacker-a"),
    [],
  );
});

test("ordered damage planner assigns lethal damage before spillover", () => {
  assert.deepEqual(planFourPlayerBlockerDamage([3, 2, 4], 7), { assigned: [3, 2, 2], remaining: 0 });
  assert.deepEqual(planFourPlayerBlockerDamage([3, 2, 4], 12), { assigned: [3, 2, 4], remaining: 3 });
  assert.deepEqual(planFourPlayerBlockerDamage([3, 2, 4], 2, true), { assigned: [1, 1, 0], remaining: 0 });
  assert.deepEqual(planFourPlayerBlockerDamage([], 5), { assigned: [], remaining: 5 });
  assert.throws(() => planFourPlayerBlockerDamage([0], 3), /positive integer/);
  assert.throws(() => planFourPlayerBlockerDamage([2], -1), /nonnegative integer/);
});

test("damage planning remains deterministic across mixed defender health and power", () => {
  for (let power = 0; power <= 30; power += 1) {
    for (const health of [[1, 1, 1], [2, 5, 3], [7, 1, 9], [4, 4, 4, 4]]) {
      for (const deathtouch of [false, true]) {
        const original = [...health];
        const result = planFourPlayerBlockerDamage(health, power, deathtouch);
        assert.equal(result.assigned.length, health.length);
        assert.equal(result.assigned.reduce((sum, value) => sum + value, 0) + result.remaining, power);
        assert.ok(result.assigned.every((value, index) => Number.isInteger(value) && value >= 0 && value <= (deathtouch ? 1 : health[index])));
        assert.ok(result.remaining >= 0);
        assert.deepEqual(health, original);
        assert.deepEqual(planFourPlayerBlockerDamage(health, power, deathtouch), result);
      }
    }
  }
});

test("multi-block planning handles zero attack, lethal deathtouch and excess damage", () => {
  assert.deepEqual(planFourPlayerBlockerDamage([5, 3, 2], 0), { assigned: [0, 0, 0], remaining: 0 });
  assert.deepEqual(planFourPlayerBlockerDamage([5, 3, 2], 2, true), { assigned: [1, 1, 0], remaining: 0 });
  assert.deepEqual(planFourPlayerBlockerDamage([5, 3, 2], 4, true), { assigned: [1, 1, 1], remaining: 1 });
  assert.deepEqual(planFourPlayerBlockerDamage([5, 3, 2], 20), { assigned: [5, 3, 2], remaining: 10 });
  assert.throws(() => planFourPlayerBlockerDamage([2.5], 4), /positive integer/);
  assert.throws(() => planFourPlayerBlockerDamage([2], Number.POSITIVE_INFINITY), /nonnegative integer/);
  assert.throws(() => planFourPlayerBlockerDamage([2], 1.5), /nonnegative integer/);
  assert.throws(() => planFourPlayerBlockerDamage([2], Number.MAX_SAFE_INTEGER + 1), /nonnegative integer/);
  assert.throws(() => planFourPlayerBlockerDamage([Number.MAX_SAFE_INTEGER + 1], 3), /positive integer/);
});

test("simultaneous blocker exchange preserves damage from every blocker", () => {
  const health = [2, 3, 4];
  const power = [4, 2, 1];
  const result = planFourPlayerSimultaneousBlockExchange(6, health, power);
  assert.deepEqual(result, {
    assignedToBlockers: [2, 3, 1],
    attackerIncomingDamage: 7,
    unassignedAttackerDamage: 0,
  });
  assert.deepEqual(health, [2, 3, 4]);
  assert.deepEqual(power, [4, 2, 1]);
  assert.deepEqual(planFourPlayerSimultaneousBlockExchange(4, [8, 8], [2, 3], true), {
    assignedToBlockers: [1, 1],
    attackerIncomingDamage: 5,
    unassignedAttackerDamage: 2,
  });
  assert.deepEqual(planFourPlayerSimultaneousBlockExchange(5, [], []), {
    assignedToBlockers: [],
    attackerIncomingDamage: 0,
    unassignedAttackerDamage: 5,
  });
  assert.throws(() => planFourPlayerSimultaneousBlockExchange(5, [2], []), /matching lengths/);
  assert.throws(() => planFourPlayerSimultaneousBlockExchange(5, [2], [-1]), /nonnegative safe integer/);
  assert.throws(() => planFourPlayerSimultaneousBlockExchange(5, [2], [1.5]), /nonnegative safe integer/);
});
