import { spawnSync } from "node:child_process";

const sha = String(process.env.VERCEL_GIT_COMMIT_SHA || "").trim().toLowerCase();
const environment = String(process.env.VERCEL_ENV || "").trim().toLowerCase();

if (!/^[0-9a-f]{40}$/.test(sha)) {
  throw new Error("VERCEL CERTIFIED BUILD: VERCEL_GIT_COMMIT_SHA must be an exact 40-character Git SHA");
}
if (!new Set(["production", "preview"]).has(environment)) {
  throw new Error(`VERCEL CERTIFIED BUILD: unsupported VERCEL_ENV ${JSON.stringify(environment)}; expected production or preview`);
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const verifyScript = environment === "production" ? "production:verify" : "alpha:verify";
const childEnv = {
  ...process.env,
  RUNEFORGE_DEPLOY_SHA: sha,
  RUNEFORGE_DEPLOY_ENV: environment,
};

console.log(`VERCEL CERTIFIED BUILD: binding ${environment}@${sha.slice(0, 12)} to RuneForge deploy provenance`);
console.log(`VERCEL CERTIFIED BUILD: running ${verifyScript}`);
const result = spawnSync(npmCommand, ["run", verifyScript], {
  cwd: process.cwd(),
  env: childEnv,
  stdio: "inherit",
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`VERCEL CERTIFIED BUILD: PASS — ${environment}@${sha.slice(0, 12)} passed ${verifyScript}`);
