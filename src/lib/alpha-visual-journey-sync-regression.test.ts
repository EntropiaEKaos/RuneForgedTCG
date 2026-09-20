import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const script = readFileSync(resolve("scripts/alpha-visual-journey.mjs"), "utf8");
const start = script.indexOf("async function driveMatchToResult");
const end = script.indexOf("async function navigate", start);
assert.ok(start >= 0 && end > start, "Alpha Visual Journey driveMatchToResult contract must exist");
const driver = script.slice(start, end);

for (const control of [
  "Encerrar turno",
  "Passar prioridade e resolver",
  "Confirmar bloqueios",
]) {
  assert.match(driver, new RegExp(control), `Alpha Visual Journey must drive the visible control: ${control}`);
}
assert.match(driver, /waitForMatchDriverProgress/, "Alpha Visual Journey must await observable match progress after every automated action");
assert.doesNotMatch(driver, /pressKey\(/, "Alpha Visual Journey must not regress to blind keyboard action spam");
assert.match(script, /lastAction:/, "progress snapshots must include the battle log fingerprint");
assert.match(script, /reaction:/, "progress snapshots must include the reaction-stack fingerprint");

console.log("ALPHA VISUAL JOURNEY SYNC: PASS — visible controls and observable-state synchronization guard post-game action races");
