import assert from "node:assert/strict";
import { adaptAuthoritativeBattlefieldEvent, buildBattlefieldFxExecutionPlan, buildBattlefieldLabScenario, layoutBattlefieldEntities, previewBattlefieldCombat, previewBattlefieldTarget, resolveBattlefieldFxRecipe } from "./battlefield-lab-scenario";

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


const source = commander.entities[0];
const friendly = commander.entities.find((entity) => entity.controllerId === source.controllerId && entity.id !== source.id);
const opponent = commander.entities.find((entity) => entity.controllerId !== source.controllerId);
assert.ok(friendly);
assert.ok(opponent);
assert.equal(previewBattlefieldTarget(commander, source.id, friendly.id)?.relation, "friendly");
assert.equal(previewBattlefieldTarget(commander, source.id, opponent.id)?.relation, "opponent");
assert.equal(previewBattlefieldTarget(commander, source.id, source.id), null);
assert.equal(previewBattlefieldTarget(commander, source.id, "missing"), null);


const attacker = commander.entities[0];
const defendingPlayer = commander.players.find((player) => player.id !== attacker.controllerId);
assert.ok(defendingPlayer);
assert.deepEqual(
  previewBattlefieldCombat(commander, { type: "declare-attacker", attackerId: attacker.id, defendingPlayerId: defendingPlayer.id }),
  { attackerId: attacker.id, defendingPlayerId: defendingPlayer.id },
);
assert.equal(
  previewBattlefieldCombat(commander, { type: "declare-attacker", attackerId: attacker.id, defendingPlayerId: attacker.controllerId }),
  null,
);
const blocker = commander.entities.find((entity) => entity.controllerId === defendingPlayer.id);
assert.ok(blocker);
assert.deepEqual(
  previewBattlefieldCombat(commander, { type: "declare-blocker", blockerId: blocker.id, attackerId: attacker.id }),
  { attackerId: attacker.id, blockerId: blocker.id, defendingPlayerId: blocker.controllerId },
);
assert.equal(
  previewBattlefieldCombat(commander, { type: "declare-blocker", blockerId: friendly.id, attackerId: attacker.id }),
  null,
);
assert.equal(previewBattlefieldCombat(commander, { type: "clear-combat" }), null);


assert.deepEqual(
  adaptAuthoritativeBattlefieldEvent({ type: "spell-resolved", spellId: "spell-1", sourceId: source.id, targetIds: [opponent.id], fxKey: "spell.fireball" }),
  { type: "fx", cue: "spell.fireball", sourceId: source.id, targetIds: [opponent.id] },
);
assert.deepEqual(
  adaptAuthoritativeBattlefieldEvent({ type: "damage-applied", sourceId: source.id, targetId: opponent.id, amount: 4 }),
  { type: "damage", sourceId: source.id, targetId: opponent.id, amount: 4 },
);
assert.deepEqual(
  adaptAuthoritativeBattlefieldEvent({ type: "entity-died", entityId: opponent.id }),
  { type: "death", entityId: opponent.id },
);
assert.deepEqual(
  adaptAuthoritativeBattlefieldEvent({ type: "priority-changed", playerId: commander.players[1].id }),
  { type: "priority", playerId: commander.players[1].id },
);
assert.deepEqual(
  adaptAuthoritativeBattlefieldEvent({ type: "player-eliminated", playerId: commander.players[3].id }),
  { type: "elimination", playerId: commander.players[3].id },
);


const fireballRecipe = resolveBattlefieldFxRecipe("spell.fireball");
assert.equal(fireballRecipe.key, "spell.fireball");
assert.deepEqual(fireballRecipe.primitives.map((primitive) => primitive.type), ["projectile", "particles", "impact"]);
const lightningRecipe = resolveBattlefieldFxRecipe("spell.lightning");
assert.equal(lightningRecipe.primitives.some((primitive) => primitive.type === "beam"), true);
assert.equal(resolveBattlefieldFxRecipe("spell.unknown").key, "spell.generic");


const highFx = buildBattlefieldFxExecutionPlan("spell.fireball", "high");
const lowFx = buildBattlefieldFxExecutionPlan("spell.fireball", "low");
const highParticles = highFx.primitives.find((primitive) => primitive.type === "particles");
const lowParticles = lowFx.primitives.find((primitive) => primitive.type === "particles");
assert.ok(highParticles && highParticles.type === "particles");
assert.ok(lowParticles && lowParticles.type === "particles");
assert.equal(lowParticles.count < highParticles.count, true);
assert.equal(buildBattlefieldFxExecutionPlan("spell.unknown", "medium").cue, "spell.generic");
