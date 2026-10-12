import assert from "node:assert/strict";
import test from "node:test";
import { summarizeVisualStackStatus } from "./visual-stack-status";

test("reports mixed combat states without hiding individual differences", () => {
  const units = [
    { instanceId: "a", defId: "wolf", isAttacking: true, exhausted: true, damage: 2, buffs: ["rage"] },
    { instanceId: "b", defId: "wolf", isBlocking: true, damage: 0, debuffs: ["slow"] },
    { instanceId: "c", defId: "wolf", damage: 1 },
  ];
  const before = JSON.stringify(units);
  assert.deepEqual(summarizeVisualStackStatus(units), {
    total: 3, attacking: 1, blocking: 1, exhausted: 1,
    damaged: 2, buffed: 1, debuffed: 1,
  });
  assert.equal(JSON.stringify(units), before);
});

test("empty stack has no combat indicators", () => {
  assert.deepEqual(summarizeVisualStackStatus([]), {
    total: 0, attacking: 0, blocking: 0, exhausted: 0,
    damaged: 0, buffed: 0, debuffed: 0,
  });
});
