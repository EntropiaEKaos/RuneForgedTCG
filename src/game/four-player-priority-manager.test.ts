import assert from "node:assert/strict";
import {
  actionTaken,
  allLivingPlayersPassed,
  createFourPlayerPriorityState,
  passPriority,
  shouldPauseForPriority,
} from "./four-player-priority-manager";

let priority = createFourPlayerPriorityState("p1");
assert.equal(priority.holder, "p1");
assert.equal(priority.mode, "smart_priority");

priority = passPriority(priority);
assert.equal(priority.holder, "p2");
priority = passPriority(priority);
assert.equal(priority.holder, "p3");
priority = passPriority(priority);
assert.equal(priority.holder, "p4");
assert.equal(allLivingPlayersPassed(priority), false);
priority = passPriority(priority);
assert.equal(priority.holder, "p1");
assert.equal(allLivingPlayersPassed(priority), true);

// P3 responds: passes are reset and priority continues clockwise from the actor.
priority = createFourPlayerPriorityState("p1");
priority = passPriority(priority); // p1 -> p2
priority = passPriority(priority); // p2 -> p3
priority = actionTaken(priority);  // p3 action -> p4
assert.equal(priority.anchorSeat, "p3");
assert.equal(priority.holder, "p4");
assert.deepEqual(priority.passedSeats, []);

// Eliminated seats never receive priority and are not required to pass.
priority = createFourPlayerPriorityState("p1", ["p2"]);
priority = passPriority(priority);
assert.equal(priority.holder, "p3");
priority = passPriority(priority);
priority = passPriority(priority);
assert.equal(allLivingPlayersPassed(priority), true);

assert.equal(shouldPauseForPriority("smart_priority", false), false);
assert.equal(shouldPauseForPriority("smart_priority", true, false), false);
assert.equal(shouldPauseForPriority("smart_priority", true, true), true);
assert.equal(shouldPauseForPriority("full_control", false), true);
assert.equal(shouldPauseForPriority("auto_pass", false), false);
assert.equal(shouldPauseForPriority("auto_pass", true), true);

console.log("FOUR PLAYER PRIORITY MANAGER: PASS");
