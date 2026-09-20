import assert from "node:assert/strict";
import {
  applyFourPlayerBattlefieldDamage,
  assertFourPlayerAttackerObject,
  assertFourPlayerBlockerObject,
  createFourPlayerBattlefieldState,
  findFourPlayerBattlefieldObject,
  putFourPlayerBattlefieldObject,
} from "./four-player-battlefield";
import { collectibleCards } from "./cards";
import { createFourPlayerCombatBodySnapshot } from "./four-player-combat-body";

const unit = collectibleCards().find((card) => card.collectible !== false && card.type === "Unit");
assert.ok(unit, "fixture requires a collectible Unit");
const body = createFourPlayerCombatBodySnapshot(unit);
assert.ok(body);
assert.equal(body.basePower, unit.power ?? 0);
assert.equal(body.power, unit.power ?? 0);
assert.equal(body.health, unit.health ?? 1);
assert.equal(body.maxHealth, unit.health ?? 1);
assert.equal(body.barrier, Boolean(unit.keywords?.includes("Barrier")));
assert.equal(body.frostbitten, false);
assert.deepEqual(body.classes, unit.classes ?? []);
if (unit.race) assert.equal(body.races.includes(unit.race), true);

let battlefield = createFourPlayerBattlefieldState();
battlefield = putFourPlayerBattlefieldObject(battlefield, {
  id: "target",
  defId: "fixture-target",
  kind: "unit",
  ownerSeat: "p2",
  controllerSeat: "p2",
  enteredTurn: 0,
  keywords: ["Barrier", "Tough"],
  combat: {
    basePower: 3,
    power: 3,
    health: 5,
    maxHealth: 5,
    races: [],
    classes: [],
    barrier: true,
    frostbitten: false,
  },
});
battlefield = putFourPlayerBattlefieldObject(battlefield, {
  id: "wither-source",
  defId: "fixture-wither",
  kind: "unit",
  ownerSeat: "p1",
  controllerSeat: "p1",
  enteredTurn: 0,
  keywords: ["Wither"],
  combat: {
    basePower: 3,
    power: 3,
    health: 3,
    maxHealth: 3,
    races: [],
    classes: [],
    barrier: false,
    frostbitten: false,
  },
});

let damage = applyFourPlayerBattlefieldDamage(battlefield, "target", 3, "wither-source");
assert.equal(damage.damageDealt, 0);
assert.equal(damage.barrierConsumed, true);
assert.equal(damage.destroyed, false);
assert.equal(findFourPlayerBattlefieldObject(damage.state, "target").combat?.health, 5);
assert.equal(findFourPlayerBattlefieldObject(damage.state, "target").combat?.barrier, false);

damage = applyFourPlayerBattlefieldDamage(damage.state, "target", 3, "wither-source");
assert.equal(damage.damageDealt, 2, "Tough reduces incoming damage by one");
assert.equal(findFourPlayerBattlefieldObject(damage.state, "target").combat?.health, 3);
assert.equal(findFourPlayerBattlefieldObject(damage.state, "target").combat?.maxHealth, 3, "Wither permanently reduces max health");

let lethalBoard = putFourPlayerBattlefieldObject(createFourPlayerBattlefieldState(), {
  id: "victim",
  defId: "fixture-victim",
  kind: "unit",
  ownerSeat: "p2",
  enteredTurn: 0,
  combat: {
    basePower: 5,
    power: 5,
    health: 5,
    maxHealth: 5,
    races: [],
    classes: [],
    barrier: false,
    frostbitten: false,
  },
});
lethalBoard = putFourPlayerBattlefieldObject(lethalBoard, {
  id: "deathtouch-source",
  defId: "fixture-deathtouch",
  kind: "unit",
  ownerSeat: "p1",
  enteredTurn: 0,
  keywords: ["Deathtouch"],
  combat: {
    basePower: 1,
    power: 1,
    health: 1,
    maxHealth: 1,
    races: [],
    classes: [],
    barrier: false,
    frostbitten: false,
  },
});
const lethal = applyFourPlayerBattlefieldDamage(lethalBoard, "victim", 1, "deathtouch-source");
assert.equal(lethal.destroyed, true);
assert.equal(findFourPlayerBattlefieldObject(lethal.state, "victim").combat?.health, 0);
assert.throws(() => assertFourPlayerAttackerObject(lethal.state, "p2", "victim", 2), /Destroyed object/);
assert.throws(() => assertFourPlayerBlockerObject(lethal.state, "p2", "victim"), /Destroyed object/);

const nonUnit = collectibleCards().find((card) => card.collectible !== false && card.type !== "Unit");
if (nonUnit) assert.equal(createFourPlayerCombatBodySnapshot(nonUnit), undefined);

console.log("FOUR PLAYER COMBAT BODY AUTHORITY: PASS — catalog stats, Barrier, Tough, Wither, Deathtouch and dead-body legality");
