import assert from "node:assert/strict";
import { BattlefieldPresentationEventQueue } from "./BattlefieldPresentationEventQueue";

const queue = new BattlefieldPresentationEventQueue();
const first = queue.enqueue({ type: "priority", playerId: "p1" });
const second = queue.enqueue({ type: "damage", targetId: "unit-2", amount: 3 });
const third = queue.enqueue({ type: "death", entityId: "unit-2" });

assert.equal(first.sequence, 1);
assert.equal(second.sequence, 2);
assert.equal(third.sequence, 3);
assert.equal(queue.size, 3);

const batch = queue.drain(2);
assert.deepEqual(batch.map((item) => item.sequence), [1, 2]);
assert.equal(queue.size, 1);

const remainder = queue.drain();
assert.deepEqual(remainder.map((item) => item.sequence), [3]);
assert.equal(queue.size, 0);

queue.enqueue({ type: "elimination", playerId: "p4" });
queue.clear();
assert.equal(queue.size, 0);
