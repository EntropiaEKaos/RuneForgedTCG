import assert from "node:assert/strict";
import {
  assertNoEliminatedController,
  cleanupObjectsForEliminatedSeat,
  type FourPlayerOwnedObject,
} from "./four-player-elimination";

const objects: FourPlayerOwnedObject[] = [
  { id: "p3-unit", kind: "unit", owner: "p3", controller: "p3" },
  { id: "p3-token", kind: "token", owner: "p3", controller: "p2", token: true },
  { id: "p1-stolen-by-p3", kind: "unit", owner: "p1", controller: "p3" },
  { id: "p2-permanent", kind: "permanent", owner: "p2", controller: "p2" },
  { id: "p4-sentinela", kind: "sentinela", owner: "p4", controller: "p4" },
  { id: "p3-stack", kind: "stack", owner: "p3", controller: "p3" },
  { id: "p3-delayed", kind: "delayed_trigger", owner: "p3", controller: "p3" },
];

const cleanup = cleanupObjectsForEliminatedSeat(objects, "p3");
assert.deepEqual(cleanup.removedObjectIds.sort(), ["p3-delayed", "p3-stack", "p3-token", "p3-unit"].sort());
assert.deepEqual(cleanup.returnedToOwnerControlIds, ["p1-stolen-by-p3"]);

const returned = cleanup.survivingObjects.find((object) => object.id === "p1-stolen-by-p3");
assert.equal(returned?.owner, "p1");
assert.equal(returned?.controller, "p1");
assert.ok(cleanup.survivingObjects.some((object) => object.id === "p2-permanent"));
assert.ok(cleanup.survivingObjects.some((object) => object.id === "p4-sentinela"));
assertNoEliminatedController(cleanup.survivingObjects, "p3");

assert.throws(
  () => assertNoEliminatedController([{ id: "bad", kind: "unit", owner: "p1", controller: "p3" }], "p3"),
  /left controller p3/,
);

console.log("FOUR PLAYER ELIMINATION CLEANUP: PASS");
