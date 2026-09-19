import assert from "node:assert/strict";
import {
  castGeneralFromZone,
  createGeneralZoneState,
  currentGeneralRecastTax,
  generalCastCost,
  moveGeneralFromBattlefield,
  resolveGeneralToBattlefield,
} from "./four-player-general-zone";

let general = createGeneralZoneState("p1", "general-alpha");
assert.equal(general.location, "general_zone");
assert.equal(currentGeneralRecastTax(general), 0);
assert.equal(generalCastCost(general, 5), 5);

general = castGeneralFromZone(general);
assert.equal(general.location, "stack");
assert.equal(general.castsFromGeneralZone, 1);
general = resolveGeneralToBattlefield(general);
assert.equal(general.location, "battlefield");

// Owner chooses the replacement and sends the General back to its public zone.
general = moveGeneralFromBattlefield(general, "graveyard", true);
assert.equal(general.location, "general_zone");
assert.equal(currentGeneralRecastTax(general), 2);
assert.equal(generalCastCost(general, 5), 7);

general = castGeneralFromZone(general);
general = resolveGeneralToBattlefield(general);
general = moveGeneralFromBattlefield(general, "exile", true);
assert.equal(currentGeneralRecastTax(general), 4);
assert.equal(generalCastCost(general, 5), 9);

// Declining replacement keeps the General in the destination zone and does not add tax.
let second = createGeneralZoneState("p2", "general-beta");
second = castGeneralFromZone(second);
second = resolveGeneralToBattlefield(second);
second = moveGeneralFromBattlefield(second, "graveyard", false);
assert.equal(second.location, "graveyard");
assert.equal(currentGeneralRecastTax(second), 2);

assert.throws(() => castGeneralFromZone(second), /only be cast from the General Zone/);
assert.throws(() => generalCastCost(general, -1), /cannot be negative/);

console.log("FOUR PLAYER GENERAL ZONE AND RECAST TAX: PASS");
