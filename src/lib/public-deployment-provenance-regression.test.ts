import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("src/app/api/public/game/deployment/provenance/route.ts", "utf8");
const helper = fs.readFileSync("src/lib/deployment-provenance.ts", "utf8");
const preflight = fs.readFileSync("scripts/release-preflight.ts", "utf8");
const rcWorkflow = fs.readFileSync(".github/workflows/alpha-release-candidate.yml", "utf8");
const ciWorkflow = fs.readFileSync(".github/workflows/ci.yml", "utf8");
const evidence = fs.readFileSync("scripts/alpha-release-candidate-evidence.mjs", "utf8");
const netlify = fs.readFileSync("netlify.toml", "utf8");
const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8")) as { buildCommand?: string };
const vercelBuild = fs.readFileSync("scripts/vercel-certified-build.mjs", "utf8");

for (const marker of [
  "readDeploymentProvenance",
  "APP_RELEASE",
  "ENGINE_VERSION",
  "RULESET_VERSION",
  "CONTENT_VERSION",
  "schemaVersion: 1",
  "status: 503",
  "Retry-After",
  "no-store",
]) assert.ok(route.includes(marker), `public provenance route must contain: ${marker}`);

assert.doesNotMatch(route, /DATABASE_URL|ADMIN_|PAYMENT_|SECRET|isAdminAuthorized|db\./);

assert.match(helper, /RUNEFORGE_DEPLOY_SHA/);
assert.match(helper, /RUNEFORGE_DEPLOY_ENV/);
assert.match(helper, /\^\[0-9a-f\]\{40\}\$/);
assert.match(helper, /"ci", "preview", "alpha", "staging", "production"/);
assert.doesNotMatch(helper, /DATABASE_URL|ADMIN_|PAYMENT_|SECRET/);

for (const source of [rcWorkflow, ciWorkflow]) {
  assert.match(source, /RUNEFORGE_DEPLOY_SHA:/);
  assert.match(source, /github\.sha/);
  assert.match(source, /RUNEFORGE_DEPLOY_ENV:/);
}

assert.match(rcWorkflow, /RUNEFORGE_DEPLOY_ENV:\s*alpha/);
assert.match(ciWorkflow, /RUNEFORGE_DEPLOY_ENV:\s*ci/);
assert.match(preflight, /RUNEFORGE_DEPLOY_SHA/);
assert.match(preflight, /RUNEFORGE_DEPLOY_ENV/);
assert.match(preflight, /GITHUB_SHA/);
assert.match(evidence, /deployment\/provenance/);
assert.match(evidence, /provenance commit matches exact workflow SHA/);
assert.match(evidence, /provenance environment is alpha/);

assert.match(netlify, /RUNEFORGE_DEPLOY_SHA=\$COMMIT_REF npm run production:verify/);
assert.equal(vercel.buildCommand, "node scripts/vercel-certified-build.mjs");
for (const marker of [
  "VERCEL_GIT_COMMIT_SHA",
  "VERCEL_ENV",
  "RUNEFORGE_DEPLOY_SHA",
  "RUNEFORGE_DEPLOY_ENV",
  "production:verify",
  "alpha:verify",
  "production",
  "preview",
]) assert.ok(vercelBuild.includes(marker), `Vercel certified build must contain: ${marker}`);
assert.match(vercelBuild, /environment\s*===\s*"production"\s*\?\s*"production:verify"\s*:\s*"alpha:verify"/);
assert.match(vercelBuild, /\^\[0-9a-f\]\{40\}\$/);
assert.match(vercelBuild, /spawnSync/);
assert.doesNotMatch(vercelBuild, /DATABASE_URL|ADMIN_|PAYMENT_|SECRET/);

console.log("PUBLIC DEPLOYMENT PROVENANCE SOURCE CONTRACT: PASS — provider-neutral identity · Netlify + Vercel certified adapters · production fail-closed · preview secret-isolated · SHA-bound");
