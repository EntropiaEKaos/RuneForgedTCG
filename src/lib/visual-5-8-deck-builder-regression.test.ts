import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const css = readFileSync("src/app/styles/visual-5-8-deck-builder.css", "utf8");
const forgeClientPath = "src/app/forge/ForgeClient.tsx";
const forgeClient = readFileSync(forgeClientPath, "utf8");
const visualCert = readFileSync("scripts/alpha-deck-builder-visual-cert.mjs", "utf8");
const ciWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");
const suites = readFileSync("scripts/test-suites.mjs", "utf8");

const previousLayer = 'import "./styles/visual-5-7-pack-opening.css";';
const deckBuilderLayer = 'import "./styles/visual-5-8-deck-builder.css";';

assert.ok(layout.includes(deckBuilderLayer), "Visual 5.8 deck builder layer must be mounted");
assert.ok(
  layout.indexOf(deckBuilderLayer) > layout.indexOf(previousLayer),
  "Visual 5.8 must load after Visual 5.7 so Forge polish remains additive",
);

for (const contract of [
  '[aria-label="Resumo da Forja"]',
  '[aria-labelledby="forge-editor-heading"]',
  '[aria-label="Identidade regional do deck"]',
  '[aria-labelledby="saved-decks-heading"]',
  '[aria-labelledby="forge-catalog-heading"]',
  '[aria-label="Catálogo de cartas para o deck"]',
  'aside[aria-label="Deck em construção"]',
  '.forge-insight',
  '.forge-role-grid',
]) {
  assert.ok(css.includes(contract), `Visual 5.8 is missing Forge presentation contract: ${contract}`);
}

for (const accessibilityContract of [
  '@supports not ((backdrop-filter: blur(4px)) or (-webkit-backdrop-filter: blur(4px)))',
  '@media (max-width: 1023px)',
  '@media (max-width: 720px)',
  '@media (prefers-reduced-motion: reduce)',
]) {
  assert.ok(css.includes(accessibilityContract), `Visual 5.8 is missing fallback/responsive contract: ${accessibilityContract}`);
}

for (const forbidden of [
  '/api/decks',
  '/api/formats',
  'fetch(',
  'localStorage',
  'setList(',
  'setSaved(',
  'validateDeck(',
  'cardLegalInFormat(',
  'encodeDeck(',
  '.tcg-arena',
  '.player-hand-shell',
]) {
  assert.equal(css.includes(forbidden), false, `Visual 5.8 CSS must stay presentation-only; forbidden token found: ${forbidden}`);
}

function gitBlobSha(path: string): string {
  const bytes = readFileSync(path);
  const header = Buffer.from(`blob ${bytes.byteLength}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

assert.equal(
  gitBlobSha(forgeClientPath),
  "8ea0d68997dfc4173dce1ad3374633dea8d8c006",
  "Visual 5.8 is certified as CSS-only: ForgeClient.tsx must remain byte-for-byte unchanged",
);

for (const authorityContract of [
  'fetch("/api/decks", { cache: "no-store" })',
  'fetch(editingId ? `/api/decks/${editingId}` : "/api/decks"',
  'body: JSON.stringify({ name, emoji, formatId, cards: list })',
  'fetch(`/api/decks/${id}`, { method: "DELETE" })',
  'fetch("/api/decks/share"',
  'validateDeck(list)',
  'cardLegalInFormat(card.defId, selectedFormat)',
  'getRuntimeDeckRules()',
]) {
  assert.ok(forgeClient.includes(authorityContract), `Existing Forge authority contract disappeared: ${authorityContract}`);
}

for (const evidenceContract of [
  'bootstrapPlayerSession',
  'navigate(cdp, "/forge")',
  '[aria-label="Resumo da Forja"]',
  '[aria-labelledby="forge-editor-heading"]',
  '[aria-label="Catálogo de cartas para o deck"]',
  '[aria-label="Deck em construção"]',
  '36-deck-builder-workbench.png',
  '37-deck-builder-composition.png',
  'deck-builder-visual-manifest.json',
]) {
  assert.ok(visualCert.includes(evidenceContract), `Visual 5.8 browser evidence is missing contract: ${evidenceContract}`);
}

for (const forbiddenServerMutation of [
  "fetch('/api/decks', { method:",
  'fetch("/api/decks", { method:',
  '/api/decks/share',
  '/api/admin',
  '/api/matchmaking',
]) {
  assert.equal(
    visualCert.includes(forbiddenServerMutation),
    false,
    `Visual 5.8 browser evidence must not mutate deck/server authority: ${forbiddenServerMutation}`,
  );
}
assert.ok(visualCert.includes("fetch('/api/player'"), "Visual 5.8 browser cert may bootstrap only its isolated public player session");

assert.ok(
  ciWorkflow.includes("node scripts/alpha-deck-builder-visual-cert.mjs"),
  "Visual 5.8 browser evidence must run inside the full CI browser gate",
);
assert.ok(
  ciWorkflow.indexOf("node scripts/alpha-deck-builder-visual-cert.mjs") > ciWorkflow.indexOf("node scripts/alpha-pack-opening-visual-cert.mjs"),
  "Deck Builder evidence must run after Pack Opening and append to the shared visual artifact",
);
assert.ok(
  suites.includes('"src/lib/visual-5-8-deck-builder-regression.test.ts"'),
  "Visual 5.8 regression contract must be registered as a source-contract test",
);

console.log("RUNE FORGE VISUAL 5.8 DECK BUILDER: CSS-only Forge authority + direct composition browser evidence contracts PASS");
