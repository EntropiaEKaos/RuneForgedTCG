import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const css = readFileSync("src/app/styles/visual-5-5-draft-premium.css", "utf8");
const draftClientPath = "src/app/draft/DraftClient.tsx";
const draftClient = readFileSync(draftClientPath, "utf8");
const draftVisualCert = readFileSync("scripts/alpha-draft-visual-cert.mjs", "utf8");
const ciWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");
const suites = readFileSync("scripts/test-suites.mjs", "utf8");

const previousLayer = 'import "./styles/visual-5-4-ranked-competitive.css";';
const draftLayer = 'import "./styles/visual-5-5-draft-premium.css";';

assert.ok(layout.includes(draftLayer), "Visual 5.5 Draft premium layer must be mounted");
assert.ok(
  layout.indexOf(draftLayer) > layout.indexOf(previousLayer),
  "Visual 5.5 must load after Visual 5.4 so Draft polish stays additive",
);

for (const contract of [
  '[aria-label="Estado do Draft"]',
  '[aria-labelledby="draft-pick-heading"]',
  '[aria-label="Regiões da identidade atual"]',
  '[aria-label="Progresso do Draft"]',
  '[aria-labelledby="draft-deck-heading"]',
  '[aria-labelledby="draft-complete-heading"]',
  'button[aria-label^="Escolher "]',
]) {
  assert.ok(css.includes(contract), `Visual 5.5 is missing Draft presentation contract: ${contract}`);
}

for (const accessibilityContract of [
  '@supports not (backdrop-filter: blur(1px))',
  '@media (max-width: 720px)',
  '@media (prefers-reduced-motion: reduce)',
]) {
  assert.ok(css.includes(accessibilityContract), `Visual 5.5 is missing accessibility/fallback contract: ${accessibilityContract}`);
}

for (const forbidden of [
  '/api/draft',
  'fetch(',
  'localStorage',
  'ensurePlayerSession',
  'setDeck(',
  'setPool(',
  'setRegions(',
  'setStep(',
  'JSON.stringify({ cardId })',
  '.tcg-arena',
  '.player-hand-shell',
]) {
  assert.equal(css.includes(forbidden), false, `Visual 5.5 must stay presentation-only; forbidden token found: ${forbidden}`);
}

function gitBlobSha(path: string): string {
  const bytes = readFileSync(path);
  const header = Buffer.from(`blob ${bytes.byteLength}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

assert.equal(
  gitBlobSha(draftClientPath),
  "6591b9a8df2f61230576257df63d44bd62bc90e1",
  "Visual 5.5 is certified as CSS-only: DraftClient.tsx must remain byte-for-byte unchanged",
);

for (const authorityContract of [
  'fetch("/api/draft", { cache: "no-store" })',
  'fetch("/api/draft", {',
  'method: "POST"',
  'body: JSON.stringify({ cardId })',
  'applySnapshot(payload);',
  'setComplete(Boolean(payload.complete) || nextStep >= nextTotal);',
  'setPool(Array.isArray(payload.pool) ? payload.pool.filter(isCardDef) : []);',
  'await ensurePlayerSession(localStorage.getItem("runeforge_playername") || "")',
]) {
  assert.ok(draftClient.includes(authorityContract), `Existing Draft authority contract disappeared: ${authorityContract}`);
}

for (const evidenceContract of [
  "bootstrapPlayerSession",
  "fetch('/api/player'",
  "fetch('/api/draft'",
  "chooseFirstCard",
  'initial.body?.step, 0',
  'initial.body.pool.length === 3',
  '[aria-label="Estado do Draft"]',
  '[aria-labelledby="draft-pick-heading"]',
  '[aria-label="Progresso do Draft"]',
  '[aria-labelledby="draft-deck-heading"]',
  '31-draft-pick-chamber.png',
  '32-draft-forge-tray.png',
  '31-draft-diagnostic.png',
  'draft-visual-manifest.json',
]) {
  assert.ok(draftVisualCert.includes(evidenceContract), `Visual 5.5 browser evidence is missing contract: ${evidenceContract}`);
}

for (const forbiddenEvidenceMutation of [
  '/api/admin',
  '/api/matchmaking',
  '/api/ranked',
  'method: \'DELETE\'',
]) {
  assert.equal(
    draftVisualCert.includes(forbiddenEvidenceMutation),
    false,
    `Visual 5.5 browser evidence must isolate itself to public Draft/session authority: ${forbiddenEvidenceMutation}`,
  );
}

assert.ok(
  ciWorkflow.includes("node scripts/alpha-draft-visual-cert.mjs"),
  "Visual 5.5 Draft browser evidence must run inside the full CI browser gate",
);
assert.ok(
  ciWorkflow.indexOf("node scripts/alpha-draft-visual-cert.mjs") > ciWorkflow.indexOf("node scripts/alpha-ranked-visual-cert.mjs"),
  "Draft evidence must run after Ranked and after the Alpha visual journey so it appends to the same artifact",
);
assert.ok(
  suites.includes('"src/lib/visual-5-5-draft-premium-regression.test.ts"'),
  "Visual 5.5 regression contract must be registered as a source-contract test",
);

console.log("RUNE FORGE VISUAL 5.5 DRAFT PREMIUM: CSS-only authority-preserving + direct Draft browser evidence contracts PASS");
