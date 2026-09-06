import assert from "node:assert/strict";
import { buildPublicAlphaReadiness } from "./public-alpha-readiness";

const versions = {
  release: "2.97.0",
  engineVersion: "2.96.0",
  rulesetVersion: "2026.08.96",
  contentVersion: "2026.08.25.93",
};

const ready = buildPublicAlphaReadiness({
  maintenanceMode: false,
  aiEnabled: true,
  rankedEnabled: false,
  rankedConfigured: false,
  rankedCertified: false,
}, versions);

assert.equal(ready.alpha, "playable");
assert.equal(ready.state, "ready");
assert.equal(ready.entryRoute, "/play");
assert.equal(ready.capabilities.length, 7);
assert.ok(ready.capabilities.every((item) => item.status === "available"));
assert.equal(ready.boundaries.rankedPublicLaunchRequirement, false);
assert.equal(ready.boundaries.realMoneyPaymentsLaunchRequirement, false);
assert.equal(ready.boundaries.largeScaleLiveOpsLaunchRequirement, false);
assert.equal(ready.boundaries.rankedOperational, false);
assert.deepEqual(ready.release, versions);

const limited = buildPublicAlphaReadiness({
  maintenanceMode: false,
  aiEnabled: false,
  rankedEnabled: false,
  rankedConfigured: false,
  rankedCertified: false,
}, versions);
assert.equal(limited.state, "limited");
assert.equal(limited.capabilities.find((item) => item.key === "pve")?.status, "temporarily-unavailable");
assert.equal(limited.capabilities.find((item) => item.key === "casual-pvp")?.status, "available");
assert.equal(limited.capabilities.find((item) => item.key === "forge")?.status, "available");

const maintenance = buildPublicAlphaReadiness({
  maintenanceMode: true,
  aiEnabled: true,
  rankedEnabled: true,
  rankedConfigured: true,
  rankedCertified: true,
}, versions);
assert.equal(maintenance.state, "maintenance");
assert.ok(maintenance.capabilities.every((item) => item.status === "temporarily-unavailable"));
assert.equal(maintenance.boundaries.rankedOperational, true, "runtime Ranked status remains observable but outside Alpha launch scope");

for (const item of ready.capabilities) {
  assert.match(item.route, /^\/(play|forge|profile|pvp)$/);
}

console.log("PUBLIC ALPHA READINESS: PASS — ready · limited · maintenance · certified Alpha boundary");
