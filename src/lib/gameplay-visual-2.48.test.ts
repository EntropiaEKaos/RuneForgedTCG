import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const game = ["GameClient.tsx","BattleView.tsx","MulliganView.tsx","hooks/useGamePresentation.ts","hooks/useMatchLauncher.ts","hooks/useMatchLifecycle.ts"].map((f) => readFileSync(`src/app/play/${f}`, "utf8")).join("\n");
const card = readFileSync("src/components/CardView.tsx", "utf8");
const css = ["globals.css","styles/tcg-visual.css","styles/site-polish.css","styles/studio.css","styles/arena-regions.css","styles/gameplay-extensions.css"].map((f) => readFileSync(`src/app/${f}`, "utf8")).join("\n");
const events = readFileSync("src/game/events.ts", "utf8");
const sounds = readFileSync("src/lib/sounds.ts", "utf8");

for (const surface of ["CombatLane", "TargetingHud", "ArenaIdentity", "MatchCinematics", "MechanicCue"]) {
  assert.ok(game.includes(`<${surface}`), `${surface} must be integrated`);
}
for (const hook of ["data-card-region", "data-card-rarity", "data-card-type", "data-card-state"]) {
  assert.ok(card.includes(hook), `${hook} is required for semantic card styling`);
}
assert.ok(card.includes('compact={size === "sm"}'), "small cards need compact keywords");
assert.ok(css.includes("GAMEPLAY & VISUAL IMPACT 2.43–2.48"));
assert.ok(css.includes('.combat-lane[data-outcome="danger"]'));
assert.ok(css.includes('.tcg-arena[data-region="emberhold"] .arena-motes'));
assert.ok(css.includes("@media (prefers-reduced-motion:reduce)"));
assert.ok(events.includes('type: "NEXUS_POISONED"') && events.includes('type: "STATUS_REMOVED"'));
assert.ok(sounds.includes("barrierBreak") && sounds.includes("poison"));
console.log("GAMEPLAY/VISUAL 2.48: PASS");
