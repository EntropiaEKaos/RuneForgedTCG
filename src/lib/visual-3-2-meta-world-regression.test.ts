import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const css = readFileSync("src/app/styles/visual-3-2-meta-world.css", "utf8");
const collection = readFileSync("src/app/collection/CollectionClient.tsx", "utf8");
const forge = readFileSync("src/app/forge/ForgeClient.tsx", "utf8");
const modes = readFileSync("src/app/modes/ModesClient.tsx", "utf8");
const profile = readFileSync("src/app/profile/ProfileClient.tsx", "utf8");
const codex = readFileSync("src/app/codex/page.tsx", "utf8");

assert.ok(
  layout.includes('import "./styles/visual-3-2-meta-world.css";'),
  "Visual 3.2 Meta UI World Pass must be loaded by the root layout",
);
assert.ok(
  layout.indexOf('visual-3-2-meta-world.css') > layout.indexOf('visual-3-1-card-presentation.css'),
  "Visual 3.2 must layer after the certified Visual 3.1 presentation stack",
);

// Each world identity is anchored to a page-owned semantic/accessibility contract.
for (const { source, sourceContract, cssContract, label } of [
  {
    source: collection,
    sourceContract: 'aria-label="Resumo da coleção"',
    cssContract: ':has(section[aria-label="Resumo da coleção"])',
    label: "collection",
  },
  {
    source: forge,
    sourceContract: 'aria-label="Resumo da Forja"',
    cssContract: ':has(section[aria-label="Resumo da Forja"])',
    label: "forge",
  },
  {
    source: modes,
    sourceContract: 'className="rf-app-page modes-page"',
    cssContract: ".rf-app-page.modes-page",
    label: "modes",
  },
  {
    source: profile,
    sourceContract: 'aria-label="Resumo de progressão"',
    cssContract: ':has(section[aria-label="Resumo de progressão"])',
    label: "profile",
  },
  {
    source: codex,
    sourceContract: 'className="rf-app-page codex-page"',
    cssContract: ".rf-app-page.codex-page",
    label: "codex",
  },
] as const) {
  assert.ok(source.includes(sourceContract), `Visual 3.2 stable route contract missing: ${label}`);
  assert.ok(css.includes(cssContract), `Visual 3.2 CSS identity missing: ${label}`);
}

for (const contract of [
  "--rf-world-accent:",
  "--rf-world-glyph:",
  "--rf-world-scene-x:",
  "mask-image:",
  "backdrop-filter: blur(8px)",
  "pointer-events: none",
  "prefers-reduced-motion: reduce",
  "@media (max-width: 640px)",
]) {
  assert.ok(css.includes(contract), `Visual 3.2 world/presentation contract missing: ${contract}`);
}

// Presentation scope is deliberately restricted to meta surfaces. Battlefield/card authority stays untouched.
for (const forbidden of [
  ".tcg-arena",
  ".battlefield",
  ".hand-zone",
  ".card-shell",
  "fetch(",
  "dispatch(",
  "localStorage",
  "sessionStorage",
  "playUnit(",
  "castSpell(",
]) {
  assert.equal(css.includes(forbidden), false, `Visual 3.2 must not cross the meta presentation boundary: ${forbidden}`);
}

// The route world layer must not replace or hide the shared player navigation.
for (const source of [collection, forge, modes, profile, codex]) {
  assert.ok(source.includes("<SiteNav />"), "Visual 3.2 destinations must retain shared SiteNav");
}

console.log("RUNE FORGE VISUAL 3.2 META UI WORLD PASS: source contract PASS");
