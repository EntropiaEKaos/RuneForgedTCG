import assert from "node:assert/strict";
import test from "node:test";
import {
  createFourPlayerCombatState,
  declareFourPlayerAttacker,
  declareFourPlayerBlocker,
  blockersForFourPlayerAttacker,
  cleanupFourPlayerCombatForElimination,
} from "./four-player-combat";

test("Commander blocker lane projection preserves declaration and ownership", () => {
  let combat = createFourPlayerCombatState("P1");
  combat = declareFourPlayerAttacker(combat, "attacker-a", "P2");
  combat = declareFourPlayerAttacker(combat, "attacker-b", "P3");
  combat = declareFourPlayerBlocker(combat, "P2", "blocker-a", "attacker-a");
  combat = declareFourPlayerBlocker(combat, "P3", "blocker-b", "attacker-b");
  assert.deepEqual(blockersForFourPlayerAttacker(combat, "attacker-a").map((blocker) => blocker.unitId), ["blocker-a"]);
  assert.deepEqual(blockersForFourPlayerAttacker(combat, "attacker-b").map((blocker) => blocker.unitId), ["blocker-b"]);
  assert.deepEqual(blockersForFourPlayerAttacker(combat, "missing"), []);
  assert.throws(() => declareFourPlayerBlocker(combat, "P2", "blocker-c", "attacker-a"), /multi-block ordering is not enabled/);
  assert.throws(() => declareFourPlayerBlocker(combat, "P3", "blocker-c", "attacker-a"), /cannot block/);
  assert.throws(() => declareFourPlayerBlocker(combat, "P2", "blocker-a", "attacker-a"), /already blocking/);
  const eliminated = cleanupFourPlayerCombatForElimination(combat, "P2");
  assert.deepEqual(blockersForFourPlayerAttacker(eliminated, "attacker-a"), []);
  assert.deepEqual(blockersForFourPlayerAttacker(eliminated, "attacker-b").map((blocker) => blocker.unitId), ["blocker-b"]);
});
