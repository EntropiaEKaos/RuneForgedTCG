import fs from "node:fs";
import path from "node:path";
import packageMetadata from "../package.json" with { type: "json" };

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const artifactDir = path.resolve(process.env.ALPHA_RC_ARTIFACT_DIR || "artifacts/alpha-release-candidate");
const manifestPath = path.join(artifactDir, "manifest.json");
const expectedCapabilityKeys = [
  "onboarding",
  "deck-selection",
  "mulligan",
  "pve",
  "forge",
  "rewards-progression",
  "casual-pvp",
];

function serializeError(error) {
  return error instanceof Error ? error.message : String(error);
}

async function main() {
  fs.mkdirSync(artifactDir, { recursive: true });
  const checks = [];
  const add = (name, ok, detail = "") => checks.push({ name, ok: Boolean(ok), detail });

  let status = 0;
  let cacheControl = "";
  let payload = null;
  let requestError = null;

  try {
    const response = await fetch(`${baseUrl}/api/public/game/alpha/readiness`, { cache: "no-store" });
    status = response.status;
    cacheControl = response.headers.get("cache-control") || "";
    payload = await response.json();
  } catch (error) {
    requestError = serializeError(error);
  }

  add("readiness request", !requestError, requestError || `HTTP ${status}`);
  add("readiness HTTP 200", status === 200, `status=${status}`);
  add("readiness is no-store", /(?:^|,)\s*no-store(?:,|$)/i.test(cacheControl), cacheControl || "missing cache-control");

  const readiness = payload?.readiness;
  add("public readiness envelope", payload?.ok === true && readiness?.alpha === "playable");
  add("runtime state ready", readiness?.state === "ready", `state=${readiness?.state ?? "missing"}`);
  add("entry route is /play", readiness?.entryRoute === "/play", `entryRoute=${readiness?.entryRoute ?? "missing"}`);
  add("release matches package", readiness?.release?.release === packageMetadata.version, `api=${readiness?.release?.release ?? "missing"} package=${packageMetadata.version}`);

  const configuredRelease = process.env.RUNEFORGE_RELEASE?.trim();
  add(
    "release environment matches package",
    !configuredRelease || configuredRelease === packageMetadata.version,
    configuredRelease ? `env=${configuredRelease}` : "RUNEFORGE_RELEASE not set",
  );

  const capabilities = Array.isArray(readiness?.capabilities) ? readiness.capabilities : [];
  const capabilityKeys = capabilities.map((capability) => capability?.key).filter(Boolean);
  add(
    "exact seven Alpha capabilities",
    capabilities.length === expectedCapabilityKeys.length
      && expectedCapabilityKeys.every((key) => capabilityKeys.includes(key))
      && capabilityKeys.every((key) => expectedCapabilityKeys.includes(key)),
    capabilityKeys.join(",") || "none",
  );
  add(
    "all Alpha capabilities available",
    capabilities.length === expectedCapabilityKeys.length
      && capabilities.every((capability) => capability?.status === "available"),
    capabilities.map((capability) => `${capability?.key}:${capability?.status}`).join(",") || "none",
  );

  const boundaries = readiness?.boundaries || {};
  add("Ranked is not an Alpha launch requirement", boundaries.rankedPublicLaunchRequirement === false);
  add("real money is not an Alpha launch requirement", boundaries.realMoneyPaymentsLaunchRequirement === false);
  add("large-scale Live Ops is not an Alpha launch requirement", boundaries.largeScaleLiveOpsLaunchRequirement === false);
  add("Ranked remains operationally disabled", boundaries.rankedOperational === false, `rankedOperational=${String(boundaries.rankedOperational)}`);

  const passed = checks.every((check) => check.ok);
  const manifest = {
    schemaVersion: 1,
    gate: "Public Alpha Release Candidate 1.0",
    passed,
    generatedAt: new Date().toISOString(),
    repository: process.env.GITHUB_REPOSITORY || null,
    commitSha: process.env.GITHUB_SHA || null,
    runId: process.env.GITHUB_RUN_ID || null,
    packageVersion: packageMetadata.version,
    baseUrl,
    readiness: payload?.ok === true ? readiness : null,
    checks,
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
  }
  console.log(`ALPHA RELEASE CANDIDATE EVIDENCE: ${passed ? "PASS" : "FAIL"} — ${manifestPath}`);

  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify({
    schemaVersion: 1,
    gate: "Public Alpha Release Candidate 1.0",
    passed: false,
    generatedAt: new Date().toISOString(),
    repository: process.env.GITHUB_REPOSITORY || null,
    commitSha: process.env.GITHUB_SHA || null,
    runId: process.env.GITHUB_RUN_ID || null,
    packageVersion: packageMetadata.version,
    baseUrl,
    error: serializeError(error),
  }, null, 2) + "\n", "utf8");
  console.error(`ALPHA RELEASE CANDIDATE EVIDENCE: FAIL — ${serializeError(error)}`);
  process.exit(1);
});
