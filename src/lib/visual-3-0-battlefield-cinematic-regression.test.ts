import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const css = readFileSync("src/app/styles/visual-3-0-battlefield-cinematic.css", "utf8");
const responsiveCss = readFileSync("src/app/styles/visual-4-0-responsive-battlefield.css", "utf8");
const visualJourney = readFileSync("scripts/alpha-visual-journey.mjs", "utf8");
const battle = readFileSync("src/app/play/BattleView.tsx", "utf8");
const arena = readFileSync("src/components/game/ArenaIdentity.tsx", "utf8");

assert.ok(
  layout.includes('import "./styles/visual-3-0-battlefield-cinematic.css";'),
  "Visual 3.0 battlefield layer must be loaded after the certified visual stack",
);

// Reuse authoritative/player-facing state already projected by BattleView.
for (const contract of ["data-region={battlefieldRegion}", "data-match-phase={matchPhase}", "data-performance={performanceTier}", "<ArenaIdentity"]) {
  assert.ok(battle.includes(contract), `BattleView must preserve ${contract}`);
}

// Region scenery must remain local/self-contained and continue using the existing art identity map.
for (const region of ["emberhold", "tidecall", "ironwood", "voidborn", "florestia", "tempestade"]) {
  assert.ok(arena.includes(`/art/regions/${region}.svg`), `${region} arena art must remain available to the cinematic layer`);
}

// Visual hierarchy: world → player plates/Nexus → deployment lanes → conflict altar → hand/actions.
for (const selector of [
  ".tcg-arena .arena-backdrop",
  ".tcg-arena .tcg-playerbar",
  ".tcg-arena .tcg-nexus",
  ".tcg-arena .tcg-row::after",
  '.tcg-arena .tcg-row[data-bench-side="ai"] + .relative.flex-1',
  ".tcg-arena .player-hand-shell",
  ".tcg-arena .tcg-actions",
]) {
  assert.ok(css.includes(selector), `cinematic hierarchy selector missing: ${selector}`);
}

assert.ok(css.includes("rgba(var(--arena-accent"), "cinematic lighting must inherit the certified region identity variables");
assert.ok(css.includes('data-match-phase="combat"'), "combat must have a distinct cinematic lighting state");
assert.ok(css.includes('data-match-phase="response"'), "reaction priority must have a distinct cinematic lighting state");
assert.ok(css.includes("rf-v3-arena-breathe"), "main-phase atmosphere must retain the low-frequency arena pulse");

// The pass may increase perceived depth, but must preserve small-screen and accessibility fallbacks.
assert.ok(css.includes("@media (max-width: 900px)"), "mobile battlefield fallback missing");
assert.ok(css.includes("prefers-reduced-motion: reduce"), "reduced-motion fallback missing");
assert.ok(css.includes('data-performance="low"'), "low-performance fallback missing");
assert.ok(css.includes('data-fx="reduced"'), "reduced-FX fallback missing");

// Visual 4.0 is deliberately loaded last so short desktop/notebook geometry can
// override every earlier cinematic/polish layer without touching game logic.
const responsiveImport = 'import "./styles/visual-4-0-responsive-battlefield.css";';
assert.ok(layout.includes(responsiveImport), "Visual 4.0 responsive battlefield layer must be loaded");
assert.ok(
  layout.indexOf(responsiveImport) > layout.indexOf('import "./styles/card-cosmetics.css";'),
  "Visual 4.0 must load after the existing visual stack so viewport geometry wins deterministically",
);
assert.ok(
  responsiveCss.includes("@media (min-width: 901px) and (max-height: 900px)"),
  "short desktop/notebook breakpoint must exist",
);
assert.ok(
  responsiveCss.includes("@media (min-width: 901px) and (max-height: 760px)"),
  "720p-class notebook density floor must exist",
);
assert.ok(responsiveCss.includes("height: 100dvh"), "responsive arena must bind itself to the dynamic viewport height");
assert.ok(responsiveCss.includes("max-height: 100dvh"), "responsive arena must not grow below the viewport");

for (const selector of [
  ".tcg-arena .tcg-row",
  ".tcg-arena .tcg-row .card-shell",
  ".tcg-arena .player-hand-shell",
  ".tcg-arena .tcg-hand .tcg-hand-card .card-shell",
  ".tcg-arena .tcg-actions",
  '.tcg-arena .tcg-row[data-bench-side="ai"] + .relative.flex-1',
]) {
  assert.ok(responsiveCss.includes(selector), `responsive tactical surface missing selector: ${selector}`);
}

assert.ok(responsiveCss.includes("--rf-v4-board-card-w: clamp("), "board cards must scale against viewport height");
assert.ok(responsiveCss.includes("--rf-v4-board-card-h: clamp("), "board card height must use a portable clamp");
assert.ok(responsiveCss.includes("--rf-v4-hand-card-w: clamp("), "hand cards must scale against viewport height");
assert.ok(responsiveCss.includes("--rf-v4-hand-card-h: clamp("), "hand card height must use a portable clamp");
assert.equal(responsiveCss.includes("* 1.414"), false, "Visual 4.0 must not depend on unsupported CSS calc multiplication");
assert.ok(
  responsiveCss.includes(".tcg-arena .board-status-strip") && responsiveCss.includes(".tcg-arena .archetype-tracker"),
  "secondary notebook chrome must yield height to the actual battlefield",
);
assert.ok(responsiveCss.includes("aside[data-mode-mission]"), "special-mode briefing must remain available as an overlay on short viewports");
assert.ok(responsiveCss.includes(".tcg-arena .tcg-log[open]"), "battle log must remain accessible as an overlay drawer");
assert.ok(responsiveCss.includes("overscroll-behavior: contain"), "internal tactical scrollers must contain overscroll instead of moving the page");

// Real browser evidence must reproduce the notebook failure that motivated
// Visual 4.0 and now certify the common short-laptop viewport matrix in 4.1.
assert.ok(
  visualJourney.includes("const notebookViewport = { width: 1366, height: 768"),
  "real-browser visual certification must preserve the common 1366x768 notebook viewport",
);
assert.ok(
  visualJourney.includes("const notebookViewportMatrix = ["),
  "Visual 4.1 must run a deterministic notebook viewport matrix",
);
assert.ok(
  visualJourney.includes("{ width: 1280, height: 720"),
  "Visual 4.1 must certify the constrained 1280x720 notebook floor",
);
assert.ok(
  visualJourney.includes("{ width: 1536, height: 864"),
  "Visual 4.1 must certify a common 1536x864 notebook viewport",
);
assert.ok(visualJourney.includes("assertBattlefieldNotebookFit"), "visual journey must certify notebook battlefield geometry");
assert.ok(
  visualJourney.includes("battlefield requires vertical page scrolling"),
  "browser certification must fail when any notebook viewport needs vertical scrolling",
);
assert.ok(
  visualJourney.includes("05a-battlefield-notebook-1366x768.png"),
  "1366x768 certification must preserve its reviewable screenshot evidence",
);
assert.ok(
  visualJourney.includes('`05a-battlefield-notebook-${viewportLabel}.png`'),
  "Visual 4.1 must emit reviewable screenshot evidence for the additional notebook matrix viewports",
);
assert.ok(visualJourney.includes("notebookMatrixEvidence"), "Visual 4.1 manifest must retain measured notebook geometry");
for (const minimum of [
  "rival field became too short to read",
  "player field became too short to read",
  "hand became too short to read",
  "action rail became too short to use",
]) {
  assert.ok(visualJourney.includes(minimum), `Visual 4.1 readability floor missing: ${minimum}`);
}
for (const selector of ["rivalField", "playerField", "hand", "actions"]) {
  assert.ok(visualJourney.includes(`${selector}: rectOf(`), `notebook browser evidence must measure ${selector}`);
}

// Presentation-only boundary: no gameplay/network/storage behavior belongs in these stylesheets or gate.
for (const forbidden of ["fetch(", "dispatch(", "castSpell(", "playUnit(", "localStorage", "sessionStorage"]) {
  assert.equal(css.includes(forbidden), false, `presentation layer must not contain ${forbidden}`);
  assert.equal(responsiveCss.includes(forbidden), false, `responsive presentation layer must not contain ${forbidden}`);
}

console.log("RUNE FORGE VISUAL 3.0 + 4.0 + 4.1 BATTLEFIELD CONTRACT: source contract PASS");