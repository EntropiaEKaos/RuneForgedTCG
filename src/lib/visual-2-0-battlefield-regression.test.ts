import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const gameUi = readFileSync("src/components/GameUI.tsx", "utf8");
const hand = readFileSync("src/components/game/PlayerHand.tsx", "utf8");
const css = readFileSync("src/app/styles/visual-2-0-battlefield.css", "utf8");
const cardBack = readFileSync("public/art/ui/runeforge-card-back.svg", "utf8");
const warSeal = readFileSync("public/art/ui/runeforge-war-seal.svg", "utf8");
const artBible = readFileSync("docs/VISUAL-2-0-ART-BIBLE.md", "utf8");

assert.ok(layout.includes('import "./styles/alpha-battlefield.css";\nimport "./styles/visual-2-0-battlefield.css";'), "Visual 2.0 must load after the certified Alpha battlefield layer");
assert.ok(gameUi.includes('data-nexus-state={nexusState}'), "Nexus must expose its progressive presentation state");
for (const state of ["stable", "strained", "cracked", "fractured"]) {
  assert.ok(css.includes(`.tcg-nexus[data-nexus-state="${state}"]`), `Visual 2.0 must style Nexus state ${state}`);
}
assert.ok(gameUi.includes("tcg-opponent-hand") && gameUi.includes("tcg-opponent-card"), "Opponent hand count must have a physical hidden-card representation");
assert.ok(gameUi.includes("Array.from({ length: visibleOpponentCards }"), "Opponent hand representation must render backs only, never card identities");
assert.ok(hand.includes("handFanStyle") && hand.includes("--hand-angle") && hand.includes("--hand-lift"), "Player hand must expose the 2.5D fan contract");
assert.ok(css.includes(".tcg-hand-card") && css.includes("runeforge-card-back.svg"), "Visual layer must style the hand fan and official card back");
assert.ok(css.includes("runeforge-war-seal.svg") && css.includes('[data-match-phase="combat"]'), "Conflict seal must respond to certified match phases");
assert.ok(css.includes("--rf-v2-obsidian") && css.includes("--rf-v2-gold-hi"), "Arcane War Table material tokens are required");
assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"), "Visual 2.0 must preserve reduced-motion accessibility");
assert.ok(cardBack.includes("RuneForge card back") && cardBack.includes("RUNE FORGE"), "Official card-back asset must carry RuneForge identity");
assert.ok(warSeal.includes('viewBox="0 0 600 600"'), "War seal must remain a scalable SVG asset");
assert.ok(artBible.includes("Arcane War Table") && artBible.includes("Engineering boundary"), "Art Bible must preserve the visual direction and engineering boundary");

console.log("RUNE FORGE VISUAL 2.0 BATTLEFIELD FOUNDATION: PASS");
