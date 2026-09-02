import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const css = readFileSync("src/app/styles/visual-3-0-battlefield-cinematic.css", "utf8");
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

// Presentation-only boundary: no gameplay/network/storage behavior belongs in this stylesheet or gate.
for (const forbidden of ["fetch(", "dispatch(", "castSpell(", "playUnit(", "localStorage", "sessionStorage"]) {
  assert.equal(css.includes(forbidden), false, `presentation layer must not contain ${forbidden}`);
}

console.log("RUNE FORGE VISUAL 3.0 BATTLEFIELD CINEMATIC PASS: source contract PASS");
