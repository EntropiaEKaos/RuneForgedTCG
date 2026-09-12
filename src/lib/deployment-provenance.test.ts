import assert from "node:assert/strict";
import { DEPLOYMENT_ENVIRONMENTS, readDeploymentProvenance } from "./deployment-provenance";

const sha = "CC1D0DE2251F880CAD9CEC81600B7AE190E75AA3";
const alpha = readDeploymentProvenance({
  RUNEFORGE_DEPLOY_SHA: sha,
  RUNEFORGE_DEPLOY_ENV: "ALPHA",
});

assert.deepEqual(alpha, {
  commitSha: sha.toLowerCase(),
  commitShort: sha.toLowerCase().slice(0, 12),
  environment: "alpha",
});
const embedded = readDeploymentProvenance({
  RUNEFORGE_BUILD_SHA: sha,
  RUNEFORGE_BUILD_ENV: "PREVIEW",
});
assert.deepEqual(embedded, {
  commitSha: sha.toLowerCase(),
  commitShort: sha.toLowerCase().slice(0, 12),
  environment: "preview",
});
const explicitWins = readDeploymentProvenance({
  RUNEFORGE_DEPLOY_SHA: sha,
  RUNEFORGE_DEPLOY_ENV: "ALPHA",
  RUNEFORGE_BUILD_SHA: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  RUNEFORGE_BUILD_ENV: "preview",
});
assert.equal(explicitWins?.commitSha, sha.toLowerCase());
assert.equal(explicitWins?.environment, "alpha");
assert.ok(DEPLOYMENT_ENVIRONMENTS.includes("production"));
assert.equal(readDeploymentProvenance({ RUNEFORGE_DEPLOY_SHA: "abc", RUNEFORGE_DEPLOY_ENV: "alpha" }), null);
assert.equal(readDeploymentProvenance({ RUNEFORGE_DEPLOY_SHA: sha, RUNEFORGE_DEPLOY_ENV: "local" }), null);
assert.equal(readDeploymentProvenance({ RUNEFORGE_DEPLOY_SHA: sha }), null);
assert.equal(readDeploymentProvenance({ RUNEFORGE_DEPLOY_ENV: "alpha" }), null);

console.log("PUBLIC DEPLOYMENT PROVENANCE: PASS — exact Git SHA + bounded runtime/build identity");
