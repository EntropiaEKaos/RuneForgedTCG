import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const css = readFileSync("src/app/styles/visual-5-4-ranked-competitive.css", "utf8");
const rankedClientPath = "src/app/ranked/RankedClient.tsx";
const rankedClient = readFileSync(rankedClientPath, "utf8");
const rankedVisualCert = readFileSync("scripts/alpha-ranked-visual-cert.mjs", "utf8");
const ciWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");
const suites = readFileSync("scripts/test-suites.mjs", "utf8");

const previousLayer = 'import "./styles/visual-5-3-pvp-lobby.css";';
const rankedLayer = 'import "./styles/visual-5-4-ranked-competitive.css";';

assert.ok(layout.includes(rankedLayer), "Visual 5.4 Ranked competitive layer must be mounted");
assert.ok(
  layout.indexOf(rankedLayer) > layout.indexOf(previousLayer),
  "Visual 5.4 must load after Visual 5.3 so competitive polish remains additive",
);

for (const contract of [
  '[aria-label="Estado do competitivo"]',
  '[aria-labelledby="rank-card-heading"]',
  '[aria-label="Deck ranqueado certificado"]',
  '[aria-labelledby="ranked-history-heading"]',
  '[aria-labelledby="ranked-leaderboard-heading"]',
  '[aria-labelledby="rank-tiers-heading"]',
  '.ranked-queue-beacon',
]) {
  assert.ok(css.includes(contract), `Visual 5.4 is missing Ranked presentation contract: ${contract}`);
}

for (const accessibilityContract of [
  '@supports not (backdrop-filter: blur(1px))',
  '@media (max-width: 720px)',
  '@media (prefers-reduced-motion: reduce)',
]) {
  assert.ok(css.includes(accessibilityContract), `Visual 5.4 is missing accessibility/fallback contract: ${accessibilityContract}`);
}

for (const forbidden of [
  '/api/ranked',
  '/api/matchmaking',
  'fetch(',
  'AbortController',
  'localStorage',
  'router.push',
  'mmrBefore',
  'mmrAfter',
  'rankedReleaseCertified =',
  '.tcg-arena',
  '.tcg-actions',
  '.player-hand-shell',
]) {
  assert.equal(css.includes(forbidden), false, `Visual 5.4 must stay presentation-only; forbidden token found: ${forbidden}`);
}

function gitBlobSha(path: string): string {
  const bytes = readFileSync(path);
  const header = Buffer.from(`blob ${bytes.byteLength}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

assert.equal(
  gitBlobSha(rankedClientPath),
  "e42eaac7375cf54ee12f581d0916a9d30e6497ad",
  "Visual 5.4 is certified as CSS-only: RankedClient.tsx must remain byte-for-byte unchanged",
);

for (const authorityContract of [
  'fetch("/api/ranked", { cache: "no-store" })',
  'fetch("/api/matchmaking", {',
  'mode: "ranked"',
  'router.push(`/play?pvpRoom=${encodeURIComponent(result.opponent.roomCode)}`)',
  'await fetch("/api/matchmaking", { method: "DELETE" }).catch(() => null)',
  'rankedReleaseCertified: boolean;',
  'rankedRulesVersion: string;',
  'rankedDeckPoolVersion: string;',
]) {
  assert.ok(rankedClient.includes(authorityContract), `Existing Ranked authority contract disappeared: ${authorityContract}`);
}

for (const evidenceContract of [
  "bootstrapPlayerSession",
  "fetch('/api/player'",
  "fetch('/api/ranked'",
  'rankedReleaseCertified, false',
  'rankedEnabled, false',
  'assert.match(top.bodyText, /gate competitivo fechado/i)',
  '[aria-label="Estado do competitivo"]',
  '[aria-labelledby="rank-card-heading"]',
  '[aria-labelledby="ranked-history-heading"]',
  '[aria-labelledby="ranked-leaderboard-heading"]',
  '[aria-labelledby="rank-tiers-heading"]',
  'operationText',
  'queuePresent',
  'queueDisabled',
  '29-ranked-fail-closed.png',
  '30-ranked-progression.png',
  '29-ranked-diagnostic.png',
  'ranked-visual-manifest.json',
]) {
  assert.ok(rankedVisualCert.includes(evidenceContract), `Visual 5.4 browser evidence is missing contract: ${evidenceContract}`);
}

for (const forbiddenEvidenceMutation of [
  "fetch('/api/matchmaking'",
  'mode: \'ranked\'',
  'method: \'DELETE\'',
  '/api/admin',
]) {
  assert.equal(
    rankedVisualCert.includes(forbiddenEvidenceMutation),
    false,
    `Visual 5.4 browser evidence must observe Ranked without mutating competitive authority: ${forbiddenEvidenceMutation}`,
  );
}

assert.ok(
  ciWorkflow.includes("node scripts/alpha-ranked-visual-cert.mjs"),
  "Visual 5.4 Ranked browser evidence must run inside the full CI browser gate",
);
assert.ok(
  ciWorkflow.indexOf("node scripts/alpha-ranked-visual-cert.mjs") > ciWorkflow.indexOf("node scripts/alpha-visual-journey.mjs"),
  "Ranked evidence must run after the Alpha visual journey so it appends to the same artifact instead of being deleted",
);

assert.ok(
  suites.includes('"src/lib/visual-5-4-ranked-competitive-regression.test.ts"'),
  "Visual 5.4 regression contract must be registered as a source-contract test",
);

console.log("RUNE FORGE VISUAL 5.4 RANKED COMPETITIVE: CSS-only authority-preserving + direct read-only browser evidence contracts PASS");
