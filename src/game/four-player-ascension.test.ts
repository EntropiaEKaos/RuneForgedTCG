import assert from "node:assert/strict";
import { createGeneralAscensionState, recordGeneralAscensionProgress } from "./four-player-ascension";

let ascension = createGeneralAscensionState("p1", {
  key: "warpath",
  metric: "general_damage_dealt",
  threshold: 10,
});
assert.equal(ascension.ascended, false);

// Unrelated metrics cannot accidentally advance this General.
ascension = recordGeneralAscensionProgress(ascension, "spells_cast", 5);
assert.equal(ascension.progress, 0);

ascension = recordGeneralAscensionProgress(ascension, "general_damage_dealt", 4);
assert.equal(ascension.progress, 4);
ascension = recordGeneralAscensionProgress(ascension, "general_damage_dealt", 6);
assert.equal(ascension.progress, 10);
assert.equal(ascension.ascended, true);

// Ascension is monotonic and capped at the objective threshold.
const afterAscension = recordGeneralAscensionProgress(ascension, "general_damage_dealt", 100);
assert.deepEqual(afterAscension, ascension);

assert.throws(
  () => createGeneralAscensionState("p2", { key: "bad", metric: "spells_cast", threshold: 0 }),
  /threshold must be positive/,
);
assert.throws(
  () => recordGeneralAscensionProgress(createGeneralAscensionState("p2", { key: "ok", metric: "spells_cast", threshold: 3 }), "spells_cast", -1),
  /cannot be negative/,
);

console.log("FOUR PLAYER GENERAL ASCENSION: PASS");
