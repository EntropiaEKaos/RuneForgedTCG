import assert from "node:assert/strict";
import {
  assertFourPlayerAttackerObject,
  assertFourPlayerBlockerObject,
  cleanupFourPlayerBattlefieldForElimination,
  createFourPlayerBattlefieldState,
  markFourPlayerBattlefieldObjectAttacked,
  placeResolvedGeneralOnBattlefield,
  putFourPlayerBattlefieldObject,
  resetFourPlayerBattlefieldForTurn,
} from "./four-player-battlefield";
import { collectibleCards } from "./cards";

let battlefield = createFourPlayerBattlefieldState();
battlefield = putFourPlayerBattlefieldObject(battlefield, {
  id: "p1-slow",
  defId: "fixture-slow",
  kind: "unit",
  ownerSeat: "p1",
  enteredTurn: 1,
});
battlefield = putFourPlayerBattlefieldObject(battlefield, {
  id: "p1-haste",
  defId: "fixture-haste",
  kind: "unit",
  ownerSeat: "p1",
  enteredTurn: 1,
  keywords: ["Haste"],
});
battlefield = putFourPlayerBattlefieldObject(battlefield, {
  id: "p2-guard",
  defId: "fixture-guard",
  kind: "unit",
  ownerSeat: "p2",
  enteredTurn: 0,
});
battlefield = putFourPlayerBattlefieldObject(battlefield, {
  id: "p1-stolen-by-p3",
  defId: "fixture-stolen",
  kind: "unit",
  ownerSeat: "p1",
  controllerSeat: "p3",
  enteredTurn: 0,
});
battlefield = putFourPlayerBattlefieldObject(battlefield, {
  id: "p3-owned",
  defId: "fixture-p3",
  kind: "unit",
  ownerSeat: "p3",
  enteredTurn: 0,
});

assert.throws(
  () => assertFourPlayerAttackerObject(battlefield, "p1", "forged-client-id", 1),
  /is not present/,
);
assert.throws(
  () => assertFourPlayerAttackerObject(battlefield, "p1", "p1-slow", 1),
  /summoning sickness/,
);
assert.equal(assertFourPlayerAttackerObject(battlefield, "p1", "p1-haste", 1).id, "p1-haste");
assert.throws(
  () => assertFourPlayerAttackerObject(battlefield, "p1", "p2-guard", 2),
  /does not control attacker/,
);
assert.equal(assertFourPlayerBlockerObject(battlefield, "p2", "p2-guard").id, "p2-guard");
assert.throws(
  () => assertFourPlayerBlockerObject(battlefield, "p3", "p2-guard"),
  /does not control blocker/,
);

battlefield = markFourPlayerBattlefieldObjectAttacked(battlefield, "p1-haste");
assert.throws(
  () => assertFourPlayerAttackerObject(battlefield, "p1", "p1-haste", 2),
  /already attacked/,
);
battlefield = resetFourPlayerBattlefieldForTurn(battlefield, "p1");
assert.equal(assertFourPlayerAttackerObject(battlefield, "p1", "p1-haste", 2).attackedThisTurn, false);

const cleanup = cleanupFourPlayerBattlefieldForElimination(battlefield, "p3");
assert.equal(cleanup.removedObjectIds.includes("p3-owned"), true);
assert.equal(cleanup.returnedToOwnerControlIds.includes("p1-stolen-by-p3"), true);
assert.equal(cleanup.state.objects.find((object) => object.id === "p1-stolen-by-p3")?.controllerSeat, "p1");
assert.equal(cleanup.state.objects.some((object) => object.ownerSeat === "p3"), false);

const catalogCard = collectibleCards().find((card) => card.collectible !== false);
assert.ok(catalogCard, "fixture requires at least one collectible catalog card");
const withGeneral = placeResolvedGeneralOnBattlefield(
  createFourPlayerBattlefieldState(),
  "p4",
  catalogCard.defId,
  1,
  3,
);
const general = withGeneral.objects[0];
assert.equal(general?.id, "general:p4:1");
assert.equal(general?.ownerSeat, "p4");
assert.equal(general?.controllerSeat, "p4");
assert.equal(general?.zone, "battlefield");

console.log("FOUR PLAYER BATTLEFIELD AUTHORITY: PASS — ownership, control, eligibility, General presence and elimination cleanup");
