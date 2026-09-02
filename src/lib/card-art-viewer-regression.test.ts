import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cardTip = readFileSync("src/components/CardTip.tsx", "utf8");
const viewer = readFileSync("src/components/CardArtViewerButton.tsx", "utf8");
const tooltip = readFileSync("src/components/Tooltip.tsx", "utf8");
const ci = readFileSync(".github/workflows/ci.yml", "utf8");
const freeze = readFileSync("src/lib/alpha-visual-feature-freeze-regression.test.ts", "utf8");

for (const contract of [
  'usePathname',
  'pathname === "/codex"',
  'pathname === "/collection"',
  'getCardArt(defId)?.url ?? def.art ?? null',
  '<CardArtViewerButton',
  '<CardArtViewerDialog',
  'useState(false)',
  'pointer-events-auto',
]) {
  assert.ok(cardTip.includes(contract), `CardTip large-art contract missing: ${contract}`);
}

for (const contract of [
  'data-card-art-viewer-trigger={defId}',
  'data-card-art-viewer={defId}',
  'data-card-art-viewer-image={defId}',
  'role="dialog"',
  'aria-modal="true"',
  'event.key === "Escape"',
  'document.body.style.overflow = "hidden"',
  '/^\\/(?!\\/)/',
  '/^https:\\/\\//i',
  'backgroundSize: "contain"',
]) {
  assert.ok(viewer.includes(contract), `Full-art lightbox contract missing: ${contract}`);
}

assert.ok(
  tooltip.includes("target?.closest?.('[data-tooltip-panel=\"true\"]')"),
  "Long-press click suppression must not swallow interactive controls rendered inside the tooltip panel",
);
assert.ok(ci.includes("node scripts/alpha-card-art-viewer-browser-cert.mjs"), "CI must exercise the art viewer in a real browser");
assert.equal(freeze.includes('"src/components/CardTip.tsx"'), false, "CardTip must remain outside the seven frozen structural visual blobs");
assert.equal(freeze.includes('"src/components/CardArtViewerButton.tsx"'), false, "Art viewer must remain outside the seven frozen structural visual blobs");
assert.equal(freeze.includes('"src/components/Tooltip.tsx"'), false, "Tooltip interaction hardening must remain outside the seven frozen structural visual blobs");

console.log("CODEX + COLLECTION FULL ART VIEWER: SOURCE CONTRACT PASS");
