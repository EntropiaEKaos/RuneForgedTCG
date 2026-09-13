import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const css = readFileSync("src/app/styles/visual-4-0-responsive-battlefield.css", "utf8");
const visualJourney = readFileSync("scripts/alpha-visual-journey.mjs", "utf8");

const importToken = 'import "./styles/visual-4-0-responsive-battlefield.css";';
assert.ok(layout.includes(importToken), "Visual 4.0 responsive battlefield layer must be loaded");
assert.ok(
  layout.indexOf(importToken) > layout.indexOf('import "./styles/card-cosmetics.css";'),
  "Visual 4.0 must load after the existing visual stack so viewport geometry wins deterministically",
);

assert.ok(
  css.includes("@media (min-width: 901px) and (max-height: 900px)"),
  "short desktop/notebook breakpoint must exist",
);
assert.ok(
  css.includes("@media (min-width: 901px) and (max-height: 760px)"),
  "720p-class notebook density floor must exist",
);
assert.ok(css.includes("height: 100dvh"), "responsive arena must bind itself to the dynamic viewport height");
assert.ok(css.includes("max-height: 100dvh"), "responsive arena must not grow below the viewport");

for (const selector of [
  ".tcg-arena .tcg-row",
  ".tcg-arena .tcg-row .card-shell",
  ".tcg-arena .player-hand-shell",
  ".tcg-arena .tcg-hand .tcg-hand-card .card-shell",
  ".tcg-arena .tcg-actions",
  '.tcg-arena .tcg-row[data-bench-side="ai"] + .relative.flex-1',
]) {
  assert.ok(css.includes(selector), `responsive tactical surface missing selector: ${selector}`);
}

assert.ok(css.includes("--rf-v4-board-card-w: clamp("), "board cards must scale against viewport height");
assert.ok(css.includes("--rf-v4-board-card-h: clamp("), "board card height must use a portable clamp rather than experimental calc multiplication");
assert.ok(css.includes("--rf-v4-hand-card-w: clamp("), "hand cards must scale against viewport height");
assert.ok(css.includes("--rf-v4-hand-card-h: clamp("), "hand card height must use a portable clamp rather than experimental calc multiplication");
assert.equal(css.includes("* 1.414"), false, "Visual 4.0 must not depend on unsupported CSS calc multiplication");

assert.ok(
  css.includes(".tcg-arena .board-status-strip") && css.includes(".tcg-arena .archetype-tracker"),
  "secondary notebook chrome must yield height to the actual battlefield",
);
assert.ok(css.includes("aside[data-mode-mission]"), "special-mode briefing must remain available as an overlay on short viewports");
assert.ok(css.includes(".tcg-arena .tcg-log[open]"), "battle log must remain accessible as an overlay drawer");
assert.ok(css.includes("overscroll-behavior: contain"), "internal tactical scrollers must contain overscroll instead of moving the page");

assert.ok(
  visualJourney.includes("const notebookViewport = { width: 1366, height: 768"),
  "real-browser visual certification must include the common 1366x768 notebook viewport",
);
assert.ok(
  visualJourney.includes("assertBattlefieldNotebookFit"),
  "visual journey must certify notebook battlefield geometry",
);
assert.ok(
  visualJourney.includes("notebook battlefield requires vertical page scrolling"),
  "browser certification must fail when the page needs vertical scrolling",
);
assert.ok(
  visualJourney.includes("05a-battlefield-notebook-1366x768.png"),
  "notebook certification must emit reviewable screenshot evidence",
);
for (const selector of ["rivalField", "playerField", "hand", "actions"]) {
  assert.ok(visualJourney.includes(`${selector}: rectOf(`), `notebook browser evidence must measure ${selector}`);
}

for (const forbidden of ["fetch(", "dispatch(", "castSpell(", "playUnit(", "localStorage", "sessionStorage"]) {
  assert.equal(css.includes(forbidden), false, `presentation-only responsive layer must not contain ${forbidden}`);
}

console.log("RUNE FORGE VISUAL 4.0 RESPONSIVE BATTLEFIELD: source contract PASS");
