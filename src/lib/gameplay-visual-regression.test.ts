import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const game = ["GameClient.tsx","BattleView.tsx","MulliganView.tsx","hooks/useGamePresentation.ts","hooks/useMatchLauncher.ts","hooks/useMatchLifecycle.ts"].map((f) => readFileSync(`src/app/play/${f}`, "utf8")).join("\n");
const ui = readFileSync("src/components/GameUI.tsx", "utf8");
const card = readFileSync("src/components/CardView.tsx", "utf8");
const css = ["globals.css","styles/tcg-visual.css","styles/site-polish.css","styles/studio.css","styles/arena-regions.css","styles/gameplay-extensions.css"].map((f) => readFileSync(`src/app/${f}`, "utf8")).join("\n");
const decks = readFileSync("src/game/decks.ts", "utf8");

assert.ok(!game.includes("Dismiss Stack"), "pending stack action must never be discardable");
assert.ok(game.includes("finishReaction()"), "stack must retain an explicit resolution path");
assert.ok(game.includes("<TurnRail"), "match command rail missing");
assert.ok(game.includes("<AttackForecast"), "combat pressure forecast missing");
assert.ok(game.includes("<FirstMatchGuide"), "first-match guide missing");
assert.ok(game.includes("<GameSettings"), "sound and visual preferences must be available from the match");
assert.ok(ui.includes('top ? "TURNO RIVAL" : "SEU TURNO"'), "opponent turn label regression");
assert.ok(card.includes("data-keyword={k}"), "keyword state hooks must be available to CSS/accessibility");
assert.ok(css.includes("GAMEPLAY EXPERIENCE 2.32–2.36"), "visual experience layer missing");
assert.ok(css.includes('data-region="florestia"'), "regional battlefield identities missing");
assert.ok(decks.includes('"forest_ambush"') && decks.includes('"forest_canopy_warden"'), "new Florestia tools must be represented in its starter deck");

console.log("GAMEPLAY/VISUAL REGRESSION 2.36: PASS");
