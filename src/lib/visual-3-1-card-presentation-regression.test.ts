import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const cardView = readFileSync("src/components/CardView.tsx", "utf8");
const css = readFileSync("src/app/styles/visual-3-1-card-presentation.css", "utf8");
const semantic = readFileSync("src/game/semantic-card-types.ts", "utf8");

assert.ok(
  layout.includes('import "./styles/visual-3-1-card-presentation.css";'),
  "Visual 3.1 card presentation layer must be loaded after the certified visual stack",
);

// Art resilience: a primary/editorial URL must never remove the shipped regional art underneath it.
for (const contract of [
  "const primaryArtUrl = artAssignment?.url || def.art || configuredFallbackArt || null",
  "cssBackgroundUrl(primaryArtUrl)",
  "cssBackgroundUrl(style.art)",
  "data-card-art-source={artSource}",
]) {
  assert.ok(cardView.includes(contract), `CardView art resilience contract missing: ${contract}`);
}
assert.ok(
  cardView.includes('primaryArtUrl && primaryArtUrl !== style.art'),
  "primary art must be layered over regional fallback rather than replacing it",
);
assert.ok(
  cardView.includes('artSource !== "editorial" && artSource !== "definition"'),
  "cards without dedicated art must retain the visible fallback identity treatment",
);

// Semantic identity stays sourced from the authoritative semantic-card contract.
for (const contract of [
  "certifiedSemanticCardType(def)",
  "semanticCardTypeLabel(def)",
  "data-card-semantic-type={semanticType?.key || \"base\"}",
]) {
  assert.ok(cardView.includes(contract), `semantic presentation contract missing: ${contract}`);
}
for (const key of ["structure", "ritual", "trap"]) {
  assert.ok(semantic.includes(`key: "${key}"`), `authoritative semantic type ${key} must remain certified`);
  assert.ok(css.includes(`[data-card-semantic-type="${key}"]`), `Visual 3.1 must distinguish ${key}`);
}

// Meta surfaces and battlefield share the same CardView presentation without geometry changes.
for (const selector of [
  ".codex-card-grid .card-shell",
  ".collection-grid .card-shell",
  ".deck-card-grid .card-shell",
  ".studio-card-preview .card-shell",
  '.tcg-arena .card-shell[data-card-semantic-type="structure"]',
  '.tcg-arena .card-shell[data-card-semantic-type="ritual"]',
  '.tcg-arena .card-shell[data-card-semantic-type="trap"]',
]) {
  assert.ok(css.includes(selector), `Card Presentation 3.1 selector missing: ${selector}`);
}

assert.ok(css.includes('@media (max-width: 900px)'), "Visual 3.1 mobile fallback missing");
assert.ok(css.includes('prefers-reduced-motion: reduce'), "Visual 3.1 reduced-motion fallback missing");

// Presentation-only boundary: no authority, storage or network behavior belongs in this layer.
for (const forbidden of [
  "fetch(",
  "dispatch(",
  "castSpell(",
  "playUnit(",
  "localStorage",
  "sessionStorage",
  "width: 98px",
  "height: 140px",
]) {
  assert.equal(css.includes(forbidden), false, `Visual 3.1 presentation layer must not contain ${forbidden}`);
}

console.log("RUNE FORGE VISUAL 3.1 CARD ART / PRESENTATION: source contract PASS");
