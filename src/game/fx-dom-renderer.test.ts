import { describe, expect, it } from "vitest";
import { buildFxExecutionPlan } from "./fx-plan";
import { resolveGameEventFx } from "./fx-registry";
import { buildFxDomAnimation, playFxDomAnimation } from "./fx-dom-renderer";

function planForDamage() {
  const resolved = resolveGameEventFx({ type: "UNIT_DAMAGED", player: "ai", unitId: "u1", amount: 2 });
  if (!resolved) throw new Error("damage preset missing");
  return buildFxExecutionPlan(resolved, { quality: "high", reducedMotion: false, constrained: false });
}

describe("FORGED DOM FX renderer", () => {
  it("derives animation timing from the execution plan", () => {
    const plan = planForDamage();
    expect(buildFxDomAnimation(plan)?.options.duration).toBe(plan.durationMs);
  });

  it("does not invent a DOM animation for GPU-only presets", () => {
    const resolved = resolveGameEventFx({ type: "NEXUS_POISONED", player: "ai", amount: 1, total: 1 });
    if (!resolved) throw new Error("poison preset missing");
    const plan = buildFxExecutionPlan(resolved, { quality: "ultra", reducedMotion: false, constrained: false });
    expect(buildFxDomAnimation(plan)).toBeNull();
  });

  it("fails closed when no target element exists", () => {
    expect(playFxDomAnimation(null, planForDamage())).toBeNull();
  });

  it("swallows renderer failures so presentation cannot block gameplay", () => {
    const element = { animate: () => { throw new Error("renderer unavailable"); } } as unknown as Element;
    expect(playFxDomAnimation(element, planForDamage())).toBeNull();
  });
});
