import assert from "node:assert/strict";
import fs from "node:fs";

const gameClient = fs.readFileSync("src/app/play/GameClient.tsx", "utf8");
const tray = fs.readFileSync("src/components/game/GraveyardTray.tsx", "utf8");
const reactionStack = fs.readFileSync("src/components/game/ReactionStack.tsx", "utf8");
const battleView = fs.readFileSync("src/app/play/BattleView.tsx", "utf8");
const launcher = fs.readFileSync("src/app/play/hooks/useMatchLauncher.ts", "utf8");
const authoring = fs.readFileSync("src/game/card-authoring.ts", "utf8");

for (const primitive of ["returnGraveyardToHand", "reanimateUnit", "banishGraveyardCard"]) {
  assert.ok(authoring.includes(`\"${primitive}\"`), `${primitive} must be exposed through canonical Card Studio authoring vocabulary`);
}
for (const target of ["allyGraveyardCard", "enemyGraveyardCard", "anyGraveyardCard", "allyGraveyardUnit"]) {
  assert.ok(authoring.includes(`\"${target}\"`), `${target} must be exposed through canonical Card Studio target vocabulary`);
}
assert.ok(authoring.includes("Graveyard-targeted Spells are main-phase only"), "Studio validation must fail closed for unsupported reaction-speed graveyard Spells");
assert.ok(gameClient.includes("<GraveyardTray") && gameClient.includes("handleGraveyardClick"), "gameplay must expose public graveyards and route selected entry ids through the normal action path");
assert.ok(gameClient.includes("targetInstanceId: entry.instanceId"), "graveyard targeting must send the authoritative zone instance id");
assert.ok(gameClient.includes("graveyardOverlayVisible") && gameClient.includes('graveyardTargeting ? "pointer-events-auto" : "pointer-events-none"'), "idle/empty graveyard UI must not intercept normal battlefield or hand interaction");
assert.ok(tray.includes("data-graveyard-entry") && tray.includes("isValidGraveyardTarget"), "graveyard tray must expose targetable authoritative entries");
assert.ok(tray.includes("aria-expanded={showEntries}") && tray.includes("setExpanded"), "graveyard dock must toggle its expanded content accessibly");
assert.ok(tray.includes("const showEntries = targeting || expanded"), "graveyard targeting must automatically reveal entries even when dock is collapsed");
assert.ok(tray.includes('showEntries ? "Recolher" : "Abrir"'), "graveyard toggle must announce the correct action to assistive technology");
assert.ok(gameClient.includes("bottom-[112px] left-3") && gameClient.includes("top-[72px]"), "graveyard docks must stay in separate corners clear of bottom actions and top HUD");
assert.ok(gameClient.includes('data-graveyard-overlay="true"') && gameClient.includes("pointer-events-none fixed inset-0"), "graveyard overlay must not block battlefield interactions");
assert.ok(tray.includes("entries.map((entry)") && !tray.includes("entries.slice(0, 8)"), "all graveyard entries must remain accessible, including older targetable cards");
assert.ok(tray.includes("overflow-y-auto") && tray.includes("max-h-"), "expanded graveyard must scroll without covering the full battlefield");
assert.ok(launcher.includes("seedStudioSandboxGraveyards"), "Studio sandbox must seed physical graveyard cards for live mechanic testing");

assert.ok(gameClient.includes('tt === "spellOnStack") finishReaction({ instanceId })'), "counterspells targeting the stack must cast directly without a board-target picker");
assert.ok(reactionStack.includes('type === "anyBoard"') && reactionStack.includes('type === "anySentinela"') && reactionStack.includes('players[owner].sentinelas.map'), "reaction picker must include board and sentinela targets when legal");
assert.ok(reactionStack.includes('data-reaction-target-picker="true"') && reactionStack.includes("onTargetClick(target.id)"), "reaction spell targets must be selectable within the reaction window");
assert.ok(battleView.includes("onTargetClick={(targetId)") && battleView.includes("finishReaction({ instanceId: pendingReaction.instanceId, targetId })"), "reaction window target choice must use authoritative stack resolver");
console.log("GRAVEYARD EFFECTS 1.0 UI CONTRACT: PASS (Studio vocabulary + fail-closed speed + public non-blocking tray + authoritative click target + seeded sandbox)");
