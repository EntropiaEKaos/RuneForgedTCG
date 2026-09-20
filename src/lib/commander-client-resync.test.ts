import assert from "node:assert/strict";
import {
  commanderMutationNeedsResync,
  commanderResumeNeedsResync,
  commanderRevisionChanged,
  commanderSnapshotMayReplace,
} from "./commander-client-resync";

assert.equal(commanderMutationNeedsResync(409), true);
assert.equal(commanderMutationNeedsResync(400), false);
assert.equal(commanderMutationNeedsResync(500), false);

assert.equal(commanderRevisionChanged(7, 8), true);
assert.equal(commanderRevisionChanged(8, 8), false);
assert.equal(commanderRevisionChanged(undefined, 8), false);

assert.equal(commanderResumeNeedsResync("network_reconnect", true), true);
assert.equal(commanderResumeNeedsResync("window_focus", true), true);
assert.equal(commanderResumeNeedsResync("visibility_resume", true), true);
assert.equal(commanderResumeNeedsResync("mutation_conflict", true), false);
assert.equal(commanderResumeNeedsResync("network_reconnect", false), false);

assert.equal(commanderSnapshotMayReplace(8, 9), true);
assert.equal(commanderSnapshotMayReplace(9, 9), true);
assert.equal(commanderSnapshotMayReplace(10, 9), false);
assert.equal(commanderSnapshotMayReplace(undefined, 9), true);

console.log("COMMANDER CLIENT RESYNC CONTRACT: PASS");
