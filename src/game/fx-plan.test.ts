import { describe, expect, it } from "vitest";
import { buildFxExecutionPlan, buildGameEventFxPlans } from "./fx-plan";
import { resolveGameEventFx } from "./fx-registry";

describe("FORGED FX execution plan", () => {
  const damage = resolveGameEventFx({ type: "UNIT_DAMAGED", player: "ai", unitId: "u1", amount: 3 });
  if (!damage) throw new Error("damage preset missing");

  it("preserves full cinematic budget on ultra", () => {
    const plan = buildFxExecutionPlan(damage, { quality: "ultra", reducedMotion: false, constrained: false });
    expect(plan.durationMs).toBe(damage.preset.durationMs);
    expect(plan.particleBudget).toBe(damage.preset.particleBudget);
    expect(plan.allowScreenShake).toBe(true);
    expect(plan.allowTargetFlash).toBe(true);
  });

  it("removes particles and shake for constrained clients", () => {
    const plan = buildFxExecutionPlan(damage, { quality: "high", reducedMotion: false, constrained: true });
    expect(plan.durationMs).toBeLessThanOrEqual(360);
    expect(plan.particleBudget).toBe(0);
    expect(plan.allowScreenShake).toBe(false);
  });

  it("honors reduced motion independently of requested quality", () => {
    const plan = buildFxExecutionPlan(damage, { quality: "ultra", reducedMotion: true, constrained: false });
    expect(plan.durationMs).toBeLessThanOrEqual(120);
    expect(plan.particleBudget).toBe(0);
    expect(plan.allowScreenShake).toBe(false);
    expect(plan.allowTargetFlash).toBe(false);
  });

  it("builds ordered plans from semantic event batches", () => {
    const plans = buildGameEventFxPlans([
      { type: "UNIT_ATTACK_STARTED", player: "player", unitId: "a" },
      { type: "UNIT_DAMAGED", player: "ai", unitId: "b", amount: 2 },
      { type: "UNIT_DIED", player: "ai", unitId: "b", defId: "card" },
    ], { quality: "medium", reducedMotion: false, constrained: false });
    expect(plans.map((plan) => plan.preset.id)).toEqual(["attack-default", "damage-default", "death-default"]);
  });
});
