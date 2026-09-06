import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const workflow = read(".github/workflows/alpha-release-candidate.yml");
const evidence = read("scripts/alpha-release-candidate-evidence.mjs");
const pkg = JSON.parse(read("package.json"));
const releaseDocs = read("docs/ALPHA-RELEASE-CANDIDATE-1-0.md");

for (const marker of [
  "workflow_dispatch:",
  "branches: [main]",
  "postgres:17-alpine@sha256:",
  "npm ci --no-audit --no-fund",
  "npm run release:runtime-gate",
  "npm run db:bootstrap",
  "npm run production:verify",
  "npm run test:e2e:alpha-journey",
  "node scripts/alpha-casual-pvp-journey.mjs",
  "node scripts/alpha-visual-journey.mjs",
  "npm run alpha:release-evidence",
  "actions/upload-artifact@",
]) {
  assert.ok(workflow.includes(marker), `Alpha RC workflow must contain: ${marker}`);
}

assert.match(workflow, /RANKED_RELEASE_CERTIFIED:\s*["']false["']/);
assert.ok(!workflow.includes("RANKED_RELEASE_CERTIFIED: \"true\""));
assert.ok(!workflow.includes("npm run ranked:verify"), "Public Alpha RC must not promote Ranked into the launch gate");
assert.ok(!workflow.includes("RUN_DB_LOCK_SMOKE=1"), "RC must not require a pre-existing production player row");

for (const key of [
  "onboarding",
  "deck-selection",
  "mulligan",
  "pve",
  "forge",
  "rewards-progression",
  "casual-pvp",
]) {
  assert.ok(evidence.includes(`"${key}"`), `Evidence manifest must certify capability ${key}`);
}

for (const marker of [
  "cache-control",
  "no-store",
  "rankedPublicLaunchRequirement",
  "realMoneyPaymentsLaunchRequirement",
  "largeScaleLiveOpsLaunchRequirement",
  "rankedOperational",
  "manifest.json",
]) {
  assert.ok(evidence.includes(marker), `Evidence script must guard: ${marker}`);
}

assert.equal(pkg.scripts["alpha:release-evidence"], "node scripts/alpha-release-candidate-evidence.mjs");
assert.ok(releaseDocs.includes("exact merge SHA"));
assert.match(releaseDocs, /Ranked remains outside/i);
assert.match(releaseDocs, /real-money payments remain outside/i);

console.log("ALPHA RELEASE CANDIDATE SOURCE CONTRACT: PASS");
