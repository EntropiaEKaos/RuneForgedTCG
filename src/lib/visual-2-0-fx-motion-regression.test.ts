import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const css = readFileSync("src/app/styles/visual-2-0-fx-motion.css", "utf8");
const atmosphere = readFileSync("src/app/styles/visual-2-0-fx-atmosphere-polish.css", "utf8");
const battleView = readFileSync("src/app/play/BattleView.tsx", "utf8");
const targetingHud = readFileSync("src/components/game/TargetingHud.tsx", "utf8");
const reactionStack = readFileSync("src/components/game/ReactionStack.tsx", "utf8");
const alphaBattlefield = readFileSync("src/app/styles/alpha-battlefield.css", "utf8");
const doc = readFileSync("docs/VISUAL-2-0-FX-JUICE-MOTION.md", "utf8");

assert.ok(
  layout.includes('import "./styles/visual-2-0-hand-selection-safety.css";\nimport "./styles/visual-2-0-fx-motion.css";\nimport "./styles/visual-2-0-fx-atmosphere-polish.css";'),
  "FX layers must load after Card Presentation hand geometry safety",
);

assert.ok(battleView.includes("data-fx-event={event.type}"), "FX must consume the existing authoritative BattleView event hook");
assert.ok(targetingHud.includes("data-targeting-mode={mode}"), "FX must consume TargetingHud's authoritative mode hook");
assert.ok(reactionStack.includes('className="reaction-stack"'), "FX must style the existing ReactionStack rather than inventing parallel response state");

for (const mode of ["spell", "reaction", "sentinela", "challenge", "block"]) {
  assert.ok(css.includes(`[data-targeting-mode="${mode}"]`), `FX must preserve a targeting treatment for ${mode}`);
}

assert.ok(css.includes('[data-match-phase="combat"]') && css.includes('[data-match-phase="response"]'), "FX must derive phase atmosphere from the arena's authoritative phase hook");
assert.ok(css.includes('[data-fx-event="dmg"]') && css.includes('[data-fx-event="heal"]') && css.includes('[data-fx-event="death"]'), "FX must restyle real event pops instead of generating fake feedback");
assert.ok(css.includes('[data-nexus-state="fractured"]'), "Critical Nexus motion must derive from the existing Nexus state contract");

const targetKeyframe = css.match(/@keyframes rf-v2-target-signal\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
assert.ok(targetKeyframe, "Target signal keyframe must exist");
assert.doesNotMatch(targetKeyframe, /transform\s*:/, "Target pulse must never move card geometry");

const attackKeyframe = css.match(/@keyframes rf-v2-board-attack-signal\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
assert.ok(attackKeyframe, "Board attack signal keyframe must exist");
assert.doesNotMatch(attackKeyframe, /transform\s*:/, "Attack shell feedback must not overwrite card-shell transform geometry");
assert.ok(css.includes(".tcg-arena .tcg-row .card-shell.card-attacking"), "Attack motion must be explicitly battlefield-row scoped");
assert.ok(css.includes(".tcg-arena .tcg-hand .card-shell.card-attacking") && css.includes("animation: none !important"), "Hand fan must suppress legacy attack-shell transform animation");

assert.match(css, /\.tcg-arena \.stat-health\.damaged\s*\{[\s\S]*?animation:\s*none !important;/, "Persistent damage must not pulse forever");
assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"), "FX must provide a reduced-motion contract");

assert.ok(atmosphere.includes("radial-gradient") && atmosphere.includes("transparent 73%"), "Arena ambient fields must fade to transparency before their raster edge");
assert.ok(atmosphere.includes("opacity: .085") && atmosphere.includes("filter: blur(92px)"), "Arena ambient fields must remain subordinate to gameplay surfaces");
assert.ok(atmosphere.includes("@media (prefers-reduced-motion: reduce)"), "Ambient drift must obey reduced motion");

for (const selector of [".fx-pop", ".combat-feedback", ".combat-screen-flash", ".match-cinematic", ".combat-choreography", ".mechanic-cue"]) {
  assert.ok(alphaBattlefield.includes(selector), `Gameover safety must continue suppressing transient surface ${selector}`);
}

assert.ok(doc.includes("presentation-only") && doc.includes("authoritative"), "FX documentation must preserve the presentation/authority boundary");
assert.ok(doc.includes("85/85 behavioral targets unchanged"), "FX documentation must preserve the behavioral baseline");
assert.ok(doc.includes("CardDef") && doc.includes("PvP / Ranked authority"), "FX documentation must explicitly forbid gameplay-authority mutation");

console.log("RUNE FORGE VISUAL 2.0 FX / JUICE / MOTION: PASS");
