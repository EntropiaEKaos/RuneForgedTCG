import { describe, expect, it } from "vitest";
import type { GameEvent } from "./events";
import { FORGED_FX_PRESETS, resolveGameEventBatchFx, resolveGameEventFx } from "./fx-registry";

describe("FORGED FX registry", () => {
  it("keeps presets bounded", () => {
    for (const preset of Object.values(FORGED_FX_PRESETS)) {
      expect(preset.durationMs).toBeGreaterThan(0);
      expect(preset.durationMs).toBeLessThanOrEqual(1000);
      if ("particleBudget" in preset && preset.particleBudget !== undefined) expect(preset.particleBudget).toBeLessThanOrEqual(40);
    }
  });

  it.each<[GameEvent, string]>([
    [{ type: "UNIT_SUMMONED", player: "player", unitId: "u1", defId: "c1" }, "summon-default"],
    [{ type: "UNIT_ATTACK_STARTED", player: "player", unitId: "u1" }, "attack-default"],
    [{ type: "UNIT_DAMAGED", player: "ai", unitId: "u2", amount: 3 }, "damage-default"],
    [{ type: "UNIT_HEALED", player: "player", unitId: "u1", amount: 2 }, "heal-default"],
    [{ type: "UNIT_DIED", player: "ai", unitId: "u2", defId: "c2" }, "death-default"],
    [{ type: "UNIT_LEVELLED_UP", player: "player", unitId: "u1", fromDefId: "c1", toDefId: "c2" }, "levelup-default"],
    [{ type: "STATUS_APPLIED", player: "player", unitId: "u1", status: "barrier" }, "barrier-default"],
    [{ type: "STATUS_APPLIED", player: "ai", unitId: "u2", status: "frostbitten" }, "frost-default"],
    [{ type: "STATUS_APPLIED", player: "ai", unitId: "u2", status: "stunned" }, "stun-default"],
    [{ type: "STATUS_REMOVED", player: "player", unitId: "u1", status: "barrier" }, "barrierbreak-default"],
    [{ type: "NEXUS_DAMAGED", player: "ai", amount: 4 }, "damage-default"],
    [{ type: "NEXUS_HEALED", player: "player", amount: 3 }, "heal-default"],
    [{ type: "NEXUS_POISONED", player: "ai", amount: 2, total: 6 }, "poison-default"],
  ])("resolves semantic event %#", (event, expected) => {
    expect(resolveGameEventFx(event)?.preset.id).toBe(expected);
  });

  it("preserves batch order including barrier break", () => {
    const events: GameEvent[] = [
      { type: "UNIT_ATTACK_STARTED", player: "player", unitId: "u1" },
      { type: "UNIT_DAMAGED", player: "ai", unitId: "u2", amount: 4 },
      { type: "STATUS_REMOVED", player: "ai", unitId: "u2", status: "barrier" },
      { type: "UNIT_DIED", player: "ai", unitId: "u2", defId: "c2" },
    ];
    expect(resolveGameEventBatchFx(events).map((fx) => fx.preset.id)).toEqual([
      "attack-default", "damage-default", "barrierbreak-default", "death-default",
    ]);
  });
});
