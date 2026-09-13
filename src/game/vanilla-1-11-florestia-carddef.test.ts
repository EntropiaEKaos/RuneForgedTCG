import assert from "node:assert/strict";
import { getCard } from "./cards";
import { VANILLA_1_11_CARD_OVERRIDES } from "./cards/vanilla/balance-1-11";
import { VANILLA_FLORESTIA_CARDS } from "./cards/vanilla/forest";

const source = VANILLA_FLORESTIA_CARDS.van_forest_u04;
assert.ok(source, "Historical Florestia source must contain Caçadora da Alcateia");
assert.equal(source.cost, 2);
assert.equal(source.power, 2);
assert.equal(source.health, 3, "Historical regional snapshot must remain unchanged");
assert.equal(source.race, "Besta");
assert.equal(source.trigger?.when, "onSummon");
assert.equal(source.trigger?.effect.kind, "buffAllies");
assert.equal(source.trigger?.effect.buffPower, 1);
assert.equal(source.trigger?.effect.buffHealth, 0);

assert.deepEqual(
  Object.keys(VANILLA_1_11_CARD_OVERRIDES),
  ["van_forest_u04"],
  "Vanilla 1.11 may override exactly one CardDef",
);

const override = VANILLA_1_11_CARD_OVERRIDES.van_forest_u04;
assert.ok(override);
assert.equal(override.cost, source.cost, "Vanilla 1.11 may not change Caçadora cost");
assert.equal(override.power, source.power, "Vanilla 1.11 may not change Caçadora power");
assert.equal(override.health, 4, "Vanilla 1.11 promotes only +1 health");
assert.equal(override.race, source.race, "Vanilla 1.11 may not change race taxonomy");
assert.deepEqual(override.trigger, source.trigger, "Vanilla 1.11 may not change the on-summon effect");

const runtime = getCard("van_forest_u04");
assert.equal(runtime.cost, 2);
assert.equal(runtime.power, 2);
assert.equal(runtime.health, 4, "Runtime catalog must expose the certified 1.11 2/4 body");
assert.equal(runtime.race, "Besta");
assert.deepEqual(runtime.trigger, source.trigger);

console.log("Vanilla 1.11 Florestia CardDef contract: PASS");
