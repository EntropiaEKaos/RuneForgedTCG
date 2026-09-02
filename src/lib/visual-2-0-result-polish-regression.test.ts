import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const result = readFileSync("src/components/game/MatchResult.tsx", "utf8");
const css = readFileSync("src/app/styles/visual-2-0-result-polish.css", "utf8");
const doc = readFileSync("docs/VISUAL-2-0-VICTORY-REWARDS.md", "utf8");

assert.ok(
  layout.includes('import "./styles/visual-2-0-meta-ui.css";\nimport "./styles/visual-2-0-result-polish.css";'),
  "Result polish must load after shared Meta UI",
);

assert.ok(result.includes('if (state.phase !== "gameover") return null;'), "Result surface must remain gated by authoritative gameover phase");
assert.ok(result.includes('const victory = state.winner === "player";'), "Victory presentation must derive from authoritative winner state");
assert.ok(result.includes("evaluateMatchMastery(state)"), "Mastery must keep using the existing calculator");
assert.ok(result.includes('data-result-outcome={outcome}'), "Outcome may project to a presentation-only data attribute");
assert.ok(result.includes("const defeated = victory ? opponent : player;"), "Result copy must inspect the authoritative defeated side");
assert.ok(result.includes('entry.startsWith("Maximum round limit (")'), "Result copy must preserve max-round decision semantics");
assert.ok(result.includes('defeated.poisonCounters >= 10') && result.includes('defeated.nexusHealth <= 0'), "Result copy must distinguish poison from Nexus defeat");
assert.ok(result.includes('"O adversário se rendeu. Vitória confirmada."') && result.includes('"Você se rendeu. Derrota confirmada."'), "Positive-Nexus external gameover must render concession semantics instead of claiming Nexus destruction");

for (const token of ["reward.xpGain", "reward.goldGain", "reward.dustGain", "reward.leveledUp", "reward.newLevel"]) {
  assert.ok(result.includes(token), `Confirmed reward presentation must preserve ${token}`);
}
assert.ok(result.includes('aria-label="Recompensas confirmadas"'), "Confirmed rewards accessibility/settlement contract must remain stable");
assert.ok(result.includes("onClick={onReplay}") && result.includes("onClick={onChangeDeck}"), "Existing rematch and deck-change callbacks must remain authoritative");
assert.ok(result.includes("navigator.share") && result.includes("navigator.clipboard.writeText"), "Existing share fallback must remain intact");
assert.ok(result.includes('className="gameover-card match-result-card"'), "Existing browser/PvP result selector contract must remain stable");

assert.ok(css.includes("width: min(560px, calc(100vw - 40px))"), "Desktop result must be wider but viewport-bounded");
assert.ok(css.includes("@media (max-width: 640px)"), "Result surface must have a mobile reflow contract");
assert.ok(css.includes("@media (max-height: 760px)"), "Result surface must compact for short desktop viewports");
assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"), "Result motion must honor reduced-motion preference");
assert.ok(css.includes('[data-result-outcome="victory"]') && css.includes('[data-result-outcome="defeat"]'), "Victory and defeat must each have presentation accents");

assert.ok(doc.includes("does **not**") && doc.includes("reward settlement"), "Documentation must make the settlement boundary explicit");
assert.ok(doc.includes("85/85") && doc.includes("12-match-result.png"), "Documentation must preserve behavioral and real-browser visual certification gates");

for (const forbidden of ["fetch(", "axios", "localStorage", "sessionStorage", "dispatch(", "applyAction(", "settleMatch", "grantReward"]) {
  assert.ok(!result.includes(forbidden), `Result presentation must not introduce authority side effect ${forbidden}`);
}

console.log("RUNE FORGE VISUAL 2.0 VICTORY / REWARDS: PASS");
