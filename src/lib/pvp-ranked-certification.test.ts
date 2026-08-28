import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { calculateMmrChange, getRankTier, progressWithinTier } from "./ranked";
import { isValidPvpActionId } from "./pvp-action-id";

assert.equal(isValidPvpActionId(randomUUID()), true);
assert.equal(isValidPvpActionId("short"), false);
assert.equal(isValidPvpActionId("invalid action id"), false);
assert.equal(isValidPvpActionId("a".repeat(81)), false);

assert.ok(calculateMmrChange(1000, 1000, true, false) > 0);
assert.ok(calculateMmrChange(1000, 1000, false, false) < 0);
assert.ok(Math.abs(calculateMmrChange(1000, 1000, true, true)) > Math.abs(calculateMmrChange(1000, 1000, true, false)));
assert.equal(getRankTier(0).name, "Bronze");
assert.equal(getRankTier(2300).name, "Grão-Mestre");
assert.equal(progressWithinTier(1249).pct <= 100, true);

console.log("PVP/RANKED CERTIFICATION: PASS");
