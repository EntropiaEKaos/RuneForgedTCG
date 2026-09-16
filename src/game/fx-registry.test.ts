import { describe, expect, it } from "vitest";
import type { GameEvent } from "./events";
import { FORGED_FX_PRESETS, resolveGameEventBatchFx, resolveGameEventFx } from "./fx-registry";
describe("FORGED FX registry", () => {
  it("keeps presets bounded", () => { for (const preset of Object.values(FORGED_FX_PRESETS)) { expect(preset.durationMs).toBeGreaterThan(0); expect(preset.durationMs).toBeLessThanOrEqual(1000); if ("particleBudget" in preset && preset.particleBudget !== undefined) expect(preset.particleBudget).toBeLessThanOrEqual(40); } });
  it("resolves core semantic events", () => {
    expect(resolveGameEventFx({ type: "UNIT_SUMMONED", player: "player", unitId: "u1", defId: "c1" })?.preset.id).toBe("summon-default");
    expect(resolveGameEventFx({ type: "UNIT_ATTACK_STARTED", player: "player", unitId: "u1" })?.preset.id).toBe("attack-default");
    expect(resolveGameEventFx({ type: "UNIT_DAMAGED", player: "ai", unitId: "u2", amount: 3 })?.preset.id).toBe("damage-default");
    expect(resolveGameEventFx({ type: "STATUS_APPLIED", player: "ai", unitId: "u2", status: "frostbitten" })?.preset.id).toBe("frost-default");
  });
  it("keeps status removal silent in v1", () => { expect(resolveGameEventFx({ type: "STATUS_REMOVED", player: "player", unitId: "u1", status: "barrier" })).toBeNull(); });
  it("preserves batch order", () => { const events: GameEvent[] = [{ type: "UNIT_ATTACK_STARTED", player: "player", unitId: "u1" }, { type: "UNIT_DAMAGED", player: "ai", unitId: "u2", amount: 4 }, { type: "UNIT_DIED", player: "ai", unitId: "u2", defId: "c2" }]; expect(resolveGameEventBatchFx(events).map((fx) => fx.preset.id)).toEqual(["attack-default", "damage-default", "death-default"]); });
});
