import assert from "node:assert/strict";
import { ABILITY_FEATURE_SUPPORT } from "./ability-system";
import { EFFECT_CHAIN_AUTHORING_CONTRACT } from "./effect-chain-contract";

assert.equal(ABILITY_FEATURE_SUPPORT.chained, "supported");
assert.equal(EFFECT_CHAIN_AUTHORING_CONTRACT.support, ABILITY_FEATURE_SUPPORT.chained);
assert.equal(EFFECT_CHAIN_AUTHORING_CONTRACT.execution, "sequential");

console.log("EFFECT CHAIN GRAMMAR CONTRACT: PASS — chained remains supported and sequential under the canonical authoring boundary");
