import assert from "node:assert/strict";
import { buildBattlefieldLabScenario, layoutBattlefieldEntities } from "./battlefield-lab-scenario";

const duel = buildBattlefieldLabScenario("duel-1v1", 32);
assert.equal(duel.players.length, 2);
assert.equal(duel.entities.length, 32);
assert.equal(duel.players[0].life, 20);

const commander = buildBattlefieldLabScenario("commander-4p", 160);
assert.equal(commander.players.length, 4);
assert.equal(commander.entities.length, 160);
assert.equal(commander.players.every((player) => player.life === 40), true);
assert.equal(new Set(commander.entities.map((entity) => entity.id)).size, 160);

const capped = buildBattlefieldLabScenario("commander-4p", 999);
assert.equal(capped.entities.length, 160);

console.log("battlefield lab scenario: ok");


const layout = layoutBattlefieldEntities(commander, 1200, 800);
assert.equal(Object.keys(layout).length, 160);
assert.equal(Object.values(layout).every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)), true);
assert.equal(Object.values(layout).every((point) => point.x > 0 && point.x < 1200 && point.y > 0 && point.y < 800), true);
assert.deepEqual(layout, layoutBattlefieldEntities(commander, 1200, 800));
