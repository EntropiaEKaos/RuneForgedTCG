import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const helper = readFileSync("src/lib/client-telemetry.ts", "utf8");
const onboarding = readFileSync("src/app/play/PlayEntryClient.tsx", "utf8");
const launcher = readFileSync("src/app/play/hooks/useMatchLauncher.ts", "utf8");
const lifecycle = readFileSync("src/app/play/hooks/useMatchLifecycle.ts", "utf8");
const analytics = readFileSync("src/app/api/admin/studio/analytics/route.ts", "utf8");
const liveOps = readFileSync("src/app/admin/studio/ops/LiveOpsStudio.tsx", "utf8");
const telemetryRoute = readFileSync("src/app/api/telemetry/route.ts", "utf8");
const suites = readFileSync("scripts/test-suites.mjs", "utf8");

for (const contract of [
  'fetch("/api/telemetry"',
  'credentials: "include"',
  "keepalive: true",
  "sessionStorage",
  ".catch(() =>",
]) {
  assert.ok(helper.includes(contract), `client telemetry must preserve best-effort first-party contract: ${contract}`);
}

assert.ok(telemetryRoute.includes("consumeRequestRateLimit"), "telemetry ingestion must remain rate limited");
assert.ok(telemetryRoute.includes("SENSITIVE"), "telemetry ingestion must continue stripping sensitive property keys");

for (const eventName of [
  "alpha.onboarding_shown",
  "alpha.onboarding_completed",
]) {
  assert.ok(onboarding.includes(eventName), `onboarding funnel event missing: ${eventName}`);
}
for (const eventName of ["alpha.match_started"]) {
  assert.ok(launcher.includes(eventName), `match launch telemetry missing: ${eventName}`);
}
for (const eventName of ["alpha.match_completed"]) {
  assert.ok(lifecycle.includes(eventName), `match lifecycle telemetry missing: ${eventName}`);
}

const instrumentedClient = [onboarding, launcher, lifecycle].join("\n");
assert.equal(
  /trackTelemetry(?:Once)?\([^)]*(?:playerName|email|recovery|accessKey|matchToken|attemptToken)/s.test(instrumentedClient),
  false,
  "client telemetry calls must not send player identity, recovery material or authoritative tokens",
);

for (const contract of [
  "telemetryEvents",
  "alphaTelemetry",
  "onboardingCompletionRate",
  "matchCompletionRate",
  "uniquePlayers",
  "uniqueSessions",
]) {
  assert.ok(analytics.includes(contract), `admin Alpha telemetry aggregate missing: ${contract}`);
}
assert.ok(liveOps.includes("Alpha cohort"), "Live Ops must surface the Alpha cohort summary");
assert.ok(
  suites.includes('"src/lib/alpha-cohort-telemetry-regression.test.ts"'),
  "Alpha cohort telemetry regression must be classified as a source-contract test",
);

console.log("RUNE FORGE ALPHA COHORT TELEMETRY: privacy + funnel + admin observability contracts PASS");
