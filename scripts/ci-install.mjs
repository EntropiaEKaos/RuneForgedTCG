import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

if (!existsSync("package-lock.json")) {
  console.error("CI INSTALL: package-lock.json is required. Run npm run lock:refresh on a registry-connected machine, review it, and commit it before CI/production.");
  process.exit(1);
}

const result = spawnSync(npm, ["ci", "--no-audit", "--no-fund"], { stdio: "inherit", env: process.env });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
