import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const css = readFileSync("src/app/styles/visual-5-2-player-journey.css", "utf8");
const suites = readFileSync("scripts/test-suites.mjs", "utf8");

const previousLayer = 'import "./styles/visual-5-1-metagame-premium.css";';
const journeyLayer = 'import "./styles/visual-5-2-player-journey.css";';

assert.ok(layout.includes(journeyLayer), "Visual 5.2 player journey layer must be mounted");
assert.ok(
  layout.indexOf(journeyLayer) > layout.indexOf(previousLayer),
  "Visual 5.2 must load after Visual 5.1 so its journey polish wins without reopening older layers",
);

for (const contract of [
  '[role="dialog"][aria-labelledby="recovery-key-title"]',
  '.rf-app-page:has(> .rf-app-shell.max-w-5xl)',
  '.deck-select-page',
  '[aria-label="Análise da mão inicial"]',
  '[aria-labelledby="mulligan-hand-title"]',
  '.match-guide-backdrop',
  '.match-result-backdrop',
  '.match-result-card',
]) {
  assert.ok(css.includes(contract), `Visual 5.2 is missing certified journey contract: ${contract}`);
}

for (const accessibilityContract of [
  '@supports not (backdrop-filter: blur(1px))',
  '@media (prefers-reduced-motion: reduce)',
  '@media (max-width: 720px)',
]) {
  assert.ok(css.includes(accessibilityContract), `Visual 5.2 is missing accessibility/fallback contract: ${accessibilityContract}`);
}

for (const forbidden of [
  '.tcg-arena',
  '.player-hand-shell',
  '.tcg-actions',
  'data-match-phase',
  'data-deck-identity',
  'BattleView',
  'ArenaIdentity',
  'fetch(',
  'dispatch(',
  'localStorage',
  'sessionStorage',
  'playUnit',
  'castSpell',
]) {
  assert.equal(css.includes(forbidden), false, `Visual 5.2 must stay presentation-only; forbidden token found: ${forbidden}`);
}

assert.ok(
  suites.includes('"src/lib/visual-5-2-player-journey-regression.test.ts"'),
  "Visual 5.2 regression contract must be registered as a source-contract test",
);

console.log("RUNE FORGE VISUAL 5.2 PLAYER JOURNEY: presentation-only contracts PASS");
