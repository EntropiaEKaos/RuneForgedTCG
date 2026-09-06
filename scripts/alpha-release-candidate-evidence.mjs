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

async function fetchJson(pathname) {
  try {
    const response = await fetch(`${baseUrl}${pathname}`, { cache: "no-store" });
    return {
      status: response.status,
      cacheControl: response.headers.get("cache-control") || "",
      payload: await response.json(),
      error: null,
    };
  } catch (error) {
    return { status: 0, cacheControl: "", payload: null, error: serializeError(error) };
  }
}

async function main() {
  fs.mkdirSync(artifactDir, { recursive: true });
  const checks = [];
  const add = (name, ok, detail = "") => checks.push({ name, ok: Boolean(ok), detail });

  const readinessResponse = await fetchJson("/api/public/game/alpha/readiness");
  add("readiness request", !readinessResponse.error, readinessResponse.error || `HTTP ${readinessResponse.status}`);
  add("readiness HTTP 200", readinessResponse.status === 200, `status=${readinessResponse.status}`);
  add("readiness is no-store", /(?:^|,)\s*no-store(?:,|$)/i.test(readinessResponse.cacheControl), readinessResponse.cacheControl || "missing cache-control");

  const readiness = readinessResponse.payload?.readiness;
  add("public readiness envelope", readinessResponse.payload?.ok === true && readiness?.alpha === "playable");
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

  const provenanceResponse = await fetchJson("/api/public/game/deployment/provenance");
  add("provenance request", !provenanceResponse.error, provenanceResponse.error || `HTTP ${provenanceResponse.status}`);
  add("provenance HTTP 200", provenanceResponse.status === 200, `status=${provenanceResponse.status}`);
  add("provenance is no-store", /(?:^|,)\s*no-store(?:,|$)/i.test(provenanceResponse.cacheControl), provenanceResponse.cacheControl || "missing cache-control");

  const deployment = provenanceResponse.payload?.deployment;
  const workflowSha = (process.env.GITHUB_SHA || "").toLowerCase();
  const configuredDeploySha = (process.env.RUNEFORGE_DEPLOY_SHA || "").toLowerCase();
  add("public provenance envelope", provenanceResponse.payload?.ok === true && deployment?.schemaVersion === 1);
  add("provenance commit matches exact workflow SHA", Boolean(workflowSha) && deployment?.commitSha === workflowSha, `api=${deployment?.commitSha ?? "missing"} github=${workflowSha || "missing"}`);
  add("provenance commit matches configured deploy SHA", Boolean(configuredDeploySha) && deployment?.commitSha === configuredDeploySha, `api=${deployment?.commitSha ?? "missing"} env=${configuredDeploySha || "missing"}`);
  add("provenance environment is alpha", deployment?.environment === "alpha", `environment=${deployment?.environment ?? "missing"}`);
  add("provenance release matches package", deployment?.release === packageMetadata.version, `api=${deployment?.release ?? "missing"} package=${packageMetadata.version}`);

  const passed = checks.every((check) => check.ok);
  const manifest = {
    schemaVersion: 2,
    gate: "Public Alpha Release Candidate 1.0",
    passed,
    generatedAt: new Date().toISOString(),
    repository: process.env.GITHUB_REPOSITORY || null,
    commitSha: process.env.GITHUB_SHA || null,
    runId: process.env.GITHUB_RUN_ID || null,
    packageVersion: packageMetadata.version,
    baseUrl,
    readiness: readinessResponse.payload?.ok === true ? readiness : null,
    deployment: provenanceResponse.payload?.ok === true ? deployment : null,
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
    schemaVersion: 2,
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
