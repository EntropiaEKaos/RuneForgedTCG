import assert from "node:assert/strict";
import { buildFxExecutionPlan } from "./fx-plan";
import { resolveGameEventFx } from "./fx-registry";
import { buildFxDomAnimation, playFxDomAnimation } from "./fx-dom-renderer";

function planForDamage() {
  const resolved = resolveGameEventFx({ type: "UNIT_DAMAGED", player: "ai", unitId: "u1", amount: 2 });
  if (!resolved) throw new Error("damage preset missing");
  return buildFxExecutionPlan(resolved, { quality: "high", reducedMotion: false, constrained: false });
}

const damage = planForDamage();
assert.equal(buildFxDomAnimation(damage)?.options.duration, damage.durationMs);

const poison = resolveGameEventFx({ type: "NEXUS_POISONED", player: "ai", amount: 1, total: 1 });
if (!poison) throw new Error("poison preset missing");
const poisonPlan = buildFxExecutionPlan(poison, { quality: "ultra", reducedMotion: false, constrained: false });
assert.equal(buildFxDomAnimation(poisonPlan), null);

assert.equal(playFxDomAnimation(null, damage), null);
const brokenElement = { animate: () => { throw new Error("renderer unavailable"); } } as unknown as Element;
assert.equal(playFxDomAnimation(brokenElement, damage), null);
console.log("FX DOM RENDERER: PASS");
