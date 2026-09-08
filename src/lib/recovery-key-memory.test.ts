import assert from "node:assert/strict";
import {
  clearPendingRecoveryKey,
  getPendingRecoveryKey,
  publishPendingRecoveryKey,
  subscribePendingRecoveryKey,
} from "./recovery-key-memory";

clearPendingRecoveryKey();
assert.equal(getPendingRecoveryKey(), null);

let notifications = 0;
const unsubscribe = subscribePendingRecoveryKey(() => { notifications += 1; });

const issued = "memory-only-recovery-key-1234567890";
publishPendingRecoveryKey(issued);
assert.equal(getPendingRecoveryKey(), issued);
assert.equal(notifications, 1);

publishPendingRecoveryKey("   ");
assert.equal(getPendingRecoveryKey(), null);
assert.equal(notifications, 2);

publishPendingRecoveryKey(issued);
assert.equal(getPendingRecoveryKey(), issued);
clearPendingRecoveryKey();
assert.equal(getPendingRecoveryKey(), null);
assert.equal(notifications, 4);

unsubscribe();
publishPendingRecoveryKey("another-memory-only-key-1234567890");
assert.equal(notifications, 4);
clearPendingRecoveryKey();

console.log("RECOVERY KEY MEMORY: PASS — recovery credentials are ephemeral observable state");
