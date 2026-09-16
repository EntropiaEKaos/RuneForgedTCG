import assert from "node:assert/strict";
import type { GameEvent } from "./events";
import { FORGED_FX_PRESETS, resolveGameEventBatchFx, resolveGameEventFx } from "./fx-registry";

for (const preset of Object.values(FORGED_FX_PRESETS)) {
  assert.ok(preset.durationMs > 0 && preset.durationMs <= 1000, `${preset.id}: invalid duration`);
  if ("particleBudget" in preset && preset.particleBudget !== undefined) assert.ok(preset.particleBudget <= 40, `${preset.id}: particle budget too high`);
}

const cases: Array<[GameEvent, string]> = [
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
];
for (const [event, expected] of cases) assert.equal(resolveGameEventFx(event)?.preset.id, expected);

const ordered: GameEvent[] = [
  { type: "UNIT_ATTACK_STARTED", player: "player", unitId: "u1" },
  { type: "UNIT_DAMAGED", player: "ai", unitId: "u2", amount: 4 },
  { type: "STATUS_REMOVED", player: "ai", unitId: "u2", status: "barrier" },
  { type: "UNIT_DIED", player: "ai", unitId: "u2", defId: "c2" },
];
assert.deepEqual(resolveGameEventBatchFx(ordered).map((fx) => fx.preset.id), ["attack-default", "damage-default", "barrierbreak-default", "death-default"]);
console.log("FX REGISTRY: PASS");
