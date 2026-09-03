import assert from "node:assert/strict";
import fs from "node:fs";

const gameClient = fs.readFileSync("src/app/play/GameClient.tsx", "utf8");
const tray = fs.readFileSync("src/components/game/GraveyardTray.tsx", "utf8");
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
assert.ok(tray.includes("data-graveyard-entry") && tray.includes("isValidGraveyardTarget"), "graveyard tray must expose targetable authoritative entries");
assert.ok(launcher.includes("seedStudioSandboxGraveyards"), "Studio sandbox must seed physical graveyard cards for live mechanic testing");

console.log("GRAVEYARD EFFECTS 1.0 UI CONTRACT: PASS (Studio vocabulary + fail-closed speed + public tray + authoritative click target + seeded sandbox)");
