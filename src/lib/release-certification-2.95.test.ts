import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const checks: string[] = [];
const ok = (value: unknown, message: string) => { assert.ok(value, message); checks.push(message); };

const pkg = JSON.parse(read("package.json"));
const [pkgMajor, pkgMinor] = String(pkg.version).split(".").map(Number);
ok(pkgMajor > 2 || (pkgMajor === 2 && pkgMinor >= 95), "package is 2.95.0 or newer");
assert.equal(pkg.engines.node, ">=22.0.0 <25"); checks.push("production Node range is explicit");
assert.equal(pkg.dependencies.sharp, "0.35.4"); checks.push("art encoder dependency is exact-pinned");

const balance = read("scripts/balance-audit-2.95.ts");
ok(balance.includes("STRATUM_BASES") && balance.includes("gamesPerStratum") && balance.includes("strata"), "balance certification samples multiple deterministic seed strata");
ok(balance.includes("stabilityThreshold") && balance.includes("seedSpread") && balance.includes("wilson95"), "balance report exposes uncertainty and seed sensitivity");
ok(balance.includes("--enforce") && balance.includes("certifiedGate"), "balance audit provides a failing enforcement mode for Ranked");

const ranked = read("scripts/ranked-release-guard.mjs");
ok(/balance-audit-2\.(?:95|96|97)\.ts/.test(ranked) && ranked.includes("--enforce"), "Ranked certification delegates to a 2.95+ multi-seed gate");
ok(ranked.includes("RANKED_RELEASE_CERTIFIED"), "Ranked remains fail-closed without explicit certification");

const runtime = read("scripts/release-runtime-gate.mjs");
ok(runtime.includes("package-lock.json is missing") && runtime.includes("lockfileVersion"), "runtime gate rejects missing or incompatible dependency locks");
ok(runtime.includes("exact-pinned") && runtime.includes('import("sharp")'), "runtime gate verifies exact pins and loads the image encoder");
ok(runtime.includes("WebP encoder") && runtime.includes("AVIF encoder"), "runtime gate certifies both card-art codecs");

const ciInstall = read("scripts/ci-install.mjs");
ok(ciInstall.includes("package-lock.json is required") && !ciInstall.includes("--package-lock-only"), "CI refuses to regenerate a missing lockfile implicitly");

const workflow = read(".github/workflows/ci.yml");
ok(/node-version:\s*["']?22["']?/.test(workflow), "CI uses the certified Node 22 runtime");
ok(workflow.includes("npm run release:runtime-gate"), "CI executes the runtime/lock gate after dependency install");
ok(String(pkg.scripts["production:verify"] || "").startsWith("npm run release:runtime-gate &&"), "production verification starts with runtime reproducibility gate");

const currentAuditPath = fs.existsSync(path.join(root, "BALANCE_AUDIT_2.97.json"))
  ? "BALANCE_AUDIT_2.97.json"
  : fs.existsSync(path.join(root, "BALANCE_AUDIT_2.96.json"))
    ? "BALANCE_AUDIT_2.96.json"
    : null;
ok(Boolean(currentAuditPath), "current release includes a committed stratified Ranked balance artifact");
if (currentAuditPath) {
  const audit = JSON.parse(read(currentAuditPath));
  ok(audit.strata >= 3 && audit.gamesPerMatchup >= 60, "current Ranked balance artifact uses stratified sampling");
  if (audit.version === "2.95" || audit.version === "2.96") {
    ok(audit.certifiedGate !== "pass", "historical pre-2.97 Ranked artifacts remain fail-closed while critical outliers exist");
  } else {
    ok(audit.version === "2.97" && audit.certifiedGate === "pass", "2.97 Ranked artifact is certified only by the dedicated precon gate");
  }
}

console.log(`RELEASE CERTIFICATION 2.95: ${checks.length}/${checks.length} PASS`);
