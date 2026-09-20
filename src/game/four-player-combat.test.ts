import assert from "node:assert/strict";
import {
  attackersForDefender,
  createFourPlayerCombatState,
  declareFourPlayerAttacker,
  declareFourPlayerBlocker,
} from "./four-player-combat";

let combat = createFourPlayerCombatState("p1");
combat = declareFourPlayerAttacker(combat, "dragon", "p2");
combat = declareFourPlayerAttacker(combat, "warrior", "p3");
combat = declareFourPlayerAttacker(combat, "elemental", "p4");

assert.equal(combat.attackers.length, 3);
assert.equal(combat.declarationTriggersQueued, false);
assert.deepEqual(attackersForDefender(combat, "p2").map((a) => a.unitId), ["dragon"]);
assert.deepEqual(attackersForDefender(combat, "p3").map((a) => a.unitId), ["warrior"]);
assert.deepEqual(attackersForDefender(combat, "p4").map((a) => a.unitId), ["elemental"]);

combat = declareFourPlayerBlocker(combat, "p2", "shield-p2", "dragon");
combat = declareFourPlayerBlocker(combat, "p3", "guard-p3", "warrior");
assert.equal(combat.blockers.length, 2);
assert.equal(combat.declarationTriggersQueued, false);
assert.throws(
  () => declareFourPlayerBlocker(combat, "p2", "shield-p2-b", "dragon"),
  /already blocked/,
  "one attacker accepts one blocker until multi-block ordering is explicitly modeled",
);

assert.throws(
  () => declareFourPlayerBlocker(combat, "p4", "illegal-p4", "dragon"),
  /cannot block an attacker assigned to p2/,
);
assert.throws(() => declareFourPlayerAttacker(combat, "self", "p1"), /cannot attack itself/);
assert.throws(() => declareFourPlayerAttacker(combat, "dragon", "p4"), /already attacking/);

const withElimination = createFourPlayerCombatState("p1", ["p3"]);
assert.throws(() => declareFourPlayerAttacker(withElimination, "unit", "p3"), /eliminated seat p3/);

console.log("FOUR PLAYER MULTI-TARGET COMBAT: PASS");
