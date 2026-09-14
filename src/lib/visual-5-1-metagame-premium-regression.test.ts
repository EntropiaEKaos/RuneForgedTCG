import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const css = readFileSync("src/app/styles/visual-5-1-metagame-premium.css", "utf8");
const suites = readFileSync("scripts/test-suites.mjs", "utf8");

const previousLayer = 'import "./styles/visual-5-0-cinematic-identity.css";';
const premiumLayer = 'import "./styles/visual-5-1-metagame-premium.css";';
assert.ok(layout.includes(previousLayer), "Visual 5.0 must remain mounted before Visual 5.1");
assert.ok(layout.includes(premiumLayer), "Visual 5.1 metagame premium layer must be mounted");
assert.ok(
  layout.indexOf(premiumLayer) > layout.indexOf(previousLayer),
  "Visual 5.1 must load after Visual 5.0 so its player-facing meta polish wins without reopening older layers",
);

for (const contract of [
  'section[aria-label="Resumo da coleção"]',
  'section[aria-label="Resumo da Forja"]',
  ".modes-page",
  'section[aria-label="Resumo de progressão"]',
  ".codex-page",
]) {
  assert.ok(css.includes(contract), `Visual 5.1 must preserve the certified meta destination contract: ${contract}`);
}

for (const premiumHook of [
  'section[aria-label="Cartas da coleção"] button[aria-pressed]',
  ".collection-flip-outer",
  ".input:focus-visible",
  ".rf-button-secondary:is(:hover, :focus-visible)",
  "@supports not (backdrop-filter: blur(2px))",
  "@media (prefers-reduced-motion: reduce)",
]) {
  assert.ok(css.includes(premiumHook), `Visual 5.1 premium/accessibility hook missing: ${premiumHook}`);
}

for (const forbidden of [
  "data-deck-identity",
  "BattleView",
  "ArenaIdentity",
  ".battlefield",
  ".hand-zone",
  ".card-shell",
  "fetch(",
  "dispatch(",
  "localStorage",
  "sessionStorage",
  "playUnit",
  "castSpell",
]) {
  assert.equal(css.includes(forbidden), false, `Visual 5.1 must remain presentation-only and meta-scoped: forbidden token ${forbidden}`);
}

assert.ok(
  suites.includes('"src/lib/visual-5-1-metagame-premium-regression.test.ts"'),
  "Visual 5.1 regression must be classified as a source contract test",
);

console.log("RUNE FORGE VISUAL 5.1 METAGAME PREMIUM: presentation scope + accessibility contracts PASS");
