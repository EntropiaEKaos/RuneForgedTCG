import { spawnSync } from "node:child_process";

const failures = [];
const explicitOptIn = process.env.RUNEFORGE_NETLIFY_CERTIFIED === "true";
const commitRef = (process.env.COMMIT_REF || "").trim().toLowerCase();
const deploySha = (process.env.RUNEFORGE_DEPLOY_SHA || "").trim().toLowerCase();
const deployEnvironment = (process.env.RUNEFORGE_DEPLOY_ENV || "").trim().toLowerCase();

if (!explicitOptIn) {
  failures.push("RUNEFORGE_NETLIFY_CERTIFIED=true is required; Netlify deploys are fail-closed by default");
}
if (!/^[0-9a-f]{40}$/.test(commitRef)) {
  failures.push("COMMIT_REF must be the exact 40-character Netlify Git commit SHA");
}
if (!/^[0-9a-f]{40}$/.test(deploySha)) {
  failures.push("RUNEFORGE_DEPLOY_SHA must be configured with the exact 40-character deploy SHA");
}
if (commitRef && deploySha && commitRef !== deploySha) {
  failures.push(`RUNEFORGE_DEPLOY_SHA (${deploySha}) must match Netlify COMMIT_REF (${commitRef}) exactly`);
}
if (!["alpha", "staging", "production"].includes(deployEnvironment)) {
  failures.push("RUNEFORGE_DEPLOY_ENV must be alpha, staging or production for a certified Netlify deploy");
}

if (failures.length) {
  for (const failure of failures) console.error(`NETLIFY CERTIFIED BUILD: FAIL — ${failure}`);
  process.exit(1);
}

console.log(`NETLIFY CERTIFIED BUILD: preflight PASS — ${deployEnvironment}@${deploySha.slice(0, 12)}`);
const result = spawnSync("npm", ["run", "production:verify"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`NETLIFY CERTIFIED BUILD: PASS — ${deployEnvironment}@${deploySha.slice(0, 12)}`);
