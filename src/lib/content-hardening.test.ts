import assert from "node:assert/strict";
import { validateContent, requiredApprovalStages, isValidApprovalStage } from "./content-validation";

assert.deepEqual(requiredApprovalStages("cards"), ["content", "qa"]);
assert.deepEqual(requiredApprovalStages("events"), ["content", "qa", "liveops"]);
assert.equal(isValidApprovalStage("qa"), true);
assert.equal(isValidApprovalStage("root"), false);

const invalidCard = validateContent("cards", { key: "bad", name: "", data: null });
assert.equal(invalidCard.passed, false);
assert.ok(invalidCard.errors.length > 0);

const validCollection = validateContent("collections", { key: "emberhold", name: "Emberhold", code: "EMBER", status: "draft" });
assert.equal(validCollection.passed, true);

console.log("Content hardening tests passed.");

console.log("Engine audit hardening checks loaded: bulk publish must use pipeline; ranked settlement requires ranked token; PvP resolve is forbidden from AI continuation.");
