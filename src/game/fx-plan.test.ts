import assert from "node:assert/strict";
import { buildFxExecutionPlan, buildGameEventFxPlans } from "./fx-plan";
import { resolveGameEventFx } from "./fx-registry";

const damage = resolveGameEventFx({ type: "UNIT_DAMAGED", player: "ai", unitId: "u1", amount: 3 });
if (!damage) throw new Error("damage preset missing");

const ultra = buildFxExecutionPlan(damage, { quality: "ultra", reducedMotion: false, constrained: false });
assert.equal(ultra.durationMs, damage.preset.durationMs);
assert.equal(ultra.particleBudget, damage.preset.particleBudget);
assert.equal(ultra.allowScreenShake, true);
assert.equal(ultra.allowTargetFlash, true);

const constrained = buildFxExecutionPlan(damage, { quality: "high", reducedMotion: false, constrained: true });
assert.ok(constrained.durationMs <= 360);
assert.equal(constrained.particleBudget, 0);
assert.equal(constrained.allowScreenShake, false);

const reduced = buildFxExecutionPlan(damage, { quality: "ultra", reducedMotion: true, constrained: false });
assert.ok(reduced.durationMs <= 120);
assert.equal(reduced.particleBudget, 0);
assert.equal(reduced.allowScreenShake, false);
assert.equal(reduced.allowTargetFlash, false);

const plans = buildGameEventFxPlans([
  { type: "UNIT_ATTACK_STARTED", player: "player", unitId: "a" },
  { type: "UNIT_DAMAGED", player: "ai", unitId: "b", amount: 2 },
  { type: "UNIT_DIED", player: "ai", unitId: "b", defId: "card" },
], { quality: "medium", reducedMotion: false, constrained: false });
assert.deepEqual(plans.map((plan) => plan.preset.id), ["attack-default", "damage-default", "death-default"]);
console.log("FX PLAN: PASS");
